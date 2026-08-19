# TechHealth Inc. - Patient Portal Infrastructure Migration

Architecture, design rationale, cost considerations, security implementations, and lessons learned for the AWS CDK migration.

## 1. Overview

TechHealth Inc.'s patient portal infrastructure was originally built manually through the AWS Console five years ago. This left the environment undocumented, hard to reproduce, and difficult to audit for change history - all significant concerns for a system handling patient data. This project migrates that infrastructure to AWS CDK (TypeScript), replacing manual console configuration with version-controlled, repeatable infrastructure-as-code.

The new design splits infrastructure into four independent CDK stacks - networking, security groups, compute, and database - so each concern can be reasoned about, tested, and changed independently.

## 2. Architecture Diagram

![Architecture Diagram](../architecture-diagram-techhealth-migration-cdk.png)

The VPC spans two Availability Zones for resilience. Each AZ contains one public subnet (hosting a web-tier EC2 instance) and one private isolated subnet (hosting the RDS database tier). No NAT Gateway is deployed, since the isolated subnets never require outbound internet access.

## 3. Design Choices

### 3.1 Four-stack split

Rather than a single monolithic stack, the infrastructure is split into four CDK stacks:

- **Network stack** - the VPC, subnets, and routing
- **Security Group stack** - the web-tier and database-tier security groups
- **Compute stack** - the EC2 instances and their IAM role
- **Database stack** - the RDS MySQL instance

Each downstream stack receives what it needs (the VPC, a security group) as an explicit constructor prop from the stack that created it, rather than reaching into another stack's internals. This mirrors how a larger engineering team would divide ownership of infrastructure in a real organization - for example, a networking team owning the VPC stack while an application team owns compute.

### 3.2 Public/private subnet split, no NAT Gateway

EC2 instances sit in public subnets because the patient portal must be reachable over the internet. RDS sits in private isolated subnets, which have no route to the internet at all - not even outbound. This is a deliberate choice: the database never needs to initiate outbound connections, so an isolated subnet (rather than a NAT-egress subnet) removes both the internet exposure and the NAT Gateway cost entirely.

### 3.3 Security groups reference each other, not IP ranges

The database security group's inbound rule allows MySQL traffic (port 3306) only from the web security group itself - not from the VPC's CIDR range. Referencing a security group instead of an IP range means only resources that carry that specific security group can reach the database, regardless of what subnet they're launched in. A CIDR-range rule would have allowed any resource anywhere in the VPC to reach port 3306, which is broader than necessary.

### 3.4 SSM Session Manager instead of SSH

Administrative access to EC2 uses AWS Systems Manager Session Manager rather than SSH. This was a deliberate trade-off, and both approaches were evaluated:

- SSH would require a key pair, an open inbound port 22 (even if restricted to one IP), and manual key management. IP-based restriction is also fragile - a home ISP's IP can change, requiring the security group to be updated.
- SSM requires no inbound port at all. The EC2 instance reaches out to the SSM service over outbound HTTPS using its IAM role; there is no listening port for an attacker to find. Access is governed entirely by IAM policy, and every session is logged.

SSM was chosen as the stronger security posture for a system handling patient data, even though the original assignment brief specified SSH-from-a-restricted-IP as the literal requirement. This is called out explicitly as a deliberate deviation with reasoning, not an oversight.

### 3.5 RDS Multi-AZ instead of two independent databases

The database tier uses a single RDS instance with Multi-AZ enabled, rather than two separate database instances (one per AZ). Multi-AZ provisions a synchronized standby replica in the second AZ automatically; if the primary fails, RDS fails over to the standby using the same connection endpoint, with no application changes required. Two independent RDS instances would have cost the same (both approaches run two underlying database instances) but would not have been synchronized - the application would have needed to manage its own replication and failover logic, or risk one instance holding data the other doesn't.

### 3.6 Instance sizing

EC2 instances use t3.micro rather than t2.micro. t2.micro was specified in the original brief as the free-tier baseline, but t3.micro was used instead due to regional instance-type availability in the deployment region (Canada), and because t3 is the newer, similarly-priced generation. RDS uses db.t3.micro, matching the brief's minimum-cost requirement.

## 4. Cost Considerations

| Decision | Cost impact | Rationale |
|---|---|---|
| No NAT Gateway | Saves ~$32+/month per gateway plus data processing charges | Isolated subnets never need outbound internet access |
| t3.micro / db.t3.micro | Free-tier eligible or near-minimum cost | Smallest practical size for a test/demo workload |
| RDS Multi-AZ | Roughly doubles RDS instance cost (standby billed separately) | Trades cost for real failover; same cost as two unsynced instances, more benefit |
| Backup retention set to 0 days | Avoids ongoing snapshot storage cost | Acceptable for a short-lived test database that is destroyed after evaluation |
| SSM instead of a bastion host | No bastion EC2 instance to run or pay for | IAM-based access replaces a dedicated jump-box pattern |

Resources are deployed only for the duration of testing and destroyed immediately afterward (`cdk destroy --all`) to avoid ongoing charges outside the evaluation window.

## 5. Security Implementations

- **Network segmentation**: EC2 in public subnets, RDS in private isolated subnets with no route to the internet at all
- **Least-privilege security groups**: the database security group only accepts traffic from the web security group, not from any IP range or the broader VPC CIDR
- **No direct public access to RDS**: the database has no public IP and is not reachable from outside the VPC under any circumstance
- **No open SSH port**: administrative access uses SSM Session Manager, authenticated and authorized entirely through IAM, with every session logged
- **Least-privilege IAM**: the EC2 instance role only carries the `AmazonSSMManagedInstanceCore` managed policy - no broad administrative permissions
- **Credentials never hardcoded**: the RDS database password is auto-generated and stored in AWS Secrets Manager via `Credentials.fromGeneratedSecret()`, rather than being written into source code
- **Encryption at rest**: `storageEncrypted: true` is set on the RDS instance, flagged as necessary by CDK's built-in validation and treated as a requirement for a database intended to hold patient data
- **Documented security groups**: every security group includes a description explaining its purpose, addressing the original brief's complaint about outdated/missing documentation

## 6. Lessons Learned

- Splitting infrastructure into multiple stacks required deliberately thinking through dependency order and explicitly passing constructs (VPC, security groups) between stacks via typed props interfaces - CDK does not do this automatically
- Defaults matter and can be costly if unexamined: CDK's default NAT Gateway behavior, RDS's default "retain on delete" removal policy, and default backup retention were all decisions worth being explicit about rather than accepting silently
- Referencing a security group as a traffic source (rather than an IP/CIDR range) is a stronger least-privilege pattern, since it scopes access to specific resources rather than a whole network range
- SSM Session Manager is a more defensible production pattern than SSH-from-a-restricted-IP, though the trade-off (an extra local CLI plugin, IAM-permission dependency) is worth documenting alongside the choice
- RDS Multi-AZ and two independent database instances can cost the same, but only one of them provides actual synchronized failover - cost alone isn't a sufficient basis for comparing architecture options

### Bugs caught during deployment

- **Both EC2 instances deployed to the same Availability Zone**, despite being named `AZa`/`AZb`. Identical `subnetType: PUBLIC` selections don't differentiate between AZs - CDK just resolves both to the first matching subnet. The fix was passing an explicit `availabilityZones` array (one AZ per instance) inside `vpcSubnets`, sourced from `props.vpc.availabilityZones` - not from `cdk.Stack.of(this).availabilityZones`, which returned an unresolved token and broke synthesis, since the stack had no explicit `env` set. This was a useful reminder that variable *names* don't enforce anything - only explicit configuration does.
- **CDK's built-in validation flagged `StorageEncrypted` as missing** on the RDS instance - encryption at rest isn't on by default. For a database intended to hold patient data, this was treated as a required fix, not an optional warning: added `storageEncrypted: true` to the `DatabaseInstance` props.
- **The default MariaDB client on Amazon Linux 2 (`yum install mariadb`) installs version 5.5**, which predates MySQL 8's `caching_sha2_password` authentication plugin and fails to connect with a missing-shared-library error. Fixed by pulling a newer client via `sudo amazon-linux-extras enable mariadb10.5` before installing - a reminder that "install the database client" isn't a one-size-fits-all command across OS/engine version combinations.
