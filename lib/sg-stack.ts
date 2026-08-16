 import * as cdk from  'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2'

// Props
interface SGStackProps extends cdk.StackProps{
    vpc: ec2.Vpc;
}

export class SgStack extends cdk.Stack {
    public readonly webSG: ec2.SecurityGroup;
    public readonly rdsSG: ec2.SecurityGroup;
    constructor(scope: Construct, id: string, props: SGStackProps) {
        super(scope, id, props);

        // Step 1: create the security group

this.webSG = new ec2.SecurityGroup(this, 'WebSG', {
      vpc: props.vpc,
      description: 'Allows HTTP traffic to the web tier',
 });    
this.rdsSG = new ec2.SecurityGroup(this, 'RDS-SG', {
      vpc: props.vpc,
      description: 'Allow only VPC internal traffic from another Security group inside the VPC which specified.',
 })
    

 // Step 2: now that webSg exists, call a method ON it

        this.webSG.addIngressRule(
            ec2.Peer.anyIpv4(), 
            ec2.Port.tcp(80),
            'Allow HTTP from anywhere' 
        )
    
      this.rdsSG.addIngressRule(
        this.webSG,
        ec2.Port.tcp(3306),
        'Allow traffic from MySQL from wenSG itself'
      )
}}