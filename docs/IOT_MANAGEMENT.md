# IoT Device Management

This document covers the complete IoT device management capabilities provided by the Acorn Pups API infrastructure, including device registration, certificate lifecycle, and security policies.

## Overview

The API repository now manages the complete device lifecycle to ensure clean separation of concerns and avoid circular dependencies:

- **Device Certificate Generation**: Creates AWS-managed X.509 certificates
- **IoT Policy Management**: Defines and enforces device security policies
- **Thing Management**: Creates and manages IoT Things for device metadata
- **Certificate Cleanup**: Handles device reset and certificate revocation
- **IoT Rule Execution**: Provides execution role for IoT rules (defined in IoT repository)

## Architecture

### Repository Responsibilities

```
acorn-pups-infra-api (this repository):
├── IoT Policies (device security)
├── Certificate Lifecycle Management
├── Device Registration/Reset APIs
├── IoT Rule Execution Role
└── Lambda Functions

acorn-pups-infra-iot:
├── IoT Rules (message routing)
├── Thing Types (device schemas)
├── Monitoring & Dashboards
└── S3 Bucket (certificate backups)
```

### Device Security Model

Each ESP32 receiver device gets:
- **Unique X.509 Certificate**: AWS-managed, automatically generated
- **IoT Thing**: Metadata container with device attributes
- **Security Policy**: Device-scoped permissions for MQTT topics
- **Client ID Pattern**: Must match `acorn-pups-*` for connections

## IoT Policy Configuration

### Policy Structure

The `AcornPupsReceiverPolicy` enforces minimal security principles:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "iot:Connect",
      "Resource": "arn:aws:iot:region:account:client/acorn-pups-*",
      "Condition": {
        "StringEquals": {
          "iot:Connection.Thing.IsAttached": "true"
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": "iot:Publish",
      "Resource": [
        "arn:aws:iot:region:account:topic/acorn-pups/button-press/${iot:ClientId}",
        "arn:aws:iot:region:account:topic/acorn-pups/status/${iot:ClientId}",
        "arn:aws:iot:region:account:topic/acorn-pups/commands/${iot:ClientId}/reset"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["iot:Subscribe", "iot:Receive"],
      "Resource": [
        "arn:aws:iot:region:account:topic/acorn-pups/settings/${iot:ClientId}",
        "arn:aws:iot:region:account:topic/acorn-pups/commands/${iot:ClientId}",
        "arn:aws:iot:region:account:topic/acorn-pups/firmware/${iot:ClientId}"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["iot:UpdateThingShadow", "iot:GetThingShadow"],
      "Resource": "arn:aws:iot:region:account:thing/${iot:ClientId}",
      "Condition": {
        "StringEquals": {
          "iot:Connection.Thing.IsAttached": "true"
        }
      }
    }
  ]
}
```

### Security Features

1. **Thing Attachment Required**: Devices must be properly registered Things to connect
2. **Device-Scoped Topics**: Each device can only access topics with its own `ClientId`
3. **Minimal Permissions**: Only necessary actions are allowed
4. **Client ID Validation**: Must match `acorn-pups-*` pattern

## Device Registration Workflow

### API Endpoint: `POST /devices/register`

#### Request
```json
{
  "deviceId": "acorn-pups-receiver-001",
  "deviceName": "Kitchen Acorn Pups Button",
  "serialNumber": "ESP32-001",
  "macAddress": "AA:BB:CC:DD:EE:FF"
}
```

#### Lambda Function Process

1. **Generate Certificate**:
   ```javascript
   const certResponse = await iot.createKeysAndCertificate({
     setAsActive: true
   }).promise();
   ```

2. **Create IoT Thing**:
   ```javascript
   await iot.createThing({
     thingName: deviceId,
     thingTypeName: `AcornPupsReceiver-${environment}`,
     attributePayload: {
       attributes: {
         deviceName,
         serialNumber,
         macAddress,
         registeredAt: new Date().toISOString()
       }
     }
   }).promise();
   ```

3. **Attach Policy**:
   ```javascript
   await iot.attachPolicy({
     policyName: `AcornPupsReceiverPolicy-${environment}`,
     target: certificateArn
   }).promise();
   ```

4. **Attach Certificate to Thing**:
   ```javascript
   await iot.attachThingPrincipal({
     thingName: deviceId,
     principal: certificateArn
   }).promise();
   ```

5. **Store Certificate Backup**:
   ```javascript
   await s3.putObject({
     Bucket: certificateBucketName,
     Key: `devices/${deviceId}/certificate.pem`,
     Body: certificatePem,
     ServerSideEncryption: 'AES256'
   }).promise();
   ```

#### Response
```json
{
  "data": {
    "deviceId": "acorn-pups-receiver-001",
    "certificatePem": "-----BEGIN CERTIFICATE-----\n...",
    "privateKey": "-----BEGIN RSA PRIVATE KEY-----\n...",
    "iotEndpoint": "a1b2c3d4e5f6g7-ats.iot.us-east-1.amazonaws.com",
    "certificateArn": "arn:aws:iot:us-east-1:123456789012:cert/abc123"
  },
  "requestId": "12345678-1234-1234-1234-123456789012"
}
```

## Device Reset Workflow

### API Endpoint: `POST /devices/{deviceId}/reset`

#### Lambda Function Process

1. **List Thing Principals**:
   ```javascript
   const principals = await iot.listThingPrincipals({
     thingName: deviceId
   }).promise();
   ```

2. **Detach Policies and Principals**:
   ```javascript
   for (const principal of principals.principals) {
     // Detach policy from certificate
     await iot.detachPolicy({
       policyName: `AcornPupsReceiverPolicy-${environment}`,
       target: principal
     }).promise();
     
     // Detach certificate from Thing
     await iot.detachThingPrincipal({
       thingName: deviceId,
       principal
     }).promise();
   }
   ```

3. **Deactivate and Delete Certificates**:
   ```javascript
   for (const principal of principals.principals) {
     const certificateId = principal.split('/').pop();
     
     // Set to inactive
     await iot.updateCertificate({
       certificateId,
       newStatus: 'INACTIVE'
     }).promise();
     
     // Delete certificate
     await iot.deleteCertificate({
       certificateId,
       forceDelete: true
     }).promise();
   }
   ```

4. **Delete IoT Thing**:
   ```javascript
   await iot.deleteThing({
     thingName: deviceId
   }).promise();
   ```

5. **Clean S3 Backups**:
   ```javascript
   await s3.deleteObject({
     Bucket: certificateBucketName,
     Key: `devices/${deviceId}/certificate.pem`
   }).promise();
   ```

## MQTT Topic Structure

### Device-to-Cloud Topics (Publish)

- **Button Press**: `acorn-pups/button-press/{deviceId}`
  - Real-time button press events for notifications
  - Processed by `handle-button-press` Lambda function

- **Status Updates**: `acorn-pups/status/{deviceId}`
  - Device health, battery, connectivity status
  - Processed by `update-device-status` Lambda function

- **Reset Notifications**: `acorn-pups/commands/{deviceId}/reset`
  - Factory reset initiated from device
  - Processed by `factory-reset` Lambda function

### Cloud-to-Device Topics (Subscribe)

- **Settings Updates**: `acorn-pups/settings/{deviceId}`
  - Configuration changes from mobile app
  - Published by `update-device-settings` Lambda function

- **Commands**: `acorn-pups/commands/{deviceId}`
  - General device commands and control

- **Firmware Updates**: `acorn-pups/firmware/{deviceId}`
  - OTA firmware update notifications

### Thing Shadow

- **Shadow Resource**: `arn:aws:iot:region:account:thing/{deviceId}`
- **Operations**: `GetThingShadow`, `UpdateThingShadow`
- **Use Case**: Device configuration synchronization

## Lambda Function Roles

### IoT Device Management Role

Used by: `register-device`, `reset-device`, `factory-reset`

**Permissions**:
- `iot:CreateKeysAndCertificate`
- `iot:DeleteCertificate`
- `iot:UpdateCertificate`
- `iot:CreateThing`
- `iot:DeleteThing`
- `iot:AttachPolicy`
- `iot:DetachPolicy`
- `iot:AttachThingPrincipal`
- `iot:DetachThingPrincipal`
- `iot:ListThingPrincipals`
- `iot:DescribeEndpoint`
- `iot:Publish`
- `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` (certificate bucket)

### IoT Communication Role

Used by: `update-device-settings`

**Permissions**:
- `iot:Publish`
- `iot:DescribeEndpoint`

### IoT Rule Execution Role

Used by: IoT Rules (defined in IoT repository)

**Permissions**:
- `lambda:InvokeFunction` (all Acorn Pups Lambda functions)
- `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents`
- `ssm:GetParameter` (Parameter Store access)
- `sns:Publish` (notification publishing)

## Parameter Store Integration

### IoT Policy Parameters

- `/acorn-pups/{environment}/iot-core/receiver-policy/arn`
- `/acorn-pups/{environment}/iot-core/receiver-policy/name`

### IoT Rule Execution Role Parameters

- `/acorn-pups/{environment}/iot-core/rule-execution-role/arn`
- `/acorn-pups/{environment}/iot-core/rule-execution-role/name`

### MQTT Topic Structure

- `/acorn-pups/{environment}/iot-core/mqtt-topics`

### Security Configuration

- `/acorn-pups/{environment}/iot-core/security-config`
- `/acorn-pups/{environment}/iot-core/api-integration`

## Device Configuration

### ESP32 Receiver Setup

When a device is registered, configure it with:

1. **Certificate Files**:
   - `device-cert.pem` (from registration response)
   - `device-private-key.pem` (from registration response)
   - `AmazonRootCA1.pem` (download from AWS)

2. **Connection Parameters**:
   - **IoT Endpoint**: From registration response
   - **Client ID**: Must match the `deviceId` used in registration
   - **Port**: 8883 (MQTT over TLS)

3. **Security Configuration**:
   - Use TLS 1.2
   - Verify server certificate against Root CA
   - Use device certificate for client authentication

### Example Arduino/ESP32 Code

```cpp
#include <WiFiClientSecure.h>
#include <PubSubClient.h>

const char* iot_endpoint = "a1b2c3d4e5f6g7-ats.iot.us-east-1.amazonaws.com";
const char* device_id = "acorn-pups-receiver-001";

// Certificate and key (stored securely in flash)
extern const char device_cert[] asm("_binary_device_cert_pem_start");
extern const char device_key[] asm("_binary_device_key_pem_start");
extern const char root_ca[] asm("_binary_root_ca_pem_start");

WiFiClientSecure wifiClient;
PubSubClient mqttClient(wifiClient);

void setup() {
  wifiClient.setCACert(root_ca);
  wifiClient.setCertificate(device_cert);
  wifiClient.setPrivateKey(device_key);
  
  mqttClient.setServer(iot_endpoint, 8883);
  mqttClient.setCallback(messageCallback);
}

void publishButtonPress() {
  String topic = "acorn-pups/button-press/" + String(device_id);
  String payload = "{\"deviceId\":\"" + String(device_id) + "\",\"timestamp\":\"" + getTimestamp() + "\"}";
  mqttClient.publish(topic.c_str(), payload.c_str());
}
```

## Troubleshooting

### Common Issues

1. **Certificate Not Found**:
   - Verify API repository is deployed
   - Check Parameter Store for IoT policy ARN

2. **Device Connection Refused**:
   - Verify Client ID matches registered device ID
   - Check certificate is attached to Thing
   - Ensure policy is attached to certificate

3. **MQTT Publish Permission Denied**:
   - Verify topic follows `acorn-pups/{message-type}/{deviceId}` pattern
   - Check device is using correct Client ID

4. **IoT Rule Execution Failures**:
   - Verify IoT Rule Execution Role has correct permissions
   - Check Lambda function ARNs in Parameter Store

### Debugging Commands

```bash
# Check IoT policy exists
aws iot get-policy --policy-name "AcornPupsReceiverPolicy-dev"

# List device certificates
aws iot list-thing-principals --thing-name "acorn-pups-receiver-001"

# Check certificate status
aws iot describe-certificate --certificate-id "abc123def456"

# Test MQTT publish (requires valid certificate)
aws iot publish --topic "acorn-pups/button-press/test-device" --payload '{"test": true}'

# Check IoT logs
aws logs describe-log-groups --log-group-name-prefix "/aws/iot/"
```

## Security Considerations

### Production Security

- **Certificate Storage**: Store device certificates securely in ESP32 flash encryption
- **Private Key Protection**: Never log or transmit private keys
- **Client ID Validation**: Ensure Client ID matches Thing name exactly
- **Topic Scoping**: Devices can only access their own topic paths
- **Connection Monitoring**: Monitor failed connection attempts

### Development Security

- **Separate Accounts**: Use different AWS accounts for dev/prod
- **Short Certificate Expiry**: Use shorter expiration periods for development
- **Verbose Logging**: Enable detailed logging for debugging
- **Test Cleanup**: Regularly clean up test devices and certificates

## Cost Optimization

### Message Costs
- **IoT Core Pricing**: $1.00 per million messages published or delivered
- **Optimization**: Batch device status updates, avoid unnecessary messages

### Certificate Management
- **AWS Managed**: No additional cost for certificate generation
- **Storage**: S3 costs for certificate backups (minimal)

### Monitoring
- **CloudWatch Logs**: Monitor log retention policies
- **Metrics**: Use custom metrics judiciously to control costs

---

This document provides comprehensive coverage of IoT device management in the Acorn Pups API infrastructure. For questions or issues, refer to the troubleshooting section or create a GitHub issue. 