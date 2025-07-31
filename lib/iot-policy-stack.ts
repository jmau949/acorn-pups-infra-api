import * as cdk from 'aws-cdk-lib';
import * as iot from 'aws-cdk-lib/aws-iot';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { IotPolicyStackProps, IOT_CLIENT_ID_PATTERN } from './types';
import { ParameterStoreHelper } from './parameter-store-helper';
import { IoTPolicyCleanup } from './iot-policy-cleanup-resource';

export class IotPolicyStack extends cdk.Stack {
  public readonly receiverDevicePolicy: iot.CfnPolicy;
  public readonly iotRuleExecutionRole: iam.Role;
  private parameterHelper: ParameterStoreHelper;

  constructor(scope: Construct, id: string, props: IotPolicyStackProps) {
    super(scope, id, props);

    // Initialize parameter store helper
    this.parameterHelper = new ParameterStoreHelper(this, {
      environment: props.environment,
      stackName: 'iot-policies',
    });

    // Create IoT Device Policy for ESP32 receivers with minimal security principle
    this.receiverDevicePolicy = new iot.CfnPolicy(this, 'AcornPupsReceiverPolicy', {
      policyName: `AcornPupsReceiverPolicy-${props.environment}`,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: 'iot:Connect',
            Resource: `arn:aws:iot:${this.region}:${this.account}:client/${IOT_CLIENT_ID_PATTERN}`,
            Condition: {
              StringEquals: {
                'iot:Connection.Thing.IsAttached': 'true'
              }
            }
          },
          {
            Effect: 'Allow',
            Action: 'iot:Publish',
            Resource: [
              // Button press events - real-time processing
              `arn:aws:iot:${this.region}:${this.account}:topic/acorn-pups/button-press/\${iot:ClientId}`,
              // Device status updates
              `arn:aws:iot:${this.region}:${this.account}:topic/acorn-pups/status-response/\${iot:ClientId}`,
              // Device reset notifications (from device to cloud)
              `arn:aws:iot:${this.region}:${this.account}:topic/acorn-pups/commands/\${iot:ClientId}/reset`
            ]
          },
          {
            Effect: 'Allow',
            Action: 'iot:Subscribe',
            Resource: [
              // Settings updates from cloud to device
              `arn:aws:iot:${this.region}:${this.account}:topicfilter/acorn-pups/settings/\${iot:ClientId}`,
              // Command topics for device control
              `arn:aws:iot:${this.region}:${this.account}:topicfilter/acorn-pups/commands/\${iot:ClientId}`,
              `arn:aws:iot:${this.region}:${this.account}:topicfilter/acorn-pups/commands/\${iot:ClientId}/reset`,
              // Status request topic (cloud to device)
              `arn:aws:iot:${this.region}:${this.account}:topicfilter/acorn-pups/status-request/\${iot:ClientId}`,
              // Firmware update topic
              `arn:aws:iot:${this.region}:${this.account}:topicfilter/acorn-pups/firmware/\${iot:ClientId}`
            ],
            Condition: {
              StringEquals: {
                'iot:Connection.Thing.IsAttached': 'true'
              }
            }
          },
          {
            Effect: 'Allow',
            Action: 'iot:Receive',
            Resource: [
              // Settings updates from cloud to device
              `arn:aws:iot:${this.region}:${this.account}:topic/acorn-pups/settings/\${iot:ClientId}`,
              // Command topics for device control
              `arn:aws:iot:${this.region}:${this.account}:topic/acorn-pups/commands/\${iot:ClientId}`,
              `arn:aws:iot:${this.region}:${this.account}:topic/acorn-pups/commands/\${iot:ClientId}/reset`,
              // Status request topic (cloud to device)
              `arn:aws:iot:${this.region}:${this.account}:topic/acorn-pups/status-request/\${iot:ClientId}`,
              // Firmware update topic
              `arn:aws:iot:${this.region}:${this.account}:topic/acorn-pups/firmware/\${iot:ClientId}`
            ],
            Condition: {
              StringEquals: {
                'iot:Connection.Thing.IsAttached': 'true'
              }
            }
          },
          {
            Effect: 'Allow',
            Action: [
              'iot:UpdateThingShadow',
              'iot:GetThingShadow'
            ],
            Resource: `arn:aws:iot:${this.region}:${this.account}:thing/\${iot:ClientId}`,
            Condition: {
              StringEquals: {
                'iot:Connection.Thing.IsAttached': 'true'
              }
            }
          }
        ]
      },
      tags: [
        {
          key: 'Project',
          value: 'acorn-pups'
        },
        {
          key: 'Environment',
          value: props.environment
        },
        {
          key: 'Service',
          value: 'IoT-Core'
        },
        {
          key: 'Component',
          value: 'Policy'
        },
        {
          key: 'DeviceType',
          value: 'ESP32-Receiver'
        }
      ]
    });

    // Create automatic certificate cleanup resource
    // This ensures certificates are detached/deleted before policy deletion
    new IoTPolicyCleanup(this, 'PolicyCleanup', {
      policyName: this.receiverDevicePolicy.policyName!,
      environment: props.environment
    });

    // Create IAM Role for IoT Rules execution
    this.iotRuleExecutionRole = new iam.Role(this, 'IoTRuleExecutionRole', {
      roleName: `AcornPupsIoTRuleExecution-${props.environment}`,
      assumedBy: new iam.ServicePrincipal('iot.amazonaws.com'),
      description: 'Role for IoT Rules to execute Lambda functions and write to CloudWatch Logs',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSIoTRuleActions')
      ],
      inlinePolicies: {
        LambdaInvokePolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'lambda:InvokeFunction'
              ],
              resources: [
                `arn:aws:lambda:${this.region}:${this.account}:function:acorn-pups-${props.environment}-*`
              ]
            })
          ]
        }),
        CloudWatchLogsPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
                'logs:DescribeLogGroups',
                'logs:DescribeLogStreams'
              ],
              resources: [
                `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/iot/rules/*`,
                `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/iot/rules/*:*`
              ]
            })
          ]
        }),
        ParameterStoreReadPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'ssm:GetParameter',
                'ssm:GetParameters',
                'ssm:GetParameterHistory'
              ],
              resources: [
                `arn:aws:ssm:${this.region}:${this.account}:parameter/acorn-pups/${props.environment}/*`
              ]
            })
          ]
        }),
        SNSPublishPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'sns:Publish'
              ],
              resources: [
                `arn:aws:sns:${this.region}:${this.account}:acorn-pups-${props.environment}-*`
              ]
            })
          ]
        })
      }
    });

    // Add tags to resources
    cdk.Tags.of(this.receiverDevicePolicy).add('Project', 'acorn-pups');
    cdk.Tags.of(this.receiverDevicePolicy).add('Environment', props.environment);
    cdk.Tags.of(this.receiverDevicePolicy).add('Service', 'IoT-Core');
    cdk.Tags.of(this.receiverDevicePolicy).add('Component', 'Policy');

    // Add tags to IAM role
    cdk.Tags.of(this.iotRuleExecutionRole).add('Project', 'acorn-pups');
    cdk.Tags.of(this.iotRuleExecutionRole).add('Environment', props.environment);
    cdk.Tags.of(this.iotRuleExecutionRole).add('Service', 'IoT-Core');
    cdk.Tags.of(this.iotRuleExecutionRole).add('Component', 'IAM-Role');

    // Store policy information in Parameter Store
    this.parameterHelper.createParameter(
      'ReceiverDevicePolicyArnParam',
      this.receiverDevicePolicy.attrArn,
      'ARN of the AcornPupsReceiver Policy',
      `/acorn-pups/${props.environment}/iot-core/receiver-policy/arn`
    );

    this.parameterHelper.createParameter(
      'ReceiverDevicePolicyNameParam',
      this.receiverDevicePolicy.policyName!,
      'Name of the AcornPupsReceiver Policy',
      `/acorn-pups/${props.environment}/iot-core/receiver-policy/name`
    );

    // Store IoT rule execution role information in Parameter Store
    this.parameterHelper.createParameter(
      'IoTRuleExecutionRoleArnParam',
      this.iotRuleExecutionRole.roleArn,
      'ARN of the IoT Rule Execution Role',
      `/acorn-pups/${props.environment}/iot-core/rule-execution-role/arn`
    );

    this.parameterHelper.createParameter(
      'IoTRuleExecutionRoleNameParam',
      this.iotRuleExecutionRole.roleName,
      'Name of the IoT Rule Execution Role',
      `/acorn-pups/${props.environment}/iot-core/rule-execution-role/name`
    );

    // Create outputs with Parameter Store integration
    this.parameterHelper.createOutputWithParameter(
      'ReceiverDevicePolicyArnOutput',
      this.receiverDevicePolicy.attrArn,
      'ARN of the Acorn Pups Receiver Policy',
      `AcornPupsReceiverPolicyArn-${props.environment}`
    );

    this.parameterHelper.createOutputWithParameter(
      'ReceiverDevicePolicyNameOutput',
      this.receiverDevicePolicy.policyName!,
      'Name of the Acorn Pups Receiver Policy',
      `AcornPupsReceiverPolicyName-${props.environment}`
    );

    this.parameterHelper.createOutputWithParameter(
      'IoTRuleExecutionRoleArnOutput',
      this.iotRuleExecutionRole.roleArn,
      'ARN of the IoT Rule Execution Role',
      `AcornPupsIoTRuleExecutionRoleArn-${props.environment}`
    );

    this.parameterHelper.createOutputWithParameter(
      'IoTRuleExecutionRoleNameOutput',
      this.iotRuleExecutionRole.roleName,
      'Name of the IoT Rule Execution Role',
      `AcornPupsIoTRuleExecutionRoleName-${props.environment}`
    );

    // MQTT topic structure parameters (aligned with API specification)
    this.parameterHelper.createParameter(
      'MqttTopicStructureParam',
      JSON.stringify({
        buttonPress: 'acorn-pups/button-press/{clientId}',
        statusResponse: 'acorn-pups/status-response/{clientId}',
        statusRequest: 'acorn-pups/status-request/{clientId}',
        settings: 'acorn-pups/settings/{clientId}',
        commands: 'acorn-pups/commands/{clientId}',
        firmware: 'acorn-pups/firmware/{clientId}',
        clientIdFormat: 'acorn-receiver-{deviceId}'
      }),
      'MQTT topic structure for Acorn Pups system',
      `/acorn-pups/${props.environment}/iot-core/mqtt-topics`
    );

    // API endpoint integration parameters
    this.parameterHelper.createParameter(
      'ApiIntegrationParam',
      JSON.stringify({
        deviceRegistration: {
          endpoint: 'POST /devices/register',
          certificateGeneration: 'AWS_MANAGED_CERTIFICATES',
          thingCreation: 'AUTOMATIC'
        },
        deviceSettings: {
          endpoint: 'PUT /devices/{deviceId}/settings',
          mqttTopic: 'acorn-pups/settings/{deviceId}',
          realTimeUpdate: true
        },
        deviceReset: {
          endpoint: 'POST /devices/{deviceId}/reset',
          mqttTopic: 'acorn-pups/commands/{deviceId}/reset',
          cleanup: 'FULL_DEVICE_CLEANUP'
        },
        buttonPress: {
          mqttTopic: 'acorn-pups/button-press/{deviceId}',
          processing: 'REAL_TIME_NOTIFICATIONS',
          storage: 'NO_PERSISTENT_STORAGE'
        }
      }),
      'API integration configuration for IoT operations',
      `/acorn-pups/${props.environment}/iot-core/api-integration`
    );

    // Security and permissions configuration
    this.parameterHelper.createParameter(
      'SecurityConfigParam',
      JSON.stringify({
        deviceAuthentication: 'X509_CERTIFICATES',
        certificateType: 'AWS_MANAGED',
        policyAttachment: 'AUTOMATIC',
        thingPrincipalAttachment: 'AUTOMATIC',
        deviceValidation: 'THING_ATTACHMENT_REQUIRED',
        topicPermissions: 'DEVICE_SCOPED'
      }),
      'Security configuration for IoT device connectivity',
      `/acorn-pups/${props.environment}/iot-core/security-config`
    );

    // Certificate management workflow documentation
    this.parameterHelper.createParameter(
      'CertificateManagementWorkflowParam',
      JSON.stringify({
        deviceRegistration: {
          description: 'Complete device registration workflow with certificate generation',
          apiEndpoint: 'POST /devices/register',
          steps: [
            {
              step: 1,
              action: 'createKeysAndCertificate',
              description: 'Generate AWS-managed X.509 certificate and private key',
              service: 'iot:CreateKeysAndCertificate'
            },
            {
              step: 2,
              action: 'createThing',
              description: 'Create IoT Thing for ESP32 receiver',
              service: 'iot:CreateThing'
            },
            {
              step: 3,
              action: 'attachPolicy',
              description: 'Attach receiver policy to certificate',
              service: 'iot:AttachPolicy',
              policyName: `AcornPupsReceiverPolicy-${props.environment}`
            },
            {
              step: 4,
              action: 'attachThingPrincipal',
              description: 'Attach certificate to Thing as principal',
              service: 'iot:AttachThingPrincipal'
            }
          ]
        },
        deviceReset: {
          description: 'Device cleanup workflow for factory reset',
          apiEndpoint: 'POST /devices/{deviceId}/reset',
          steps: [
            {
              step: 1,
              action: 'listThingPrincipals',
              description: 'List certificates attached to the Thing'
            },
            {
              step: 2,
              action: 'detachPolicy',
              description: 'Detach policies from certificates'
            },
            {
              step: 3,
              action: 'detachThingPrincipal',
              description: 'Detach certificates from the Thing'
            },
            {
              step: 4,
              action: 'updateCertificate',
              description: 'Set certificate status to INACTIVE'
            },
            {
              step: 5,
              action: 'deleteCertificate',
              description: 'Delete the certificate'
            },
            {
              step: 6,
              action: 'deleteThing',
              description: 'Delete the IoT Thing'
            }
          ]
        }
      }),
      'Certificate and policy management workflows',
      `/acorn-pups/${props.environment}/iot-core/certificate-management-workflow`
    );
  }
} 