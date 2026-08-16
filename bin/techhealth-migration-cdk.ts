#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { TechhealthMigrationCdkStack } from '../lib/techhealth-migration-cdk-stack';
import { EC2Stack } from '../lib/ec2-stack';
import { SgStack } from '../lib/sg-stack'
import { RDSStack } from '../lib/rds-stack';
const app = new cdk.App();
const vpcStack = new TechhealthMigrationCdkStack(app, 'TechhealthMigrationCdkStack', {
 
});

const sgStack = new SgStack(app, 'SgStack', {
  vpc: vpcStack.vpc,
});

const rdsStack = new RDSStack(app, 'RdsStack', {
   vpc: vpcStack.vpc,
   rdsSg: sgStack.rdsSG,
});
new EC2Stack(app, 'MyEC2Stack', {
  vpc: vpcStack.vpc,
  webSg: sgStack.webSG
});