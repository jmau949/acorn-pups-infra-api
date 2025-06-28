#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ApiGatewayStack } from '../lib/api-gateway-stack';
import { LambdaFunctionsStack } from '../lib/lambda-functions-stack';
import { MonitoringStack } from '../lib/monitoring-stack';
import { PipelineStack } from '../lib/pipeline-stack';

const app = new cdk.App();

// Get environment from context (dev or prod)
const environment = app.node.tryGetContext('environment') || 'dev';
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION || 'us-east-1';

console.log(`Deploying to environment: ${environment}`);

const env = {
  account,
  region,
};

// Environment-specific configuration
const config = {
  dev: {
    apiGatewayStageName: 'dev',
    domainPrefix: 'api-dev',
    logLevel: 'DEBUG',
    throttleRateLimit: 100,
    throttleBurstLimit: 200,
  },
  prod: {
    apiGatewayStageName: 'prod', 
    domainPrefix: 'api',
    logLevel: 'INFO',
    throttleRateLimit: 1000,
    throttleBurstLimit: 2000,
  }
};

const envConfig = config[environment as keyof typeof config];
if (!envConfig) {
  throw new Error(`Invalid environment: ${environment}. Must be 'dev' or 'prod'`);
}

// Stack naming convention
const stackPrefix = `acorn-pups-${environment}`;

// Lambda Functions Stack (contains all Lambda functions)
const lambdaStack = new LambdaFunctionsStack(app, `${stackPrefix}-lambda`, {
  env,
  environment,
  ...envConfig,
});

// API Gateway Stack (main API with routing)
const apiStack = new ApiGatewayStack(app, `${stackPrefix}-apigateway`, {
  env,
  environment,
  lambdaFunctions: lambdaStack.functions,
  ...envConfig,
});

// Monitoring Stack (CloudWatch, alarms, dashboards)
const monitoringStack = new MonitoringStack(app, `${stackPrefix}-monitoring`, {
  env,
  environment,
  apiGateway: apiStack.api,
  lambdaFunctions: lambdaStack.functions,
  ...envConfig,
});

// Pipeline Stack (only for prod, handles CI/CD)
if (environment === 'prod') {
  new PipelineStack(app, `acorn-pups-pipeline`, {
    env,
    repositoryName: 'acorn-pups-infrastructure-api',
    branch: 'master',
  });
}

// Add dependencies
apiStack.addDependency(lambdaStack);
monitoringStack.addDependency(apiStack);
monitoringStack.addDependency(lambdaStack);

// Tags for all resources
cdk.Tags.of(app).add('Project', 'acorn-pups');
cdk.Tags.of(app).add('Environment', environment);
cdk.Tags.of(app).add('Service', 'API-Gateway');
cdk.Tags.of(app).add('ManagedBy', 'CDK'); 