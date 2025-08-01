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
            'bash', '-c', 
            'set -e && ' +
            'npm config set cache /tmp/.npm --global && ' +
            'npm cache clean --force && ' +
            'mkdir -p /asset-output/nodejs && ' +
            'cd /asset-output/nodejs && ' +
            'echo \'{"name": "dynamodb-layer", "version": "1.0.0"}\' > package.json && ' +
            'npm install --no-fund --no-audit @aws-sdk/client-dynamodb@3.844.0 @aws-sdk/lib-dynamodb@3.844.0 @aws-sdk/util-dynamodb@3.844.0 @aws-sdk/client-ssm@3.844.0 && ' +
            'test -d node_modules/@aws-sdk/client-dynamodb && ' +
            'test -d node_modules/@aws-sdk/lib-dynamodb && ' +
            'test -d node_modules/@aws-sdk/util-dynamodb && ' +
            'test -d node_modules/@aws-sdk/client-ssm && ' +
            'find node_modules -name ".bin" -type d -exec rm -rf {} + 2>/dev/null || true && ' +
            'find node_modules -name "*.md" -delete 2>/dev/null || true && ' +
            'find node_modules -name "*.ts" -delete 2>/dev/null || true && ' +
            'find node_modules -name "*.map" -delete 2>/dev/null || true && ' +
            'rm -rf node_modules/**/test node_modules/**/tests node_modules/**/examples node_modules/**/docs 2>/dev/null || true && ' +
            'echo "DynamoDB layer created successfully"'
          ],
          user: 'root',
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
            'bash', '-c', 
            'set -e && ' +
            'npm config set cache /tmp/.npm --global && ' +
            'npm cache clean --force && ' +
            'mkdir -p /asset-output/nodejs && ' +
            'cd /asset-output/nodejs && ' +
            'echo \'{"name": "iot-layer", "version": "1.0.0"}\' > package.json && ' +
            'npm install --no-fund --no-audit @aws-sdk/client-iot@3.844.0 uuid@^10.0.0 @types/uuid@^10.0.0 && ' +
            'test -d node_modules/@aws-sdk/client-iot && ' +
            'test -d node_modules/uuid && ' +
            'find node_modules -name ".bin" -type d -exec rm -rf {} + 2>/dev/null || true && ' +
            'find node_modules -name "*.md" -delete 2>/dev/null || true && ' +
            'find node_modules -name "*.ts" -delete 2>/dev/null || true && ' +
            'find node_modules -name "*.map" -delete 2>/dev/null || true && ' +
            'rm -rf node_modules/**/test node_modules/**/tests node_modules/**/examples node_modules/**/docs 2>/dev/null || true && ' +
            'echo "IoT layer created successfully"'
          ],
          user: 'root',
        },
      }),
      compatibleRuntimes: [lambda.Runtime.NODEJS_22_X],
      description: 'IoT & UUID AWS SDK v3 layer (v3.844.0) for device management',
    });

    // **Create CloudWatch Layer with AWS SDK v3.844.0**
    const cloudWatchLayer = new lambda.LayerVersion(this, 'CloudWatchLayer', {
      layerVersionName: `acorn-pups-${props.environment}-cloudwatch-layer`,
      code: lambda.Code.fromAsset('.', {
        bundling: {
          image: lambda.Runtime.NODEJS_22_X.bundlingImage,
          command: [
            'bash', '-c', 
            'set -e && ' +
            'npm config set cache /tmp/.npm --global && ' +
            'npm cache clean --force && ' +
            'mkdir -p /asset-output/nodejs && ' +
            'cd /asset-output/nodejs && ' +
            'echo \'{"name": "cloudwatch-layer", "version": "1.0.0"}\' > package.json && ' +
            'npm install --no-fund --no-audit @aws-sdk/client-cloudwatch@3.844.0 && ' +
            'test -d node_modules/@aws-sdk/client-cloudwatch && ' +
            'find node_modules -name ".bin" -type d -exec rm -rf {} + 2>/dev/null || true && ' +
            'find node_modules -name "*.md" -delete 2>/dev/null || true && ' +
            'find node_modules -name "*.ts" -delete 2>/dev/null || true && ' +
            'find node_modules -name "*.map" -delete 2>/dev/null || true && ' +
            'rm -rf node_modules/**/test node_modules/**/tests node_modules/**/examples node_modules/**/docs 2>/dev/null || true && ' +
            'echo "CloudWatch layer created successfully"'
          ],
          user: 'root',
        },
      }),
      compatibleRuntimes: [lambda.Runtime.NODEJS_22_X],
      description: 'CloudWatch AWS SDK v3 layer (v3.844.0) for monitoring and alerting',
    });

    // **Create Expo SDK Layer for Push Notifications**
    const expoLayer = new lambda.LayerVersion(this, 'ExpoLayer', {
      layerVersionName: `acorn-pups-${props.environment}-expo-layer`,
      code: lambda.Code.fromAsset('.', {
        bundling: {
          image: lambda.Runtime.NODEJS_22_X.bundlingImage,
          command: [
            'bash', '-c', 
            'set -e && ' +
            'npm config set cache /tmp/.npm --global && ' +
            'npm cache clean --force && ' +
            'mkdir -p /asset-output/nodejs && ' +
            'cd /asset-output/nodejs && ' +
            'echo \'{"name": "expo-layer", "version": "1.0.0"}\' > package.json && ' +
            'npm install --no-fund --no-audit expo-server-sdk@^3.10.0 && ' +
            'test -d node_modules/expo-server-sdk && ' +
            'find node_modules -name ".bin" -type d -exec rm -rf {} + 2>/dev/null || true && ' +
            'find node_modules -name "*.md" -delete 2>/dev/null || true && ' +
            'find node_modules -name "*.ts" -delete 2>/dev/null || true && ' +
            'find node_modules -name "*.map" -delete 2>/dev/null || true && ' +
            'rm -rf node_modules/**/test node_modules/**/tests node_modules/**/examples node_modules/**/docs 2>/dev/null || true && ' +
            'echo "Expo layer created successfully"'
          ],
          user: 'root',
        },
      }),
      compatibleRuntimes: [lambda.Runtime.NODEJS_22_X],
      description: 'Expo Server SDK layer for push notifications',
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
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            // CloudWatch Metrics for monitoring certificate cleanup failures
            'cloudwatch:PutMetricData',
          ],
          resources: ['*'], // CloudWatch metrics are region-scoped
          conditions: {
            StringEquals: {
              'cloudwatch:namespace': 'AcornPups/DeviceRegistration',
            },
          },
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
      layers: [dynamoDbLayer, iotLayer, cloudWatchLayer],
    };

    // Configuration for functions that need DynamoDB and Expo layers
    const expoPushFunctionProps = {
      ...commonFunctionProps,
      layers: [dynamoDbLayer, expoLayer],
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

      registerPushToken: new lambda.Function(this, 'RegisterPushTokenFunction', {
        ...dynamoDbFunctionProps,
        functionName: `acorn-pups-${props.environment}-register-push-token`,
        code: createBundledCode('register-push-token'),
        handler: 'index.handler',
        description: 'Register or update push notification token for a user device',
        timeout: cdk.Duration.seconds(30),
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
        ...expoPushFunctionProps,
        functionName: `acorn-pups-${props.environment}-handle-button-press`,
        code: createBundledCode('handle-button-press'),
        handler: 'index.handler',
        description: 'Process button press events and trigger notifications',
        timeout: cdk.Duration.seconds(60),
        role: notificationRole,
      }),

      handleVolumeControl: new lambda.Function(this, 'HandleVolumeControlFunction', {
        ...dynamoDbFunctionProps,
        functionName: `acorn-pups-${props.environment}-handle-volume-control`,
        code: createBundledCode('handle-volume-control'),
        handler: 'index.handler',
        description: 'Process volume control events and update device settings in DynamoDB',
        timeout: cdk.Duration.seconds(30),
        role: baseLambdaRole,
      }),

      handleDeviceLifecycle: new lambda.Function(this, 'HandleDeviceLifecycleFunction', {
        ...dynamoDbFunctionProps,
        functionName: `acorn-pups-${props.environment}-handle-device-lifecycle`,
        code: createBundledCode('handle-device-lifecycle'),
        handler: 'index.handler',
        description: 'Process device lifecycle events (connect/disconnect) and update device online status',
        timeout: cdk.Duration.seconds(30),
        role: baseLambdaRole,
      }),

      factoryReset: new lambda.Function(this, 'FactoryResetFunction', {
        ...iotDeviceFunctionProps,
        functionName: `acorn-pups-${props.environment}-factory-reset`,
        code: createBundledCode('factory-reset'),
        handler: 'index.handler',
        description: 'Process device factory reset cleanup via MQTT - revoke certificates and clean database',
        timeout: cdk.Duration.seconds(90),
        role: iotDeviceManagementRole,
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

    // **IoT Integration Resources**
    // Grant IoT service permission to invoke the handle-device-lifecycle lambda
    this.functions.handleDeviceLifecycle.addPermission('AllowIoTInvocation', {
      principal: new iam.ServicePrincipal('iot.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceAccount: this.account,
    });

    // Grant IoT service permission to invoke the handle-volume-control lambda
    this.functions.handleVolumeControl.addPermission('AllowIoTInvocation', {
      principal: new iam.ServicePrincipal('iot.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceAccount: this.account,
    });

    // Grant IoT service permission to invoke the handle-button-press lambda
    this.functions.handleButtonPress.addPermission('AllowIoTInvocation', {
      principal: new iam.ServicePrincipal('iot.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceAccount: this.account,
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