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
              // Create the lambda/shared directory structure
              'mkdir -p /asset-output/lambda/shared',
              // Copy all shared files
              'cp -r dist/lambda/shared/* /asset-output/lambda/shared/',
              // Copy the function's handler to the root
              `cp dist/lambda/${functionPath}/index.js /asset-output/index.js`,
              `cp dist/lambda/${functionPath}/index.d.ts /asset-output/index.d.ts 2>/dev/null || true`,
              // Verify the files were created
              'ls -la /asset-output/',
              'ls -la /asset-output/lambda/shared/',
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

      updateDeviceStatus: new lambda.Function(this, 'UpdateDeviceStatusFunction', {
        ...commonFunctionProps,
        functionName: `acorn-pups-${props.environment}-update-device-status`,
        code: createBundledCode('update-device-status'),
        handler: 'index.handler',
        description: 'Process device status updates from ESP32 receivers and update DeviceStatus table',
      }),

      resetDevice: new lambda.Function(this, 'ResetDeviceFunction', {
        ...commonFunctionProps,
        functionName: `acorn-pups-${props.environment}-reset-device`,
        code: createBundledCode('reset-device'),
        handler: 'index.handler',
        description: 'Factory reset device and clear all data',
      }),

      // User Management Functions
      inviteUser: new lambda.Function(this, 'InviteUserFunction', {
        ...commonFunctionProps,
        functionName: `acorn-pups-${props.environment}-invite-user`,
        code: createBundledCode('invite-user'),
        handler: 'index.handler',
        description: 'Invite a user to access a device',
      }),

      removeUserAccess: new lambda.Function(this, 'RemoveUserAccessFunction', {
        ...commonFunctionProps,
        functionName: `acorn-pups-${props.environment}-remove-user-access`,
        code: createBundledCode('remove-user'),
        handler: 'index.handler',
        description: 'Remove user access from a device',
      }),

      getUserInvitations: new lambda.Function(this, 'GetUserInvitationsFunction', {
        ...commonFunctionProps,
        functionName: `acorn-pups-${props.environment}-get-user-invitations`,
        code: createBundledCode('get-user-invitations'),
        handler: 'index.handler',
        description: 'Get pending invitations for a user',
      }),

      // Invitation Management Functions
      acceptInvitation: new lambda.Function(this, 'AcceptInvitationFunction', {
        ...commonFunctionProps,
        functionName: `acorn-pups-${props.environment}-accept-invitation`,
        code: createBundledCode('accept-invitation'),
        handler: 'index.handler',
        description: 'Accept device invitation',
      }),

      declineInvitation: new lambda.Function(this, 'DeclineInvitationFunction', {
        ...commonFunctionProps,
        functionName: `acorn-pups-${props.environment}-decline-invitation`,
        code: createBundledCode('decline-invitation'),
        handler: 'index.handler',
        description: 'Decline device invitation',
      }),

      // IoT Event Processing Functions
      handleButtonPress: new lambda.Function(this, 'HandleButtonPressFunction', {
        ...commonFunctionProps,
        functionName: `acorn-pups-${props.environment}-handle-button-press`,
        code: createBundledCode('handle-button-press'),
        handler: 'index.handler',
        description: 'Process button press events and trigger notifications',
        timeout: cdk.Duration.seconds(60),
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