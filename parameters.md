# Acorn Pups Infrastructure Parameters

This document lists all Parameter Store parameters used and created by this repository.

## Parameter Store Path Structure

```
/acorn-pups/{environment}/
├── cfn-outputs/           # CloudFormation outputs (API repo)
├── iot-outputs/           # IoT CloudFormation outputs (IoT repo)
├── lambda-functions/      # Lambda function ARNs and names
├── iot-core/             # IoT Core resources
├── rf-buttons/           # RF button information
└── device-architecture/  # Device architecture info
```

---

## Infrastructure API Repository

### Parameters **REQUIRED** by this repository:
- None currently (repository is standalone)

### Parameters **CREATED** by this repository:

#### Lambda Functions Stack (`/acorn-pups/{environment}/lambda-functions/`)
- `handleButtonPress/arn` - ARN of the handle button press Lambda function
- `handleButtonPress/name` - Name of the handle button press Lambda function
- `healthCheck/arn` - ARN of the health check Lambda function
- `healthCheck/name` - Name of the health check Lambda function
- `registerDevice/arn` - ARN of the register device Lambda function
- `registerDevice/name` - Name of the register device Lambda function
- `getUserDevices/arn` - ARN of the get user devices Lambda function
- `getUserDevices/name` - Name of the get user devices Lambda function
- `updateDeviceSettings/arn` - ARN of the update device settings Lambda function
- `updateDeviceSettings/name` - Name of the update device settings Lambda function
- `updateDeviceStatus/arn` - ARN of the update device status Lambda function
- `updateDeviceStatus/name` - Name of the update device status Lambda function
- `resetDevice/arn` - ARN of the reset device Lambda function
- `resetDevice/name` - Name of the reset device Lambda function
- `inviteUser/arn` - ARN of the invite user Lambda function
- `inviteUser/name` - Name of the invite user Lambda function
- `removeUserAccess/arn` - ARN of the remove user access Lambda function
- `removeUserAccess/name` - Name of the remove user access Lambda function
- `getUserInvitations/arn` - ARN of the get user invitations Lambda function
- `getUserInvitations/name` - Name of the get user invitations Lambda function
- `acceptInvitation/arn` - ARN of the accept invitation Lambda function
- `acceptInvitation/name` - Name of the accept invitation Lambda function
- `declineInvitation/arn` - ARN of the decline invitation Lambda function
- `declineInvitation/name` - Name of the decline invitation Lambda function
- `execution-role/arn` - ARN of the Lambda execution role

#### API Gateway Stack (`/acorn-pups/{environment}/cfn-outputs/api-gateway/`)
- `api-url` - API Gateway URL
- `api-id` - API Gateway ID
- `usage-plan-id` - Usage Plan ID for API keys
- `api-name` - API Gateway name
- `api-stage` - API Gateway deployment stage

#### Monitoring Stack (`/acorn-pups/{environment}/cfn-outputs/monitoring/`)
- `dashboard-url` - CloudWatch Dashboard URL
- `alarm-topic-arn` - SNS Topic ARN for alarms
- `dashboard-name` - CloudWatch Dashboard name
- `alarm-topic-name` - SNS Topic name for alarms

#### Pipeline Stack (`/acorn-pups/{environment}/cfn-outputs/pipeline/`)
- `pipeline-name` - CI/CD Pipeline name
- `pipeline-arn` - CI/CD Pipeline ARN
- `source-bucket-name` - Source artifacts bucket name
- `source-bucket-arn` - Source artifacts bucket ARN

---

## IoT Infrastructure Repository

### Parameters **REQUIRED** by this repository:
- `/acorn-pups/{environment}/lambda-functions/handleButtonPress/arn` - ✅ **EXISTS** in API repo
- `/acorn-pups/{environment}/lambda-functions/updateDeviceStatus/arn` - ✅ **EXISTS** in API repo
- `/acorn-pups/{environment}/lambda-functions/resetDevice/arn` - ✅ **EXISTS** in API repo

### Parameters **CREATED** by this repository:

#### Thing Types Stack (`/acorn-pups/{environment}/iot-core/`)
- `thing-type/receiver/arn` - ARN of the AcornPupsReceiver Thing Type
- `thing-type/receiver/name` - Name of the AcornPupsReceiver Thing Type
- `thing-type/receiver/description` - Description of the AcornPupsReceiver Thing Type
- `thing-type/receiver/searchable-attributes` - Searchable attributes for the Thing Type
- `rf-buttons/info` - RF Button technical information
- `device-architecture` - Device architecture information

#### Policy Stack (`/acorn-pups/{environment}/iot-core/`)
- `receiver-policy/arn` - ARN of the AcornPupsReceiver Policy
- `receiver-policy/name` - Name of the AcornPupsReceiver Policy
- `rule-execution-role/arn` - ARN of the IoT Rule Execution Role
- `rule-execution-role/name` - Name of the IoT Rule Execution Role
- `client-id-pattern` - Client ID pattern for IoT receiver connections
- `mqtt-topics` - MQTT topic structure for Acorn Pups system

#### Rules Stack (`/acorn-pups/{environment}/iot-core/`)
- `rules/buttonPress/arn` - ARN of the Button Press IoT Rule
- `rules/buttonPress/name` - Name of the Button Press IoT Rule
- `rules/deviceStatus/arn` - ARN of the Device Status IoT Rule
- `rules/deviceStatus/name` - Name of the Device Status IoT Rule
- `rules/deviceReset/arn` - ARN of the Device Reset IoT Rule
- `rules/deviceReset/name` - Name of the Device Reset IoT Rule
- `rule-configuration` - IoT Rule configuration details
- `lambda-function-requirements` - Lambda function requirements for IoT rules
- `rule-topics` - MQTT topics monitored by IoT Rules
- `log-group-prefix` - CloudWatch Log Group prefix for IoT Rules

#### Certificate Management Stack (`/acorn-pups/{environment}/iot-core/`)
- `certificate-bucket/name` - S3 bucket for storing device metadata
- `certificate-bucket/arn` - ARN of the S3 bucket for certificates
- `endpoint` - AWS IoT Core endpoint for certificate management
- `data-endpoint` - AWS IoT Core data endpoint for ESP32 receivers
- `certificate-type` - Certificate type (AWS_MANAGED)
- `certificate-expiration-days` - Certificate expiration days
- `receiver-certificate-config` - ESP32 receiver certificate configuration
- `certificate-generation-workflow` - Certificate generation workflow
- `receiver-certificate-files` - Required certificate files for ESP32 receivers
- `amazon-root-ca` - Amazon Root CA information
- `certificate-security-best-practices` - Certificate security best practices

#### Monitoring Stack (`/acorn-pups/{environment}/iot-outputs/monitoring/`)
- `iot-dashboard-name` - IoT CloudWatch Dashboard name
- `iot-dashboard-url` - IoT CloudWatch Dashboard URL
- `iot-alarm-topic-arn` - IoT SNS Topic ARN for alarms
- `iot-alarm-topic-name` - IoT SNS Topic name for alarms

---