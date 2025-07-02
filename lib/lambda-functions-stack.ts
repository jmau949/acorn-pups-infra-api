import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { LambdaStackProps, LambdaFunctions } from './types';
import { ParameterStoreHelper } from './parameter-store-helper';

export class LambdaFunctionsStack extends cdk.Stack {
  public readonly functions: LambdaFunctions;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    // Add project tags to all resources in this stack
    cdk.Tags.of(this).add('Project', 'acorn-pups');
    cdk.Tags.of(this).add('Environment', props.environment);
    cdk.Tags.of(this).add('Component', 'lambda-functions');

    // Common environment variables for all functions
    const commonEnvironment = {
      ENVIRONMENT: props.environment,
      REGION: this.region,
      LOG_LEVEL: props.logLevel,
    };

    // Create common IAM role for Lambda functions (moved up)
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

    // Function to create bundled code with shared dependencies
    const createBundledCode = (functionPath: string) => {
      return lambda.Code.fromAsset('.', {
        bundling: {
          image: lambda.Runtime.NODEJS_22_X.bundlingImage,
          command: [
            'bash', '-c', [
              'set -e',
              // Create only the shared directory structure
              'mkdir -p /asset-output/lambda/shared',
              // Copy only the shared files (no function duplicates)
              'cp -r dist/lambda/shared/* /asset-output/lambda/shared/',
              // Copy the function's handler to the root with corrected import
              `cp dist/lambda/${functionPath}/index.js /tmp/original-index.js`,
              // Use sed to fix the import path in the copied file
              `sed 's|../shared/|./lambda/shared/|g' /tmp/original-index.js > /asset-output/index.js`,
              // Copy other files from the function directory
              `cp dist/lambda/${functionPath}/index.d.ts /asset-output/ 2>/dev/null || true`,
            ].join(' && ')
          ],
        },
      });
    };

    // Common Lambda function configuration
    const commonFunctionProps = {
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: commonEnvironment,
      logRetention: logs.RetentionDays.ONE_WEEK,
      role: lambdaRole, // Now properly assigned
    };

    // Health Check Function (no auth required)
    this.functions = {
      healthCheck: new lambda.Function(this, 'HealthCheckFunction', {
        ...commonFunctionProps,
        functionName: `acorn-pups-${props.environment}-health-check`,
        code: createBundledCode('health'),
        handler: 'index.handler',
        description: 'Health check endpoint for API monitoring',
      }),

      // Device Management Functions
      registerDevice: new lambda.Function(this, 'RegisterDeviceFunction', {
        ...commonFunctionProps,
        functionName: `acorn-pups-${props.environment}-register-device`,
        code: createBundledCode('register-device'),
        handler: 'index.handler',
        description: 'Register a new device for a user',
        timeout: cdk.Duration.seconds(60),
      }),

      getUserDevices: new lambda.Function(this, 'GetUserDevicesFunction', {
        ...commonFunctionProps,
        functionName: `acorn-pups-${props.environment}-get-user-devices`,
        code: createBundledCode('get-user-devices'),
        handler: 'index.handler',
        description: 'Get all devices for a specific user',
      }),

      updateDeviceSettings: new lambda.Function(this, 'UpdateDeviceSettingsFunction', {
        ...commonFunctionProps,
        functionName: `acorn-pups-${props.environment}-update-device-settings`,
        code: createBundledCode('update-device-settings'),
        handler: 'index.handler',
        description: 'Update device configuration and settings',
      }),

      deleteDevice: new lambda.Function(this, 'DeleteDeviceFunction', {
        ...commonFunctionProps,
        functionName: `acorn-pups-${props.environment}-delete-device`,
        code: createBundledCode('delete-device'),
        handler: 'index.handler',
        description: 'Remove a device and all associated data',
      }),

      getDeviceStatus: new lambda.Function(this, 'GetDeviceStatusFunction', {
        ...commonFunctionProps,
        functionName: `acorn-pups-${props.environment}-get-device-status`,
        code: createBundledCode('get-device-status'),
        handler: 'index.handler',
        description: 'Get current status and connectivity of a device',
      }),

      getDeviceHistory: new lambda.Function(this, 'GetDeviceHistoryFunction', {
        ...commonFunctionProps,
        functionName: `acorn-pups-${props.environment}-get-device-history`,
        code: createBundledCode('get-device-history'),
        handler: 'index.handler',
        description: 'Get button press history for a device',
      }),

      // User Management Functions
      inviteUser: new lambda.Function(this, 'InviteUserFunction', {
        ...commonFunctionProps,
        functionName: `acorn-pups-${props.environment}-invite-user`,
        code: createBundledCode('invite-user'),
        handler: 'index.handler',
        description: 'Invite a user to access a device',
      }),

      removeUser: new lambda.Function(this, 'RemoveUserFunction', {
        ...commonFunctionProps,
        functionName: `acorn-pups-${props.environment}-remove-user`,
        code: createBundledCode('remove-user'),
        handler: 'index.handler',
        description: 'Remove user access from a device',
      }),

      getDeviceUsers: new lambda.Function(this, 'GetDeviceUsersFunction', {
        ...commonFunctionProps,
        functionName: `acorn-pups-${props.environment}-get-device-users`,
        code: createBundledCode('get-device-users'),
        handler: 'index.handler',
        description: 'Get all users with access to a device',
      }),

      updateUserPreferences: new lambda.Function(this, 'UpdateUserPreferencesFunction', {
        ...commonFunctionProps,
        functionName: `acorn-pups-${props.environment}-update-user-preferences`,
        code: createBundledCode('update-user-preferences'),
        handler: 'index.handler',
        description: 'Update user notification and app preferences',
      }),
    };

    // Add tags to all Lambda functions
    Object.entries(this.functions).forEach(([name, func]) => {
      cdk.Tags.of(func).add('FunctionType', name);
      cdk.Tags.of(func).add('Service', 'API');
    });

    // Initialize Parameter Store helper
    const parameterHelper = new ParameterStoreHelper(this, {
      environment: props.environment,
      stackName: 'lambda-functions',
    });

    // Create Lambda function parameters and outputs
    parameterHelper.createLambdaFunctionParameters(this.functions, props.environment);

    // Create traditional CloudFormation outputs for compatibility
    Object.entries(this.functions).forEach(([name, func]) => {
      new cdk.CfnOutput(this, `${name}FunctionArn`, {
        value: func.functionArn,
        description: `ARN of the ${name} Lambda function`,
        exportName: `acorn-pups-${props.environment}-${name}-arn`,
      });
    });

    // Create additional stack-level parameters
    parameterHelper.createParameter(
      'LambdaRoleArn',
      lambdaRole.roleArn,
      'Lambda execution role ARN',
      `/acorn-pups/${props.environment}/lambda-functions/execution-role/arn`
    );
  }
}