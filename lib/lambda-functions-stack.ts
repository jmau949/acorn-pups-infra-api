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

    // **Create DynamoDB & SSM Layer with AWS SDK v3.844.0 (latest as of 2024-12-16)**
    const dynamoDbLayer = new lambda.LayerVersion(this, 'DynamoDbLayer', {
      layerVersionName: `acorn-pups-${props.environment}-dynamodb-layer`,
      code: lambda.Code.fromAsset('.', {
        bundling: {
          image: lambda.Runtime.NODEJS_22_X.bundlingImage,
          command: [
            'bash', '-c', [
              'set -e',
              // Create the nodejs directory structure for the layer
              'mkdir -p /asset-output/nodejs',
              // Initialize a package.json for the layer
              'echo \'{"name": "dynamodb-layer", "version": "1.0.0"}\' > /asset-output/nodejs/package.json',
              // Install the exact version of AWS SDK v3 DynamoDB client
              'cd /asset-output/nodejs',
              'npm install @aws-sdk/client-dynamodb@3.844.0 @aws-sdk/lib-dynamodb@3.844.0 @aws-sdk/util-dynamodb@3.844.0 @aws-sdk/client-ssm@3.844.0',
              // Verify installation succeeded and correct version is installed
              'ls -la node_modules/@aws-sdk/client-dynamodb/package.json || (echo "DynamoDB client installation failed" && exit 1)',
              'ls -la node_modules/@aws-sdk/lib-dynamodb/package.json || (echo "DynamoDB lib installation failed" && exit 1)',
              'ls -la node_modules/@aws-sdk/util-dynamodb/package.json || (echo "DynamoDB util installation failed" && exit 1)',
              'ls -la node_modules/@aws-sdk/client-ssm/package.json || (echo "SSM client installation failed" && exit 1)',
              'grep -q "3.844.0" node_modules/@aws-sdk/client-dynamodb/package.json || (echo "DynamoDB client version mismatch" && exit 1)',
              'grep -q "3.844.0" node_modules/@aws-sdk/lib-dynamodb/package.json || (echo "DynamoDB lib version mismatch" && exit 1)',
              'grep -q "3.844.0" node_modules/@aws-sdk/util-dynamodb/package.json || (echo "DynamoDB util version mismatch" && exit 1)',
              'grep -q "3.844.0" node_modules/@aws-sdk/client-ssm/package.json || (echo "SSM client version mismatch" && exit 1)',
              // Display installed versions for verification
              'echo "Installed package versions:"',
              'cat node_modules/@aws-sdk/client-dynamodb/package.json | grep "version"',
              'cat node_modules/@aws-sdk/lib-dynamodb/package.json | grep "version"',
              'cat node_modules/@aws-sdk/util-dynamodb/package.json | grep "version"',
              'cat node_modules/@aws-sdk/client-ssm/package.json | grep "version"',
              // Clean up package files to reduce layer size
              'rm -rf node_modules/.cache',
              'rm -rf node_modules/**/test',
              'rm -rf node_modules/**/tests',
              'rm -rf node_modules/**/*.md',
              'rm -rf node_modules/**/*.ts',
              'rm -rf node_modules/**/tsconfig.json',
              'rm -rf node_modules/**/*.map',
              'rm -rf node_modules/**/LICENSE*',
              'rm -rf node_modules/**/CHANGELOG*',
              'rm -rf node_modules/**/examples',
              'rm -rf node_modules/**/docs',
              // Debug: show what was installed
              'ls -la /asset-output/nodejs/',
              'ls -la /asset-output/nodejs/node_modules/@aws-sdk/',
            ].join(' && ')
          ],
        },
      }),
      compatibleRuntimes: [lambda.Runtime.NODEJS_22_X],
      description: 'DynamoDB & SSM AWS SDK v3 layer (v3.844.0) for Acorn Pups Lambda functions',
    });

    // **Create IoT & UUID Layer with AWS SDK v3.844.0**
    const iotLayer = new lambda.LayerVersion(this, 'IoTLayer', {
      layerVersionName: `acorn-pups-${props.environment}-iot-layer`,
      code: lambda.Code.fromAsset('.', {
        bundling: {
          image: lambda.Runtime.NODEJS_22_X.bundlingImage,
          command: [
            'bash', '-c', [
              'set -e',
              // Create the nodejs directory structure for the layer
              'mkdir -p /asset-output/nodejs',
              // Initialize a package.json for the layer
              'echo \'{"name": "iot-layer", "version": "1.0.0"}\' > /asset-output/nodejs/package.json',
              // Install the exact version of AWS SDK v3 IoT client and UUID
              'cd /asset-output/nodejs',
              'npm install @aws-sdk/client-iot@3.844.0 uuid@^10.0.0 @types/uuid@^10.0.0',
              // Verify installation succeeded and correct version is installed
              'ls -la node_modules/@aws-sdk/client-iot/package.json || (echo "IoT client installation failed" && exit 1)',
              'ls -la node_modules/uuid/package.json || (echo "UUID installation failed" && exit 1)',
              'grep -q "3.844.0" node_modules/@aws-sdk/client-iot/package.json || (echo "IoT client version mismatch" && exit 1)',
              // Display installed versions for verification
              'echo "Installed package versions:"',
              'cat node_modules/@aws-sdk/client-iot/package.json | grep "version"',
              'cat node_modules/uuid/package.json | grep "version"',
              // Clean up package files to reduce layer size
              'rm -rf node_modules/.cache',
              'rm -rf node_modules/**/test',
              'rm -rf node_modules/**/tests',
              'rm -rf node_modules/**/*.md',
              'rm -rf node_modules/**/*.ts',
              'rm -rf node_modules/**/tsconfig.json',
              'rm -rf node_modules/**/*.map',
              'rm -rf node_modules/**/LICENSE*',
              'rm -rf node_modules/**/CHANGELOG*',
              'rm -rf node_modules/**/examples',
              'rm -rf node_modules/**/docs',
              // Debug: show what was installed
              'ls -la /asset-output/nodejs/',
              'ls -la /asset-output/nodejs/node_modules/@aws-sdk/',
            ].join(' && ')
          ],
        },
      }),
      compatibleRuntimes: [lambda.Runtime.NODEJS_22_X],
      description: 'IoT & UUID AWS SDK v3 layer (v3.844.0) for device management',
    });

    // Common environment variables for all functions
    const commonEnvironment = {
      ENVIRONMENT: props.environment,
      REGION: this.region,
      LOG_LEVEL: props.logLevel,
    };

    // **IoT Device Management Policy** - for register-device, reset-device
    const iotDeviceManagementPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            // Certificate Management
            'iot:CreateKeysAndCertificate',
            'iot:DeleteCertificate',
            'iot:UpdateCertificate',
            'iot:DescribeCertificate',
            'iot:ListCertificates',
            // Thing Management
            'iot:CreateThing',
            'iot:DeleteThing',
            'iot:DescribeThing',
            'iot:ListThings',
            'iot:UpdateThing',
            // Policy and Principal Management
            'iot:AttachPolicy',
            'iot:DetachPolicy',
            'iot:AttachThingPrincipal',
            'iot:DetachThingPrincipal',
            'iot:ListThingPrincipals',
            'iot:ListPrincipalThings',
            'iot:GetPolicy',
            'iot:ListPolicies',
            // IoT Core Information
            'iot:DescribeEndpoint',
            // Communication for reset commands
            'iot:Publish',
          ],
          resources: ['*'], // IoT resources are region-scoped
        }),
      ],
    });

    // **IoT Communication Policy** - for update-device-settings and other MQTT communication
    const iotCommunicationPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'iot:Publish',
            'iot:DescribeEndpoint',
          ],
          resources: [
            `arn:aws:iot:${this.region}:${this.account}:topic/acorn-pups/*`,
            `arn:aws:iot:${this.region}:${this.account}:*/endpoint/*`,
          ],
        }),
      ],
    });

    // **Data Access Policy** - comprehensive DynamoDB access for all functions
    const dataAccessPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            // Core DynamoDB operations
            'dynamodb:GetItem',
            'dynamodb:PutItem',
            'dynamodb:UpdateItem',
            'dynamodb:DeleteItem',
            'dynamodb:Query',
            'dynamodb:Scan',
            'dynamodb:BatchGetItem',
            'dynamodb:BatchWriteItem',
            // Transaction operations
            'dynamodb:TransactGetItems',
            'dynamodb:TransactWriteItems',
            // Conditional operations
            'dynamodb:ConditionCheckItem',
            // Table information
            'dynamodb:DescribeTable',
            'dynamodb:ListTables',
          ],
          resources: [
            // All Acorn Pups tables and their indexes (correct naming: acorn-pups-{tableName}-{environment})
            `arn:aws:dynamodb:${this.region}:${this.account}:table/acorn-pups-*-${props.environment}`,
            `arn:aws:dynamodb:${this.region}:${this.account}:table/acorn-pups-*-${props.environment}/index/*`,
            // Legacy naming patterns (if any)
            `arn:aws:dynamodb:${this.region}:${this.account}:table/AcornPups*`,
            `arn:aws:dynamodb:${this.region}:${this.account}:table/AcornPups*/index/*`,
          ],
        }),
      ],
    });

    // **Notification Policy** - for handle-button-press and invitation emails
    const notificationPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            // SNS Push Notifications
            'sns:Publish',
            'sns:CreatePlatformEndpoint',
            'sns:DeleteEndpoint',
            'sns:GetEndpointAttributes',
            'sns:SetEndpointAttributes',
            'sns:ListEndpointsByPlatformApplication',
            'sns:CreateTopic',
            'sns:DeleteTopic',
            'sns:Subscribe',
            'sns:Unsubscribe',
            'sns:ListSubscriptions',
            'sns:ListTopics',
            // SES Email (for invitations)
            'ses:SendEmail',
            'ses:SendRawEmail',
            'ses:SendTemplatedEmail',
            'ses:GetSendQuota',
            'ses:GetSendStatistics',
          ],
          resources: [
            // SNS topics and platform applications
            `arn:aws:sns:${this.region}:${this.account}:acorn-pups-${props.environment}-*`,
            // SES (region-specific for SES)
            `arn:aws:ses:${this.region}:${this.account}:identity/*`,
            // Allow all for SNS endpoints (they're created dynamically)
            '*',
          ],
        }),
      ],
    });

    // **Common Base Policy** - for all Lambda functions
    const commonBasePolicy = new iam.PolicyDocument({
      statements: [
        // Parameter Store Access
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'ssm:GetParameter',
            'ssm:GetParameters',
            'ssm:GetParametersByPath',
            'ssm:PutParameter',
            'ssm:DeleteParameter',
          ],
          resources: [
            `arn:aws:ssm:${this.region}:${this.account}:parameter/acorn-pups/${props.environment}/*`,
          ],
        }),
        // CloudWatch Logs
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:PutLogEvents',
            'logs:DescribeLogGroups',
            'logs:DescribeLogStreams',
          ],
          resources: [
            `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/acorn-pups-${props.environment}-*`,
            `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/acorn-pups-${props.environment}-*:*`,
          ],
        }),
      ],
    });

    // **Create specific IAM roles for different function groups**

    // Base Lambda role for functions that only need basic access
    const baseLambdaRole = new iam.Role(this, 'BaseLambdaRole', {
      roleName: `acorn-pups-${props.environment}-base-lambda-role`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {
        CommonBasePolicy: commonBasePolicy,
        DataAccess: dataAccessPolicy,
      },
    });

    // IoT Device Management role (register-device, reset-device)
    const iotDeviceManagementRole = new iam.Role(this, 'IoTDeviceManagementRole', {
      roleName: `acorn-pups-${props.environment}-iot-device-mgmt-role`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {
        CommonBasePolicy: commonBasePolicy,
        DataAccess: dataAccessPolicy,
        IoTDeviceManagement: iotDeviceManagementPolicy,
      },
    });

    // IoT Communication role (update-device-settings)
    const iotCommunicationRole = new iam.Role(this, 'IoTCommunicationRole', {
      roleName: `acorn-pups-${props.environment}-iot-comm-role`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {
        CommonBasePolicy: commonBasePolicy,
        DataAccess: dataAccessPolicy,
        IoTCommunication: iotCommunicationPolicy,
      },
    });

    // Notification role (handle-button-press, invite-user)
    const notificationRole = new iam.Role(this, 'NotificationRole', {
      roleName: `acorn-pups-${props.environment}-notification-role`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {
        CommonBasePolicy: commonBasePolicy,
        DataAccess: dataAccessPolicy,
        Notifications: notificationPolicy,
      },
    });

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
              // Copy the function's handler to a temp location
              `cp dist/lambda/${functionPath}/index.js /tmp/original-index.js`,
              // Rewrite import paths to match /lambda/shared/ structure
              `sed 's|../shared/|./lambda/shared/|g' /tmp/original-index.js > /asset-output/index.js`,
              // Copy the function's types (if available)
              `cp dist/lambda/${functionPath}/index.d.ts /asset-output/index.d.ts 2>/dev/null || true`,
              // Debug: verify files were created
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
      role: baseLambdaRole, // Now properly assigned
    };

    // Common Lambda function configuration WITH DynamoDB Layer
    const dynamoDbFunctionProps = {
      ...commonFunctionProps,
      layers: [dynamoDbLayer],
    };

    // Special configuration for functions that need both DynamoDB and IoT layers
    const iotDeviceFunctionProps = {
      ...commonFunctionProps,
      layers: [dynamoDbLayer, iotLayer],
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
        ...iotDeviceFunctionProps,
        functionName: `acorn-pups-${props.environment}-register-device`,
        code: createBundledCode('register-device'),
        handler: 'index.handler',
        description: 'Register a new device for a user',
        timeout: cdk.Duration.seconds(60),
        role: iotDeviceManagementRole,
      }),

      getUserDevices: new lambda.Function(this, 'GetUserDevicesFunction', {
        ...dynamoDbFunctionProps,
        functionName: `acorn-pups-${props.environment}-get-user-devices`,
        code: createBundledCode('get-user-devices'),
        handler: 'index.handler',
        description: 'Get all devices for a specific user',
        role: baseLambdaRole,
      }),

      updateDeviceSettings: new lambda.Function(this, 'UpdateDeviceSettingsFunction', {
        ...dynamoDbFunctionProps,
        functionName: `acorn-pups-${props.environment}-update-device-settings`,
        code: createBundledCode('update-device-settings'),
        handler: 'index.handler',
        description: 'Update device configuration and settings',
        role: iotCommunicationRole,
      }),

      updateDeviceStatus: new lambda.Function(this, 'UpdateDeviceStatusFunction', {
        ...dynamoDbFunctionProps,
        functionName: `acorn-pups-${props.environment}-update-device-status`,
        code: createBundledCode('update-device-status'),
        handler: 'index.handler',
        description: 'Process device status updates from ESP32 receivers and update DeviceStatus table',
        role: baseLambdaRole,
      }),

      resetDevice: new lambda.Function(this, 'ResetDeviceFunction', {
        ...iotDeviceFunctionProps,
        functionName: `acorn-pups-${props.environment}-reset-device`,
        code: createBundledCode('reset-device'),
        handler: 'index.handler',
        description: 'Factory reset device and clear all data',
        role: iotDeviceManagementRole,
      }),

      // User Management Functions
      inviteUser: new lambda.Function(this, 'InviteUserFunction', {
        ...dynamoDbFunctionProps,
        functionName: `acorn-pups-${props.environment}-invite-user`,
        code: createBundledCode('invite-user'),
        handler: 'index.handler',
        description: 'Invite a user to access a device',
        role: notificationRole,
      }),

      removeUserAccess: new lambda.Function(this, 'RemoveUserAccessFunction', {
        ...dynamoDbFunctionProps,
        functionName: `acorn-pups-${props.environment}-remove-user-access`,
        code: createBundledCode('remove-user'),
        handler: 'index.handler',
        description: 'Remove user access from a device',
        role: baseLambdaRole,
      }),

      getUserInvitations: new lambda.Function(this, 'GetUserInvitationsFunction', {
        ...dynamoDbFunctionProps,
        functionName: `acorn-pups-${props.environment}-get-user-invitations`,
        code: createBundledCode('get-user-invitations'),
        handler: 'index.handler',
        description: 'Get pending invitations for a user',
        role: baseLambdaRole,
      }),

      // Invitation Management Functions
      acceptInvitation: new lambda.Function(this, 'AcceptInvitationFunction', {
        ...dynamoDbFunctionProps,
        functionName: `acorn-pups-${props.environment}-accept-invitation`,
        code: createBundledCode('accept-invitation'),
        handler: 'index.handler',
        description: 'Accept device invitation',
        role: baseLambdaRole,
      }),

      declineInvitation: new lambda.Function(this, 'DeclineInvitationFunction', {
        ...dynamoDbFunctionProps,
        functionName: `acorn-pups-${props.environment}-decline-invitation`,
        code: createBundledCode('decline-invitation'),
        handler: 'index.handler',
        description: 'Decline device invitation',
        role: baseLambdaRole,
      }),

      // IoT Event Processing Functions
      handleButtonPress: new lambda.Function(this, 'HandleButtonPressFunction', {
        ...dynamoDbFunctionProps,
        functionName: `acorn-pups-${props.environment}-handle-button-press`,
        code: createBundledCode('handle-button-press'),
        handler: 'index.handler',
        description: 'Process button press events and trigger notifications',
        timeout: cdk.Duration.seconds(60),
        role: notificationRole,
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

    // Create additional stack-level parameters for all IAM roles
    parameterHelper.createParameter(
      'BaseLambdaRoleArn',
      baseLambdaRole.roleArn,
      'Base Lambda execution role ARN',
      `/acorn-pups/${props.environment}/lambda-functions/base-role/arn`
    );

    parameterHelper.createParameter(
      'IoTDeviceManagementRoleArn',
      iotDeviceManagementRole.roleArn,
      'IoT Device Management Lambda role ARN',
      `/acorn-pups/${props.environment}/lambda-functions/iot-device-mgmt-role/arn`
    );

    parameterHelper.createParameter(
      'IoTCommunicationRoleArn',
      iotCommunicationRole.roleArn,
      'IoT Communication Lambda role ARN',
      `/acorn-pups/${props.environment}/lambda-functions/iot-comm-role/arn`
    );

    parameterHelper.createParameter(
      'NotificationRoleArn',
      notificationRole.roleArn,
      'Notification Lambda role ARN',
      `/acorn-pups/${props.environment}/lambda-functions/notification-role/arn`
    );

    // Legacy parameter for backward compatibility
    parameterHelper.createParameter(
      'LambdaRoleArn',
      baseLambdaRole.roleArn,
      'Lambda execution role ARN (legacy)',
      `/acorn-pups/${props.environment}/lambda-functions/execution-role/arn`
    );

    // Create parameter for DynamoDB layer
    parameterHelper.createParameter(
      'DynamoDbLayerArn',
      dynamoDbLayer.layerVersionArn,
      'DynamoDB & SSM Layer ARN with AWS SDK v3.844.0',
      `/acorn-pups/${props.environment}/lambda-functions/dynamodb-layer/arn`
    );

    // Create parameter for IoT layer
    parameterHelper.createParameter(
      'IoTLayerArn',
      iotLayer.layerVersionArn,
      'IoT & UUID Layer ARN with AWS SDK v3.844.0',
      `/acorn-pups/${props.environment}/lambda-functions/iot-layer/arn`
    );

    // Create CloudFormation outputs for DynamoDB layer
    new cdk.CfnOutput(this, 'DynamoDbLayerArn', {
      value: dynamoDbLayer.layerVersionArn,
      description: 'ARN of the DynamoDB & SSM Layer with AWS SDK v3.844.0',
      exportName: `acorn-pups-${props.environment}-dynamodb-layer-arn`,
    });

    // Create CloudFormation outputs for IoT layer
    new cdk.CfnOutput(this, 'IoTLayerArn', {
      value: iotLayer.layerVersionArn,
      description: 'ARN of the IoT & UUID Layer with AWS SDK v3.844.0',
      exportName: `acorn-pups-${props.environment}-iot-layer-arn`,
    });

    // Create CloudFormation outputs for all roles
    new cdk.CfnOutput(this, 'BaseLambdaRoleArn', {
      value: baseLambdaRole.roleArn,
      description: 'ARN of the base Lambda execution role',
      exportName: `acorn-pups-${props.environment}-base-lambda-role-arn`,
    });

    new cdk.CfnOutput(this, 'IoTDeviceManagementRoleArn', {
      value: iotDeviceManagementRole.roleArn,
      description: 'ARN of the IoT Device Management Lambda role',
      exportName: `acorn-pups-${props.environment}-iot-device-mgmt-role-arn`,
    });

    new cdk.CfnOutput(this, 'IoTCommunicationRoleArn', {
      value: iotCommunicationRole.roleArn,
      description: 'ARN of the IoT Communication Lambda role',
      exportName: `acorn-pups-${props.environment}-iot-comm-role-arn`,
    });

    new cdk.CfnOutput(this, 'NotificationRoleArn', {
      value: notificationRole.roleArn,
      description: 'ARN of the Notification Lambda role',
      exportName: `acorn-pups-${props.environment}-notification-role-arn`,
    });
  }
}