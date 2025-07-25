import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { IoTClient, CreateKeysAndCertificateCommand, CreateThingCommand, AttachPolicyCommand, AttachThingPrincipalCommand, DescribeEndpointCommand, UpdateCertificateCommand, DeleteCertificateCommand, DetachPolicyCommand, DetachThingPrincipalCommand, DeleteThingCommand } from '@aws-sdk/client-iot';
import { CloudWatchClient, PutMetricDataCommand, StandardUnit } from '@aws-sdk/client-cloudwatch';
import { v4 as uuidv4 } from 'uuid';
import ResponseHandler from '../shared/response-handler';
import { DynamoDBHelper, DynamoDBError } from '../shared/dynamodb-client';
import { DeviceMetadata, DeviceSettings, DeviceUser, ValidationError, ApiErrorResponse } from '../shared/types';

// ==== Device Registration Types (specific to this lambda) ====

interface DeviceRegistrationRequest {
  deviceId: string;
  deviceInstanceId: string; // UUID generated each factory reset cycle
  deviceName: string;
  serialNumber: string;
  macAddress: string;
  deviceState: 'normal' | 'factory_reset'; // Indicates if reset occurred
  resetTimestamp?: string; // When factory reset occurred
}

interface DeviceCertificates {
  deviceCertificate: string;
  privateKey: string;
  iotEndpoint: string;
}

interface DeviceRegistrationResponse {
  deviceId: string;
  deviceInstanceId: string;
  deviceName: string;
  serialNumber: string;
  ownerId: string;
  registeredAt: string;
  lastResetAt?: string; // Last factory reset timestamp
  ownershipTransferred: boolean; // Whether ownership was transferred
  status: 'pending' | 'active';
  certificates: DeviceCertificates;
}

// Device Conflict Response (for reset security)
interface DeviceConflictResponse extends ApiErrorResponse {
  resetInstructions: string[];
  supportUrl: string;
}

// Initialize AWS clients
const iotClient = new IoTClient({
  region: process.env.REGION || 'us-east-1',
});

const cloudWatchClient = new CloudWatchClient({
  region: process.env.REGION || 'us-east-1',
});

/**
 * Device Registration with Echo/Nest-Style Reset Security
 * 
 * Implements industry-standard reset security pattern:
 * - For new devices: Normal registration with device instance ID
 * - For existing devices: Requires proof of factory reset (new device instance ID + factory_reset state)
 * - Prevents remote takeover by validating physical reset occurred
 * - Automatically handles certificate revocation and ownership transfer
 * - Includes CloudWatch monitoring for certificate cleanup failures
 * - Robust transaction handling with proper rollback mechanisms
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = ResponseHandler.getRequestId(event);
  
  try {
    ResponseHandler.logRequest(event, context);

    // Parse and validate request body
    const body = ResponseHandler.parseBody<DeviceRegistrationRequest>(event);
    if (!body) {
      return ResponseHandler.badRequest('Request body is required', requestId);
    }

    const { deviceId, deviceInstanceId, deviceName, serialNumber, macAddress, deviceState, resetTimestamp } = body;

    // Validate required fields
    const validationErrors: ValidationError[] = [];
    
    if (!deviceId) validationErrors.push({ field: 'deviceId', message: 'Device ID is required' });
    if (!deviceInstanceId) validationErrors.push({ field: 'deviceInstanceId', message: 'Device instance ID is required' });
    if (!deviceName) validationErrors.push({ field: 'deviceName', message: 'Device name is required' });
    if (!serialNumber) validationErrors.push({ field: 'serialNumber', message: 'Serial number is required' });
    if (!macAddress) validationErrors.push({ field: 'macAddress', message: 'MAC address is required' });
    if (!deviceState) validationErrors.push({ field: 'deviceState', message: 'Device state is required' });
    
    if (validationErrors.length > 0) {
      return ResponseHandler.validationError('Request validation failed', validationErrors, requestId);
    }

    // Validate field formats
    const deviceIdPattern = /^[a-zA-Z0-9\-_\.@#+]+$/;
    const deviceNamePattern = /^[\p{L}\p{N}\p{P}\p{Z}]+$/u;
    const serialNumberPattern = /^[\w\-.@#+&(){}[\]/\\|*%$!~`'"<>?=^]+$/;
    const macAddressPattern = /^([0-9A-Fa-f]{2}[:.\-]?){5}[0-9A-Fa-f]{2}$|^[0-9A-Fa-f]{12}$/;
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!deviceIdPattern.test(deviceId)) {
      validationErrors.push({ field: 'deviceId', message: 'Device ID contains invalid characters' });
    }
    
    if (!uuidPattern.test(deviceInstanceId)) {
      validationErrors.push({ field: 'deviceInstanceId', message: 'Device instance ID must be a valid UUID' });
    }

    if (deviceName.length < 1 || deviceName.length > 100 || !deviceNamePattern.test(deviceName)) {
      validationErrors.push({ field: 'deviceName', message: 'Device name format is invalid or too long (max 100 characters)' });
    }

    if (serialNumber.length < 1 || serialNumber.length > 100 || !serialNumberPattern.test(serialNumber)) {
      validationErrors.push({ field: 'serialNumber', message: 'Serial number format is invalid or too long (max 100 characters)' });
    }

    if (!macAddressPattern.test(macAddress)) {
      validationErrors.push({ field: 'macAddress', message: 'MAC address format is invalid' });
    }
    
    if (!['normal', 'factory_reset'].includes(deviceState)) {
      validationErrors.push({ field: 'deviceState', message: 'Device state must be "normal" or "factory_reset"' });
    }
    
    if (deviceState === 'factory_reset' && !resetTimestamp) {
      validationErrors.push({ field: 'resetTimestamp', message: 'Reset timestamp is required when device state is "factory_reset"' });
    }

    if (validationErrors.length > 0) {
      return ResponseHandler.validationError('Request validation failed', validationErrors, requestId);
    }

    // Get cognito_sub from JWT token
    const cognitoSub = event.requestContext.authorizer?.claims?.sub;
    if (!cognitoSub) {
      return ResponseHandler.unauthorized('Valid JWT token required', requestId);
    }

    // Look up user by cognito_sub
    const users = await DynamoDBHelper.getUserByCognitoSub(cognitoSub);
    if (!users || users.length === 0) {
      return ResponseHandler.unauthorized('User not found', requestId);
    }

    const user = users[0];
    const userId = user.user_id;
    console.log(`Device registration requested by user: ${userId}`);

    // Check if device with this serial number already exists
    const existingDevices = await DynamoDBHelper.getDeviceBySerial(serialNumber);
    
    if (existingDevices && existingDevices.length > 0) {
      const existingDevice = existingDevices[0] as DeviceMetadata;
      
      console.log(`Found existing device with serial ${serialNumber}:`, existingDevice);
      
      // Echo/Nest Reset Security Pattern Implementation
      if (deviceState === 'factory_reset' && existingDevice.device_instance_id !== deviceInstanceId) {
        // Valid reset detected - different instance ID proves physical reset occurred
        console.log(`Valid factory reset detected for device ${serialNumber} - proceeding with ownership transfer`);
        
        // This will be handled in the ownership transfer flow below
      } else if (existingDevice.device_instance_id === deviceInstanceId) {
        // Same instance ID - no reset occurred, this is likely an unauthorized registration attempt
        console.log(`Registration rejected: same device instance ID indicates no reset occurred`);
        
        return ResponseHandler.createResponse(409, undefined, 'device_already_registered', 
          'Device already registered to another user. Factory reset required for ownership transfer.', 
          requestId) as APIGatewayProxyResult;
      } else if (deviceState === 'normal') {
        // Device exists but no reset state provided
        console.log(`Registration rejected: device exists but no reset proof provided`);
        
        const conflictResponse: DeviceConflictResponse = {
          error: 'device_already_registered',
          message: 'Device already registered to another user. Factory reset required for ownership transfer.',
          requestId,
          resetInstructions: [
            'Press and hold the reset button on the device for 5 seconds',
            'Wait for the device LED to blink blue (setup mode)',
            'Try registration again through the mobile app'
          ],
          supportUrl: 'https://help.acornpups.com/reset-device'
        };
        
        return {
          statusCode: 409,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': requestId,
            'X-API-Version': '1.0',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify(conflictResponse),
        };
      }
    }

    const now = new Date().toISOString();
    let ownershipTransferred = false;
    let oldCertificateArn: string | undefined;

    // Handle ownership transfer if this is a valid reset
    if (existingDevices && existingDevices.length > 0 && deviceState === 'factory_reset') {
      const existingDevice = existingDevices[0] as DeviceMetadata;
      ownershipTransferred = true;
      oldCertificateArn = existingDevice.iot_certificate_arn;
      
      console.log(`Processing ownership transfer for device: ${existingDevice.device_id}`);
    }

    // Generate device UUID (use existing device_id if transferring ownership)
    const deviceUuid = existingDevices && existingDevices.length > 0 ? existingDevices[0].device_id : uuidv4();
    const iotThingName = `acorn-receiver-${deviceUuid}`;

    // Create new AWS IoT Core managed certificate
    console.log('Creating new IoT certificate...');
    const createCertCommand = new CreateKeysAndCertificateCommand({
      setAsActive: true,
    });
    const certResponse = await iotClient.send(createCertCommand);

    if (!certResponse.certificateArn || !certResponse.certificatePem || !certResponse.keyPair?.PrivateKey) {
      throw new Error('Failed to create IoT certificate');
    }

    // Create/Update IoT Thing
    console.log(`Creating/updating IoT Thing: ${iotThingName}`);
    const createThingCommand = new CreateThingCommand({
      thingName: iotThingName,
      thingTypeName: `AcornPupsReceiver-${process.env.ENVIRONMENT}`,
      attributePayload: {
        attributes: {
          deviceId: deviceUuid,
          serialNumber: serialNumber,
          macAddress: macAddress,
          ownerId: userId,
          deviceInstanceId: deviceInstanceId,
        },
      },
    });
    await iotClient.send(createThingCommand);

    // Attach device policy to certificate
    const policyName = `AcornPupsReceiverPolicy-${process.env.ENVIRONMENT}`;
    console.log(`Attaching policy: ${policyName}`);
    const attachPolicyCommand = new AttachPolicyCommand({
      policyName: policyName,
      target: certResponse.certificateArn,
    });
    await iotClient.send(attachPolicyCommand);

    // Attach certificate to Thing
    console.log('Attaching certificate to Thing...');
    const attachThingCommand = new AttachThingPrincipalCommand({
      thingName: iotThingName,
      principal: certResponse.certificateArn,
    });
    await iotClient.send(attachThingCommand);

    // Get IoT endpoint
    const endpointCommand = new DescribeEndpointCommand({
      endpointType: 'iot:Data-ATS',
    });
    const endpointResponse = await iotClient.send(endpointCommand);

    if (!endpointResponse.endpointAddress) {
      throw new Error('Failed to get IoT endpoint');
    }

    // Prepare transaction operations with improved resilience
    const transactionOperations = [];
    
    // If transferring ownership, prepare complete cleanup operations
    if (ownershipTransferred && existingDevices && existingDevices.length > 0) {
      const existingDevice = existingDevices[0] as DeviceMetadata;
      
      console.log('Preparing complete device cleanup for ownership transfer...');
      
      // Get all data that needs cleanup
      const [oldDeviceUsers, oldInvitations] = await Promise.all([
        DynamoDBHelper.getDeviceUsers(existingDevice.device_id),
        DynamoDBHelper.getDeviceInvitations(existingDevice.device_id)
      ]);
      
      console.log(`Found ${oldDeviceUsers.length} users and ${oldInvitations.length} invitations to clean up`);
      
      // Remove all old device users
      for (const deviceUser of oldDeviceUsers) {
        transactionOperations.push({
          action: 'Delete' as const,
          tableParam: 'device-users',
          key: { PK: `DEVICE#${existingDevice.device_id}`, SK: `USER#${deviceUser.user_id}` },
        });
      }
      
      // Remove all old invitations
      for (const invitation of oldInvitations) {
        transactionOperations.push({
          action: 'Delete' as const,
          tableParam: 'invitations',
          key: { PK: `INVITATION#${invitation.invitation_id}`, SK: 'METADATA' },
        });
      }
      
      // Remove old device settings (complete cleanup)
      transactionOperations.push({
        action: 'Delete' as const,
        tableParam: 'devices',
        key: { PK: `DEVICE#${existingDevice.device_id}`, SK: 'SETTINGS' },
      });
      
      // Remove old device status records (complete cleanup)
      const oldStatusRecords = await DynamoDBHelper.getAllDeviceStatus(existingDevice.device_id);
      for (const statusRecord of oldStatusRecords) {
        transactionOperations.push({
          action: 'Delete' as const,
          tableParam: 'device-status',
          key: { PK: `DEVICE#${existingDevice.device_id}`, SK: statusRecord.SK },
        });
      }
      
      console.log(`Prepared ${transactionOperations.length} cleanup operations`);
    }

    // Device metadata record (create or update)
    transactionOperations.push({
      action: 'Put' as const,
      tableParam: 'devices',
      item: {
        PK: `DEVICE#${deviceUuid}`,
        SK: 'METADATA',
        device_id: deviceUuid,
        device_instance_id: deviceInstanceId, // Store instance ID for reset security
        serial_number: serialNumber,
        mac_address: macAddress,
        device_name: deviceName,
        owner_user_id: userId,
        firmware_version: '1.0.0',
        hardware_version: '1.0',
        is_online: false,
        last_seen: now,
        wifi_ssid: '',
        signal_strength: 0,
        created_at: ownershipTransferred ? existingDevices![0].created_at : now,
        updated_at: now,
        last_reset_at: deviceState === 'factory_reset' ? resetTimestamp : undefined, // Track reset timestamp
        is_active: true,
        iot_thing_name: iotThingName,
        iot_certificate_arn: certResponse.certificateArn,
      },
    });

    // Device settings record (create or update)
    transactionOperations.push({
      action: 'Put' as const,
      tableParam: 'devices',
      item: {
        PK: `DEVICE#${deviceUuid}`,
        SK: 'SETTINGS',
        device_id: deviceUuid,
        sound_enabled: true,
        sound_volume: 7,
        led_brightness: 5,
        notification_cooldown: 30,
        quiet_hours_enabled: false,
        quiet_hours_start: '22:00',
        quiet_hours_end: '07:00',
        updated_at: now,
      },
    });

    // Device-user relationship (new owner)
    transactionOperations.push({
      action: 'Put' as const,
      tableParam: 'device-users',
      item: {
        PK: `DEVICE#${deviceUuid}`,
        SK: `USER#${userId}`,
        device_id: deviceUuid,
        user_id: userId,
        notifications_permission: true,
        settings_permission: true,
        notifications_enabled: true,
        notification_sound: 'default',
        notification_vibration: true,
        quiet_hours_enabled: false,
        quiet_hours_start: '22:00',
        quiet_hours_end: '07:00',
        custom_notification_sound: '',
        device_nickname: deviceName,
        invited_by: userId, // Owner invited themselves
        invited_at: now,
        accepted_at: now,
        is_active: true,
      },
    });

    // Execute all operations atomically with improved error handling
    console.log(`Executing ${transactionOperations.length} database operations atomically...`);
    
    try {
      await DynamoDBHelper.transactWrite(transactionOperations);
      console.log('Database transaction completed successfully');
    } catch (error) {
      console.error('Database transaction failed:', error);
      
      // Clean up created IoT resources if transaction fails
      console.log('Cleaning up IoT resources due to transaction failure...');
      try {
        if (certResponse.certificateArn) {
          await cleanupFailedCertificate(certResponse.certificateArn, iotThingName);
        }
      } catch (cleanupError) {
        console.error('Failed to cleanup IoT resources:', cleanupError);
        // Alert on cleanup failure
        await sendCloudWatchAlarm('CertificateCleanupFailure', certResponse.certificateArn || 'unknown');
      }
      
      // Re-throw the original transaction error
      if (error instanceof DynamoDBError) {
        throw error;
      }
      
      throw new Error(`Database transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Only revoke old certificate AFTER successful transaction
    if (ownershipTransferred && oldCertificateArn) {
      console.log('Transaction successful, proceeding with old certificate cleanup...');
      const cleanupSuccess = await revokeOldCertificate(oldCertificateArn, `acorn-receiver-${existingDevices![0].device_id}`);
      
      if (!cleanupSuccess) {
        // Alert on certificate cleanup failure but don't fail the registration
        await sendCloudWatchAlarm('CertificateCleanupFailure', oldCertificateArn);
        console.warn('Certificate cleanup failed but device registration succeeded');
      }
    }

    // Prepare response
    const registrationResponse: DeviceRegistrationResponse = {
      deviceId: deviceUuid,
      deviceInstanceId: deviceInstanceId,
      deviceName: deviceName,
      serialNumber: serialNumber,
      ownerId: userId,
      registeredAt: now,
      lastResetAt: deviceState === 'factory_reset' ? resetTimestamp : undefined,
      ownershipTransferred: ownershipTransferred,
      status: 'active',
      certificates: {
        deviceCertificate: certResponse.certificatePem,
        privateKey: certResponse.keyPair.PrivateKey,
        iotEndpoint: endpointResponse.endpointAddress,
      },
    };

    console.log(`Device registered successfully: ${deviceUuid} for user: ${userId} (ownership transferred: ${ownershipTransferred})`);

    const response = ResponseHandler.success(registrationResponse, requestId, 201);
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  } catch (error) {
    console.error('Device registration failed:', error);
    
    // Determine if this is a client error or server error
    let errorMessage = 'Failed to register device';
    let statusCode = 500;
    
    if (error instanceof Error) {
      if (error.message.includes('User not found')) {
        statusCode = 401;
        errorMessage = 'User authentication failed';
      } else if (error.message.includes('validation') || error.message.includes('invalid')) {
        statusCode = 400;
        errorMessage = error.message;
      } else if (error instanceof DynamoDBError) {
        statusCode = 500;
        errorMessage = 'Database operation failed';
      }
    }
    
    const response = statusCode === 500 
      ? ResponseHandler.internalError(errorMessage, requestId)
      : ResponseHandler.createResponse(statusCode as any, undefined, 'registration_failed', errorMessage, requestId);
    
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  }
};

/**
 * Send CloudWatch alarm for certificate cleanup failures
 */
async function sendCloudWatchAlarm(alarmType: string, certificateArn: string): Promise<void> {
  try {
    const metricData = {
      Namespace: 'AcornPups/DeviceRegistration',
      MetricData: [
        {
          MetricName: alarmType,
          Value: 1,
          Unit: StandardUnit.Count,
          Dimensions: [
            {
              Name: 'Environment',
              Value: process.env.ENVIRONMENT || 'unknown',
            },
            {
              Name: 'CertificateArn',
              Value: certificateArn,
            },
          ],
          Timestamp: new Date(),
        },
      ],
    };

    await cloudWatchClient.send(new PutMetricDataCommand(metricData));
    console.log(`CloudWatch alarm sent: ${alarmType} for certificate: ${certificateArn}`);
  } catch (error) {
    console.error('Failed to send CloudWatch alarm:', error);
    // Don't throw - we don't want to fail the operation due to monitoring issues
  }
}

/**
 * Clean up IoT resources for a failed certificate
 */
async function cleanupFailedCertificate(certificateArn: string, thingName: string): Promise<void> {
  console.log(`Cleaning up failed certificate: ${certificateArn}`);
  
  try {
    // Extract certificate ID from ARN
    const certificateId = certificateArn.split('/').pop();
    if (!certificateId) {
      throw new Error('Invalid certificate ARN format');
    }
    
    // Detach policy from certificate
    const policyName = `AcornPupsReceiverPolicy-${process.env.ENVIRONMENT}`;
    try {
      await iotClient.send(new DetachPolicyCommand({
        policyName: policyName,
        target: certificateArn,
      }));
    } catch (error) {
      console.warn('Failed to detach policy during cleanup:', error);
    }
    
    // Detach certificate from Thing
    try {
      await iotClient.send(new DetachThingPrincipalCommand({
        thingName: thingName,
        principal: certificateArn,
      }));
    } catch (error) {
      console.warn('Failed to detach certificate from Thing during cleanup:', error);
    }
    
    // Delete the Thing
    try {
      await iotClient.send(new DeleteThingCommand({
        thingName: thingName,
      }));
    } catch (error) {
      console.warn('Failed to delete Thing during cleanup:', error);
    }
    
    // Mark certificate as INACTIVE
    await iotClient.send(new UpdateCertificateCommand({
      certificateId: certificateId,
      newStatus: 'INACTIVE',
    }));
    
    // Delete the certificate
    await iotClient.send(new DeleteCertificateCommand({
      certificateId: certificateId,
      forceDelete: true,
    }));
    
    console.log('Failed certificate cleanup completed successfully');
  } catch (error) {
    console.error('Failed certificate cleanup error:', error);
    throw error;
  }
}

/**
 * Revoke old IoT certificate and clean up IoT resources with improved resilience
 */
async function revokeOldCertificate(certificateArn: string, thingName?: string): Promise<boolean> {
  try {
    console.log(`Revoking old certificate: ${certificateArn}`);
    
    // Extract certificate ID from ARN
    const certificateId = certificateArn.split('/').pop();
    if (!certificateId) {
      throw new Error('Invalid certificate ARN format');
    }
    
    // Detach policy from certificate
    const policyName = `AcornPupsReceiverPolicy-${process.env.ENVIRONMENT}`;
    try {
      await iotClient.send(new DetachPolicyCommand({
        policyName: policyName,
        target: certificateArn,
      }));
      console.log(`Detached policy ${policyName} from old certificate`);
    } catch (error) {
      console.warn(`Failed to detach policy (may already be detached):`, error);
    }
    
    // Detach certificate from Thing if Thing name is provided
    if (thingName) {
      try {
        await iotClient.send(new DetachThingPrincipalCommand({
          thingName: thingName,
          principal: certificateArn,
        }));
        console.log(`Detached old certificate from Thing: ${thingName}`);
      } catch (error) {
        console.warn(`Failed to detach certificate from Thing (may already be detached):`, error);
      }
      
      // Delete the Thing
      try {
        await iotClient.send(new DeleteThingCommand({
          thingName: thingName,
        }));
        console.log(`Deleted Thing: ${thingName}`);
      } catch (error) {
        console.warn(`Failed to delete Thing (may already be deleted):`, error);
      }
    }
    
    // Mark certificate as INACTIVE first
    await iotClient.send(new UpdateCertificateCommand({
      certificateId: certificateId,
      newStatus: 'INACTIVE',
    }));
    console.log(`Marked old certificate as INACTIVE: ${certificateId}`);
    
    // Delete the certificate (this also revokes it)
    await iotClient.send(new DeleteCertificateCommand({
      certificateId: certificateId,
      forceDelete: true, // Force delete even if attached to other resources
    }));
    console.log(`Deleted old certificate: ${certificateId}`);
    
    return true;
  } catch (error) {
    console.error('Failed to revoke old certificate:', error);
    // Return false to indicate failure - caller will handle alerting
    return false;
  }
} 