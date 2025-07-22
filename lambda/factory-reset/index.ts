import { Context } from 'aws-lambda';
import { IoTClient, UpdateCertificateCommand, DeleteCertificateCommand, DetachPolicyCommand, DetachThingPrincipalCommand, DeleteThingCommand } from '@aws-sdk/client-iot';
import { DynamoDBHelper } from '../shared/dynamodb-client';

// ==== Factory Reset Types (specific to this lambda) ====

interface DeviceResetEvent {
  command: 'reset_cleanup';
  deviceId: string;
  resetTimestamp: string;
  oldCertificateArn: string;
  reason: 'physical_button_reset' | 'user_initiated' | 'admin_reset';
}

interface DeviceResetProcessingResult {
  deviceId: string;
  certificateRevoked: boolean;
  deviceDeactivated: boolean;
  userAssociationsRemoved: number;
  processedAt: string;
}

// Initialize AWS clients
const iotClient = new IoTClient({
  region: process.env.REGION || 'us-east-1',
});

export const handler = async (event: any, context: Context): Promise<void> => {
  const processedAt = new Date().toISOString();
  let result: DeviceResetProcessingResult = {
    deviceId: '',
    certificateRevoked: false,
    deviceDeactivated: false,
    userAssociationsRemoved: 0,
    processedAt,
  };

  try {
    console.log('Factory reset event received:', JSON.stringify(event, null, 2));
    
    // Parse the reset event from MQTT message
    const resetEvent = parseResetEvent(event);
    result.deviceId = resetEvent.deviceId;
    
    console.log(`Processing factory reset for device: ${resetEvent.deviceId}`);
    
    // Step 1: Get device information before cleanup
    const deviceInfo = await getDeviceInfo(resetEvent.deviceId);
    if (!deviceInfo) {
      console.warn(`Device ${resetEvent.deviceId} not found in database, may have been previously cleaned up`);
      return;
    }
    
    // Step 2: Get device user count before cleanup
    const deviceUsers = await DynamoDBHelper.getDeviceUsers(resetEvent.deviceId);
    console.log(`Found ${deviceUsers.length} users affected by device reset`);
    
    // Step 3: Revoke IoT certificate
    result.certificateRevoked = await revokeCertificate(resetEvent.oldCertificateArn, deviceInfo.iot_thing_name);
    
    // Step 4: Clean up database records
    result.deviceDeactivated = await cleanupDatabaseRecords(resetEvent.deviceId);
    result.userAssociationsRemoved = deviceUsers.length;
    
    console.log('Factory reset cleanup completed successfully:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error processing factory reset cleanup:', error);
    console.error('Partial result:', JSON.stringify(result, null, 2));
    
    // Log the error but don't throw - we want to avoid retries for cleanup operations
    // The device has already been reset physically, so we should handle partial failures gracefully
    console.warn('Factory reset cleanup completed with errors - some manual cleanup may be required');
  }
};

/**
 * Parse the reset event from the incoming MQTT message
 */
function parseResetEvent(event: any): DeviceResetEvent {
  // The event structure may vary depending on how IoT Core delivers it
  // Handle both direct MQTT payload and wrapped IoT rule payload
  let payload = event;
  
  if (event.topic && event.payload) {
    // Wrapped by IoT rule
    payload = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload;
  } else if (typeof event === 'string') {
    // Direct JSON string
    payload = JSON.parse(event);
  }
  
  // Validate required fields
  if (!payload.command || payload.command !== 'reset_cleanup') {
    throw new Error('Invalid reset event: missing or invalid command');
  }
  
  if (!payload.deviceId || !payload.resetTimestamp || !payload.oldCertificateArn) {
    throw new Error('Invalid reset event: missing required fields (deviceId, resetTimestamp, oldCertificateArn)');
  }
  
  return {
    command: payload.command,
    deviceId: payload.deviceId,
    resetTimestamp: payload.resetTimestamp,
    oldCertificateArn: payload.oldCertificateArn,
    reason: payload.reason || 'physical_button_reset',
  };
}

/**
 * Get device information from database
 */
async function getDeviceInfo(deviceId: string) {
  try {
    const deviceMetadata = await DynamoDBHelper.getDeviceMetadata(deviceId);
    return deviceMetadata;
  } catch (error) {
    console.error(`Failed to get device info for ${deviceId}:`, error);
    return null;
  }
}



/**
 * Revoke the IoT certificate and clean up IoT resources
 */
async function revokeCertificate(certificateArn: string, thingName?: string): Promise<boolean> {
  try {
    console.log(`Revoking certificate: ${certificateArn}`);
    
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
      console.log(`Detached policy ${policyName} from certificate`);
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
        console.log(`Detached certificate from Thing: ${thingName}`);
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
    console.log(`Marked certificate as INACTIVE: ${certificateId}`);
    
    // Delete the certificate (this also revokes it)
    await iotClient.send(new DeleteCertificateCommand({
      certificateId: certificateId,
      forceDelete: true, // Force delete even if attached to other resources
    }));
    console.log(`Deleted certificate: ${certificateId}`);
    
    return true;
  } catch (error) {
    console.error('Failed to revoke certificate:', error);
    return false;
  }
}

/**
 * Clean up database records for the reset device
 */
async function cleanupDatabaseRecords(deviceId: string): Promise<boolean> {
  try {
    console.log(`Cleaning up database records for device: ${deviceId}`);
    
    // Get all device user associations to remove
    const deviceUsers = await DynamoDBHelper.getDeviceUsers(deviceId);
    
    // Get all pending invitations for this device
    const deviceInvitations = await DynamoDBHelper.getDeviceInvitations(deviceId);
    
    // Prepare transaction operations
    const transactionOperations = [];
    
    // Delete device metadata record
    transactionOperations.push({
      action: 'Delete' as const,
      tableParam: 'devices',
      key: { PK: `DEVICE#${deviceId}`, SK: 'METADATA' },
    });
    
    // Delete device settings record
    transactionOperations.push({
      action: 'Delete' as const,
      tableParam: 'devices',
      key: { PK: `DEVICE#${deviceId}`, SK: 'SETTINGS' },
    });
    
    // Remove all device user associations
    for (const deviceUser of deviceUsers) {
      transactionOperations.push({
        action: 'Delete' as const,
        tableParam: 'device-users',
        key: { PK: `DEVICE#${deviceId}`, SK: `USER#${deviceUser.user_id}` },
      });
    }
    
    // Remove all pending invitations for this device
    for (const invitation of deviceInvitations) {
      transactionOperations.push({
        action: 'Delete' as const,
        tableParam: 'invitations',
        key: { PK: `INVITATION#${invitation.invitation_id}`, SK: 'METADATA' },
      });
    }
    
    console.log(`Prepared cleanup: ${deviceUsers.length} user associations, ${deviceInvitations.length} invitations`);
    
    // Execute all operations in a transaction
    await DynamoDBHelper.transactWrite(transactionOperations);
    
    console.log(`Successfully cleaned up database records for device ${deviceId}`);
    return true;
  } catch (error) {
    console.error('Failed to clean up database records:', error);
    return false;
  }
}

 