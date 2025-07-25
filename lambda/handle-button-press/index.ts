import { Context } from 'aws-lambda';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { DynamoDBHelper } from '../shared/dynamodb-client';
import { ButtonPressEvent, DeviceUser, DeviceMetadata } from '../shared/types';

// Initialize SNS client for push notifications
const snsClient = new SNSClient({
  region: process.env.REGION || 'us-east-1',
});

/**
 * Handle Button Press Events
 * 
 * This function is triggered by IoT Core rules when RF buttons are pressed.
 * Processes button presses in real-time and sends push notifications to all authorized users.
 * 
 * Flow:
 * 1. Extract device ID and button RF ID from MQTT event
 * 2. Query DeviceUsers table to get all authorized users
 * 3. Filter users based on notification permissions and quiet hours
 * 4. Send push notifications via SNS to all authorized users
 * 5. No persistent storage - real-time processing only (MVP behavior)
 */
export const handler = async (event: any, context: Context): Promise<void> => {
  try {
    console.log('Button press event received:', JSON.stringify(event, null, 2));
    
    // Parse the button press event from MQTT
    const buttonEvent = parseButtonPressEvent(event);
    console.log('Parsed button event:', buttonEvent);
    
    // Validate device exists and is active
    const deviceMetadata = await DynamoDBHelper.getDeviceMetadata(buttonEvent.deviceId) as DeviceMetadata | undefined;
    if (!deviceMetadata || !deviceMetadata.is_active) {
      console.warn(`Button press ignored: device ${buttonEvent.deviceId} not found or inactive`);
      return;
    }
    
    console.log(`Processing button press for device: ${buttonEvent.deviceId} (${deviceMetadata.device_name})`);
    
    // Get all users who have access to this device
    const deviceUsers = await DynamoDBHelper.getDeviceUsers(buttonEvent.deviceId) as DeviceUser[];
    
    if (!deviceUsers || deviceUsers.length === 0) {
      console.warn(`No users found for device: ${buttonEvent.deviceId}`);
      return;
    }
    
    console.log(`Found ${deviceUsers.length} users with access to device ${buttonEvent.deviceId}`);
    
    // Filter users who should receive notifications
    const notificationUsers = deviceUsers.filter(deviceUser => {
      // Must be active and have notification permission
      if (!deviceUser.is_active || !deviceUser.notifications_permission) {
        return false;
      }
      
      // Must have notifications enabled
      if (!deviceUser.notifications_enabled) {
        return false;
      }
      
      // Check quiet hours if enabled
      if (deviceUser.quiet_hours_enabled) {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        if (isInQuietHours(currentTime, deviceUser.quiet_hours_start, deviceUser.quiet_hours_end)) {
          console.log(`Skipping notification for user ${deviceUser.user_id} due to quiet hours`);
          return false;
        }
      }
      
      return true;
    });
    
    console.log(`${notificationUsers.length} users will receive notifications`);
    
    if (notificationUsers.length === 0) {
      console.log('No users to notify after filtering');
      return;
    }
    
    // Send push notifications to all eligible users
    const notificationPromises = notificationUsers.map(async (deviceUser) => {
      try {
        await sendPushNotification(deviceUser, deviceMetadata, buttonEvent);
        console.log(`Notification sent to user: ${deviceUser.user_id}`);
      } catch (error) {
        console.error(`Failed to send notification to user ${deviceUser.user_id}:`, error);
        // Don't throw - continue processing other users
      }
    });
    
    // Wait for all notifications to be sent
    await Promise.allSettled(notificationPromises);
    
    console.log(`Button press processing completed for device: ${buttonEvent.deviceId}`);
    
  } catch (error) {
    console.error('Error handling button press:', error);
    // Don't throw - we don't want to trigger retries for button press events
    // The physical ringer has already activated, so partial failures are acceptable
  }
};

/**
 * Parse the button press event from the MQTT message
 */
function parseButtonPressEvent(event: any): ButtonPressEvent {
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
  if (!payload.deviceId || !payload.buttonRfId || !payload.timestamp) {
    throw new Error('Invalid button press event: missing required fields (deviceId, buttonRfId, timestamp)');
  }
  
  return {
    deviceId: payload.deviceId,
    buttonRfId: payload.buttonRfId,
    timestamp: payload.timestamp,
    batteryLevel: payload.batteryLevel,
  };
}

/**
 * Check if the current time is within quiet hours
 */
function isInQuietHours(currentTime: string, startTime: string, endTime: string): boolean {
  // Convert times to minutes for easier comparison
  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };
  
  const current = timeToMinutes(currentTime);
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  
  if (start <= end) {
    // Normal case: start and end are in the same day
    return current >= start && current <= end;
  } else {
    // Quiet hours span midnight
    return current >= start || current <= end;
  }
}

/**
 * Send push notification to a user via SNS
 */
async function sendPushNotification(
  deviceUser: DeviceUser, 
  deviceMetadata: DeviceMetadata, 
  buttonEvent: ButtonPressEvent
): Promise<void> {
  
  // Build notification message
  const deviceName = deviceUser.device_nickname || deviceMetadata.device_name;
  const message = `${deviceName} - Your dog wants to go outside!`;
  
  // Build notification payload for mobile apps
  const notificationPayload = {
    default: message,
    APNS: JSON.stringify({
      aps: {
        alert: {
          title: 'Acorn Pups',
          body: message,
        },
        sound: deviceUser.notification_sound === 'silent' ? undefined : 'default',
        badge: 1,
      },
      deviceId: deviceMetadata.device_id,
      buttonRfId: buttonEvent.buttonRfId,
      timestamp: buttonEvent.timestamp,
    }),
    GCM: JSON.stringify({
      data: {
        title: 'Acorn Pups',
        body: message,
        deviceId: deviceMetadata.device_id,
        buttonRfId: buttonEvent.buttonRfId,
        timestamp: buttonEvent.timestamp,
      },
      notification: {
        title: 'Acorn Pups',
        body: message,
        sound: deviceUser.notification_sound === 'silent' ? undefined : 'default',
      },
    }),
  };
  
  // Get user's SNS topic ARN (would be stored in user profile or device user relationship)
  // For now, we'll use a placeholder - in practice this would be the user's device endpoint
  const topicArn = `arn:aws:sns:${process.env.REGION}:${process.env.AWS_ACCOUNT_ID}:acorn-pups-user-${deviceUser.user_id}`;
  
  const publishCommand = new PublishCommand({
    TopicArn: topicArn,
    Message: JSON.stringify(notificationPayload),
    MessageStructure: 'json',
    Subject: 'Acorn Pups Notification',
    MessageAttributes: {
      deviceId: {
        DataType: 'String',
        StringValue: deviceMetadata.device_id,
      },
      userId: {
        DataType: 'String',
        StringValue: deviceUser.user_id,
      },
      buttonRfId: {
        DataType: 'String',
        StringValue: buttonEvent.buttonRfId,
      },
    },
  });
  
  await snsClient.send(publishCommand);
} 