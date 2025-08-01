import { Context } from 'aws-lambda';
import { DynamoDBHelper } from '../shared/dynamodb-client';
import ResponseHandler from '../shared/response-handler';

// Table parameter for DynamoDB operations
const TABLE_PARAM = 'devices';

interface VolumeControlEvent {
  clientId: string;
  deviceId: string;
  action: 'volume_up' | 'volume_down';
  newVolume: number;
  previousVolume: number;
  timestamp: string;
}

/**
 * Handle Volume Control Events
 * 
 * This function is triggered by IoT Core rules when volume buttons are pressed on receivers.
 * Updates the device settings in DynamoDB with the new volume level.
 * 
 * Flow:
 * 1. Parse volume control event from MQTT
 * 2. Validate device exists and is active
 * 3. Update device settings with new volume level
 * 4. Log the volume change for monitoring
 */
export const handler = async (event: any, context: Context) => {
  console.log('Volume control event received:', JSON.stringify(event, null, 2));

  try {
    // Parse the volume control event from MQTT
    const volumeEvent = parseVolumeControlEvent(event);
    console.log('Parsed volume event:', volumeEvent);

    const { deviceId, action, newVolume, previousVolume, timestamp, clientId } = volumeEvent;

    // Validate volume range (1-10 scale)
    if (newVolume < 1 || newVolume > 10) {
      console.error('Invalid volume level:', { deviceId, newVolume, validRange: '1-10' });
      return ResponseHandler.badRequest(
        `Invalid volume level: ${newVolume}. Valid range is 1-10`,
        context.awsRequestId || 'unknown'
      );
    }

    console.log('Processing volume control event:', {
      deviceId,
      clientId,
      action,
      previousVolume,
      newVolume,
      timestamp,
      requestId: context.awsRequestId
    });

    console.log(`Processing volume control for device: ${deviceId}`);

    // Update device settings with new volume level
    try {
      const result = await DynamoDBHelper.updateItem(
        TABLE_PARAM,
        { PK: `DEVICE#${deviceId}`, SK: 'SETTINGS' },
        'SET sound_volume = :newVolume, updated_at = :updatedAt',
        {
          ':newVolume': newVolume,
          ':updatedAt': new Date().toISOString()
        },
        undefined,
        'attribute_exists(PK) AND attribute_exists(SK)'
      );

      console.log('Device volume settings updated successfully:', {
        deviceId,
        action,
        previousVolume,
        newVolume,
        updatedAt: new Date().toISOString(),
        eventTimestamp: timestamp
      });

      return ResponseHandler.success({
        message: 'Volume control event processed successfully',
        deviceId,
        clientId,
        action,
        previousVolume,
        newVolume,
        updatedAt: new Date().toISOString()
      }, context.awsRequestId || 'unknown');

    } catch (dbError: any) {
      console.error('Failed to update device volume settings:', {
        error: dbError,
        deviceId,
        action,
        newVolume,
        errorMessage: dbError.message,
        errorName: dbError.name
      });
      
      // If device settings don't exist, create them with default values
      if (dbError.name === 'ConditionalCheckFailedException' || dbError.message?.includes('ConditionalCheckFailed')) {
        console.log('Device settings not found - creating with new volume setting:', {
          deviceId,
          newVolume
        });
        
        try {
          // Create device settings with the new volume and default values
          await DynamoDBHelper.putItem(TABLE_PARAM, {
            PK: `DEVICE#${deviceId}`,
            SK: 'SETTINGS',
            device_id: deviceId,
            sound_enabled: true,
            sound_volume: newVolume,
            led_brightness: 5, // Default brightness
            notification_cooldown: 30, // Default 30 seconds
            quiet_hours_enabled: false,
            quiet_hours_start: '22:00',
            quiet_hours_end: '07:00',
            updated_at: new Date().toISOString()
          });

          console.log('Device settings created successfully with volume:', {
            deviceId,
            newVolume,
            createdAt: new Date().toISOString()
          });

          return ResponseHandler.success({
            message: 'Volume control event processed successfully (settings created)',
            deviceId,
            clientId,
            action,
            previousVolume,
            newVolume,
            updatedAt: new Date().toISOString()
          }, context.awsRequestId || 'unknown');

        } catch (createError: any) {
          console.error('Failed to create device settings:', {
            error: createError,
            deviceId,
            newVolume,
            errorMessage: createError.message
          });
          throw createError;
        }
      }
      
      throw dbError;
    }

  } catch (error) {
    console.error('Error processing volume control event:', {
      error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      deviceId: event.deviceId,
      clientId: event.clientId,
      action: event.action,
      requestId: context.awsRequestId
    });
    return ResponseHandler.internalError(
      'Failed to process volume control event',
      context.awsRequestId || 'unknown'
    );
  }
};

/**
 * Parse the volume control event from the MQTT message
 */
function parseVolumeControlEvent(event: any): VolumeControlEvent {
  // The event structure may vary depending on how IoT Core delivers it
  let payload = event;
  
  if (event.topic && event.payload) {
    // Wrapped by IoT rule
    payload = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload;
  } else if (typeof event === 'string') {
    // Direct JSON string
    payload = JSON.parse(event);
  }
  
  // Validate required fields
  if (!payload.deviceId || !payload.action || !payload.timestamp) {
    throw new Error('Invalid volume control event: missing required fields (deviceId, action, timestamp)');
  }

  if (!payload.clientId) {
    // Generate clientId from deviceId if not provided
    payload.clientId = `acorn-receiver-${payload.deviceId}`;
  }

  // Validate action field
  if (payload.action !== 'volume_up' && payload.action !== 'volume_down') {
    throw new Error(`Invalid action: ${payload.action}. Must be 'volume_up' or 'volume_down'`);
  }

  // Validate numeric fields
  if (typeof payload.newVolume !== 'number' || typeof payload.previousVolume !== 'number') {
    throw new Error('Invalid volume control event: newVolume and previousVolume must be numbers');
  }
  
  return {
    clientId: payload.clientId,
    deviceId: payload.deviceId,
    action: payload.action,
    newVolume: payload.newVolume,
    previousVolume: payload.previousVolume,
    timestamp: payload.timestamp,
  };
}