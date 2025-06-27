import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { LambdaStackProps, LambdaFunctions } from './types';

export class LambdaFunctionsStack extends cdk.Stack {
  public readonly functions: LambdaFunctions;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    // Add project tags to all resources in this stack
    cdk.Tags.of(this).add('Project', 'Acorn Pups');
    cdk.Tags.of(this).add('Environment', props.environment);
    cdk.Tags.of(this).add('Component', 'Lambda Functions');

    // Shared Lambda layer for common dependencies
    const sharedLayer = new lambda.LayerVersion(this, 'SharedLayer', {
      code: lambda.Code.fromAsset('lambda/shared'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_22_X],
      description: 'Shared utilities and response handlers',
    });

    // Common environment variables for all functions
    const commonEnvironment = {
      ENVIRONMENT: props.environment,
      REGION: this.region,
      LOG_LEVEL: props.logLevel,
    };

    // Common Lambda function configuration with esbuild bundling for code isolation
    const commonFunctionProps = {
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      layers: [sharedLayer],
      environment: commonEnvironment,
      logRetention: logs.RetentionDays.ONE_WEEK,
      bundling: {
        minify: true,
        sourceMap: false,
        target: 'node22',
        externalModules: [
          '@aws-sdk/*', // AWS SDK v3 is included in Lambda runtime
        ],
        mainFields: ['module', 'main'],
        keepNames: true,
        loader: {
          '.ts': 'ts',
        },
      },
    };

    // Health Check Function (no auth required)
    this.functions = {
      healthCheck: new lambda.Function(this, 'HealthCheckFunction', {
        ...commonFunctionProps,
        functionName: `acorn-pups-${props.environment}-health-check`,
        code: lambda.Code.fromAsset('lambda/health'),
        handler: 'index.handler',
        description: 'Health check endpoint for API monitoring',
      }),

      // Device Management Functions
      registerDevice: new lambda.Function(this, 'RegisterDeviceFunction', {
        ...commonFunctionProps,
        functionName: `acorn-pups-${props.environment}-register-device`,
        code: lambda.Code.fromAsset('lambda/register-device'),
        handler: 'index.handler',
        description: 'Register a new device for a user',
        timeout: cdk.Duration.seconds(60),
      }),

      getUserDevices: new lambda.Function(this, 'GetUserDevicesFunction', {
        ...commonFunctionProps,
        functionName: `acorn-pups-${props.environment}-get-user-devices`,
        code: lambda.Code.fromAsset('lambda/get-user-devices'),
        handler: 'index.handler',
        description: 'Get all devices for a specific user',
      }),

      updateDeviceSettings: new lambda.Function(this, 'UpdateDeviceSettingsFunction', {
        ...commonFunctionProps,
        functionName: `acorn-pups-${props.environment}-update-device-settings`,
        code: lambda.Code.fromAsset('lambda/update-device-settings'),
        handler: 'index.handler',
        description: 'Update device configuration and settings',
      }),

      deleteDevice: new lambda.Function(this, 'DeleteDeviceFunction', {
        ...commonFunctionProps,
        functionName: `acorn-pups-${props.environment}-delete-device`,
        code: lambda.Code.fromAsset('lambda/delete-device'),
        handler: 'index.handler',
        description: 'Remove a device and all associated data',
      }),

      getDeviceStatus: new lambda.Function(this, 'GetDeviceStatusFunction', {
        ...commonFunctionProps,
        functionName: `acorn-pups-${props.environment}-get-device-status`,
        code: lambda.Code.fromAsset('lambda/get-device-status'),
        handler: 'index.handler',
        description: 'Get current status and connectivity of a device',
      }),

      getDeviceHistory: new lambda.Function(this, 'GetDeviceHistoryFunction', {
        ...commonFunctionProps,
        functionName: `acorn-pups-${props.environment}-get-device-history`,
        code: lambda.Code.fromAsset('lambda/get-device-history'),
        handler: 'index.handler',
        description: 'Get button press history for a device',
      }),

      // User Management Functions
      inviteUser: new lambda.Function(this, 'InviteUserFunction', {
        ...commonFunctionProps,
        functionName: `acorn-pups-${props.environment}-invite-user`,
        code: lambda.Code.fromAsset('lambda/invite-user'),
        handler: 'index.handler',
        description: 'Invite a user to access a device',
      }),

      removeUser: new lambda.Function(this, 'RemoveUserFunction', {
        ...commonFunctionProps,
        functionName: `acorn-pups-${props.environment}-remove-user`,
        code: lambda.Code.fromAsset('lambda/remove-user'),
        handler: 'index.handler',
        description: 'Remove user access from a device',
      }),

      getDeviceUsers: new lambda.Function(this, 'GetDeviceUsersFunction', {
        ...commonFunctionProps,
        functionName: `acorn-pups-${props.environment}-get-device-users`,
        code: lambda.Code.fromAsset('lambda/get-device-users'),
        handler: 'index.handler',
        description: 'Get all users with access to a device',
      }),

      updateUserPreferences: new lambda.Function(this, 'UpdateUserPreferencesFunction', {
        ...commonFunctionProps,
        functionName: `acorn-pups-${props.environment}-update-user-preferences`,
        code: lambda.Code.fromAsset('lambda/update-user-preferences'),
        handler: 'index.handler',
        description: 'Update user notification and app preferences',
      }),
    };

    // Create common IAM role for Lambda functions
    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      roleName: `acorn-pups-${props.environment}-lambda-role`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {
        ParameterStoreAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'ssm:GetParameter',
                'ssm:GetParameters',
                'ssm:GetParametersByPath',
              ],
              resources: [
                `arn:aws:ssm:${this.region}:${this.account}:parameter/acorn-pups/${props.environment}/*`,
              ],
            }),
          ],
        }),
        CloudWatchLogs: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ],
              resources: ['*'],
            }),
          ],
        }),
      },
    });

    // Apply the role to all functions
    Object.values(this.functions).forEach(func => {
      func.node.addDependency(lambdaRole);
    });

    // Add tags to all Lambda functions
    Object.entries(this.functions).forEach(([name, func]) => {
      cdk.Tags.of(func).add('FunctionType', name);
      cdk.Tags.of(func).add('Service', 'API');
    });

    // Output function ARNs for reference
    Object.entries(this.functions).forEach(([name, func]) => {
      new cdk.CfnOutput(this, `${name}FunctionArn`, {
        value: func.functionArn,
        description: `ARN of the ${name} Lambda function`,
        exportName: `acorn-pups-${props.environment}-${name}-arn`,
      });
    });
  }
} 