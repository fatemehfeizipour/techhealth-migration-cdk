import * as cdk from  'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam'

// Props

interface EC2StackProps extends cdk.StackProps {
    vpc: ec2.Vpc;
    webSg: ec2.SecurityGroup
}

export class EC2Stack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: EC2StackProps) {
        super(scope, id, props);
    const ec2Role = new iam.Role(this, 'someId', {
         assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
    }) 
   
       ec2Role.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName( 'AmazonSSMManagedInstanceCore')
       ) 
        // EC2 Instance 1 in AZ1a
    const instanceAZa = new ec2.Instance(this, 'MyPublicEc2AZa', {
        vpc: props.vpc,
        vpcSubnets: {
            subnetType: ec2.SubnetType.PUBLIC
        },
        machineImage: new ec2.AmazonLinuxImage({
            generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2
        }),
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
        securityGroup: props.webSg,
        role: ec2Role
    });
        cdk.Tags.of(instanceAZa).add('Name', 'MyPublicEc2AZa')

         // EC2 Instance 2 in AZ1b
    const instanceAZb = new ec2.Instance(this, 'MyPublicEc2AZb', {
        vpc: props.vpc,
        vpcSubnets: {
            subnetType: ec2.SubnetType.PUBLIC
        },
        machineImage: new ec2.AmazonLinuxImage({
            generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2
        }),
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
        securityGroup: props.webSg,
        role: ec2Role
    });
    
    
        cdk.Tags.of(instanceAZb).add('Name', 'MyPublicEc2AZb')
    }
}
