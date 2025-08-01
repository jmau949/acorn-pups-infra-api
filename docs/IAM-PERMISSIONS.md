# Acorn Pups - IAM Permissions Documentation

## Overview

This document details the comprehensive IAM permissions structure for the Acorn Pups Lambda functions. Permissions are grouped by function type to follow the principle of least privilege while preventing any access errors.

## Permission Groups

### 1. **IoT Device Management Policy**
**Purpose**: Certificate and Thing lifecycle management  
**Used by**: `register-device` (with Echo/Nest reset security)

**Permissions**:
```typescript
// Certificate Management
'iot:CreateKeysAndCertificate',     // Create AWS-managed certificates
'iot:DeleteCertificate',            // Remove certificates during reset
'iot:UpdateCertificate',            // Deactivate certificates
'iot:DescribeCertificate',          // Verify certificate details
'iot:ListCertificates',             // List certificates for management

// Thing Management
'iot:CreateThing',                  // Create IoT Thing for device
'iot:DeleteThing',                  // Remove Thing during reset
'iot:DescribeThing',                // Verify Thing creation
'iot:ListThings',                   // Device discovery/validation
'iot:UpdateThing',                  // Modify Thing properties

// Policy and Principal Management
'iot:AttachPolicy',                 // Attach device policy to certificate
'iot:DetachPolicy',                 // Remove policy during reset
'iot:AttachThingPrincipal',         // Link certificate to Thing
'iot:DetachThingPrincipal',         // Unlink during reset
'iot:ListThingPrincipals',          // List certificates attached to Thing
'iot:ListPrincipalThings',          // List Things attached to certificate
'iot:GetPolicy',                    // Verify policy details
'iot:ListPolicies',                 // Policy management

// IoT Core Information
'iot:DescribeEndpoint',             // Get IoT endpoint for devices

// Communication for reset commands
'iot:Publish',                      // Send reset commands to devices
```

**Resources**: `*` (IoT resources are region-scoped)

### 2. **IoT Communication Policy**
**Purpose**: MQTT message publishing to devices  
**Used by**: `update-device-settings`

**Permissions**:
```typescript
'iot:Publish',                      // Publish settings to device topics
'iot:DescribeEndpoint',             // Get IoT endpoint information
```

**Resources**:
- `arn:aws:iot:region:account:topic/acorn-pups/*`
- `arn:aws:iot:region:account:*/endpoint/*`

### 3. **Data Access Policy**
**Purpose**: Comprehensive DynamoDB operations  
**Used by**: All Lambda functions

**Permissions**:
```typescript
// Core DynamoDB operations
'dynamodb:GetItem',                 // Read single items
'dynamodb:PutItem',                 // Create new items
'dynamodb:UpdateItem',              // Modify existing items
'dynamodb:DeleteItem',              // Remove items
'dynamodb:Query',                   // Query tables and indexes
'dynamodb:Scan',                    // Full table scans (if needed)
'dynamodb:BatchGetItem',            // Efficient multi-item reads
'dynamodb:BatchWriteItem',          // Efficient multi-item writes

// Transaction operations
'dynamodb:TransactGetItems',        // Atomic multi-item reads
'dynamodb:TransactWriteItems',      // Atomic multi-item writes

// Conditional operations
'dynamodb:ConditionCheckItem',      // Conditional checks

// Table information
'dynamodb:DescribeTable',           // Get table metadata
'dynamodb:ListTables',              // List available tables
```

**Resources**:
- `arn:aws:dynamodb:region:account:table/acorn-pups-{environment}-*`
- `arn:aws:dynamodb:region:account:table/acorn-pups-{environment}-*/index/*`
- `arn:aws:dynamodb:region:account:table/AcornPups*` (legacy patterns)
- `arn:aws:dynamodb:region:account:table/AcornPups*/index/*`

### 4. **Notification Policy**
**Purpose**: Push notifications and email sending  
**Used by**: `handle-button-press`, `invite-user`

**Permissions**:
```typescript
// SNS Push Notifications
'sns:Publish',                      // Send push notifications
'sns:CreatePlatformEndpoint',       // Register device endpoints
'sns:DeleteEndpoint',               // Remove device endpoints
'sns:GetEndpointAttributes',        // Get endpoint information
'sns:SetEndpointAttributes',        // Update endpoint settings
'sns:ListEndpointsByPlatformApplication', // List registered endpoints
'sns:CreateTopic',                  // Create notification topics
'sns:DeleteTopic',                  // Remove topics
'sns:Subscribe',                    // Subscribe to topics
'sns:Unsubscribe',                  // Unsubscribe from topics
'sns:ListSubscriptions',            // List subscriptions
'sns:ListTopics',                   // List available topics

// SES Email (for invitations)
'ses:SendEmail',                    // Send plain emails
'ses:SendRawEmail',                 // Send raw emails
'ses:SendTemplatedEmail',           // Send templated emails
'ses:GetSendQuota',                 // Check sending limits
'ses:GetSendStatistics',            // Get sending statistics
```

**Resources**:
- `arn:aws:sns:region:account:acorn-pups-{environment}-*`
- `arn:aws:ses:region:account:identity/*`
- `*` (for dynamically created SNS endpoints)

### 5. **Common Base Policy**
**Purpose**: Basic operations needed by all functions  
**Used by**: All Lambda functions

**Permissions**:
```typescript
// Parameter Store Access
'ssm:GetParameter',                 // Read single parameters
'ssm:GetParameters',                // Read multiple parameters
'ssm:GetParametersByPath',          // Read parameter hierarchies
'ssm:PutParameter',                 // Create/update parameters
'ssm:DeleteParameter',              // Remove parameters

// CloudWatch Logs
'logs:CreateLogGroup',              // Create log groups
'logs:CreateLogStream',             // Create log streams
'logs:PutLogEvents',                // Write log events
'logs:DescribeLogGroups',           // Get log group info
'logs:DescribeLogStreams',          // Get log stream info
```

**Resources**:
- `arn:aws:ssm:region:account:parameter/acorn-pups/{environment}/*`
- `arn:aws:logs:region:account:log-group:/aws/lambda/acorn-pups-{environment}-*`

## IAM Roles and Function Assignments

### 1. **BaseLambdaRole**
**Functions**: 
- `health-check`
- `get-user-devices`
- `update-device-status`
- `remove-user-access`
- `get-user-invitations`
- `accept-invitation`
- `decline-invitation`
- `handle-device-lifecycle`

**Policies**:
- AWS Managed: `AWSLambdaBasicExecutionRole`
- Inline: `CommonBasePolicy`, `DataAccess`

### 2. **IoTDeviceManagementRole**
**Functions**:
- `register-device` (with Echo/Nest reset security)

**Policies**:
- AWS Managed: `AWSLambdaBasicExecutionRole`
- Inline: `CommonBasePolicy`, `DataAccess`, `IoTDeviceManagement`

### 3. **IoTCommunicationRole**
**Functions**:
- `update-device-settings`

**Policies**:
- AWS Managed: `AWSLambdaBasicExecutionRole`
- Inline: `CommonBasePolicy`, `DataAccess`, `IoTCommunication`

### 4. **NotificationRole**
**Functions**:
- `handle-button-press`
- `invite-user`

**Policies**:
- AWS Managed: `AWSLambdaBasicExecutionRole`
- Inline: `CommonBasePolicy`, `DataAccess`, `Notifications`

## Resource Access Patterns

### DynamoDB Tables
All functions can access:
- `acorn-pups-{environment}-users`
- `acorn-pups-{environment}-devices`
- `acorn-pups-{environment}-device-users`
- `acorn-pups-{environment}-invitations`
- `acorn-pups-{environment}-device-status`

### IoT Topics
Communication functions can publish to:
- `acorn-pups/button-press/{deviceId}`
- `acorn-pups/settings/{deviceId}`
- `acorn-pups/commands/{deviceId}`
- `acorn-pups/status/{deviceId}`

### SNS Topics
Notification functions can access:
- `acorn-pups-{environment}-button-press-notifications`
- `acorn-pups-{environment}-device-alerts`
- Platform-specific endpoints (iOS/Android)

## Security Considerations

### Principle of Least Privilege
- Each function only receives permissions it actually needs
- IoT certificate management limited to device lifecycle functions
- Communication permissions separated from management permissions
- Notification permissions isolated to relevant functions

### Resource Scoping
- DynamoDB access limited to Acorn Pups tables
- IoT topics scoped to acorn-pups namespace
- SNS resources scoped to environment-specific naming
- Parameter Store access limited to project hierarchy

### Cross-Environment Isolation
- All resource ARNs include environment parameter
- No cross-environment access possible
- Environment-specific role names prevent conflicts

## Troubleshooting

### Common Permission Issues

1. **Certificate Creation Fails**
   - Check: `iot:CreateKeysAndCertificate` in IoT Device Management role
   - Verify: Function is using `iotDeviceManagementRole`

2. **Settings Update Fails**
   - Check: `iot:Publish` in IoT Communication role
   - Verify: Topic ARN format matches policy resources

3. **Push Notification Fails**
   - Check: `sns:Publish` in Notification role
   - Verify: Platform endpoint exists and is enabled

4. **DynamoDB Access Denied**
   - Check: Table name matches pattern in Data Access policy
   - Verify: Operation type is included in policy actions

### CloudFormation Outputs
The following outputs are available for cross-stack references:

```yaml
Exports:
  - acorn-pups-{environment}-base-lambda-role-arn
  - acorn-pups-{environment}-iot-device-mgmt-role-arn
  - acorn-pups-{environment}-iot-comm-role-arn
  - acorn-pups-{environment}-notification-role-arn
```

### Parameter Store Locations
Role ARNs are stored in Parameter Store:

```
/acorn-pups/{environment}/lambda-functions/base-role/arn
/acorn-pups/{environment}/lambda-functions/iot-device-mgmt-role/arn
/acorn-pups/{environment}/lambda-functions/iot-comm-role/arn
/acorn-pups/{environment}/lambda-functions/notification-role/arn
```

## Deployment Order

1. **First**: Deploy this API infrastructure stack
2. **Second**: Deploy IoT infrastructure stack (can reference these roles)
3. **Third**: Deploy monitoring and pipeline stacks

The IoT infrastructure stack can import these role ARNs using CloudFormation imports or Parameter Store lookups. 