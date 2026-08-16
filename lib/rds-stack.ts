import * as cdk from  'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as rds from 'aws-cdk-lib/aws-rds'
// Props

interface RDSStackProps extends cdk.StackProps {
    vpc: ec2.Vpc;
    rdsSg: ec2.SecurityGroup
}

export class RDSStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: RDSStackProps) {
        super(scope, id, props);

const mysqlEngine = rds.DatabaseInstanceEngine.mysql({
    version: rds.MysqlEngineVersion.VER_8_4_9
});
        // RDS Instance
const rdsInstance = new rds.DatabaseInstance(this, 'RDS', {
    vpc: props.vpc,
    vpcSubnets: {subnetType: ec2.SubnetType.PRIVATE_ISOLATED},
    securityGroups: [props.rdsSg],
    instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
    credentials: rds.Credentials.fromGeneratedSecret('admin'),
    allocatedStorage: 20,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
    engine: mysqlEngine,
    multiAz: true

});
    }
}