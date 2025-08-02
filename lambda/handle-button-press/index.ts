import { Context } from 'aws-lambda';
import { DynamoDBHelper } from '../shared/dynamodb-client';
import { ButtonPressEvent, DeviceUser, DeviceMetadata } from '../shared/types';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

// Create a new Expo SDK client
const expo = new Expo();

interface UserEndpoint {
  user_id: string;
  device_fingerprint: string;
  expo_push_token: string;
  platform: string;
  device_info: string;
  is_active: boolean;
  last_used?: string;
}

/**
 * Handle Button Press Events with Expo Push Notifications
 * 
 * This function is triggered by IoT Core rules when RF buttons are pressed.
 * It sends push notifications to all registered devices for authorized users.
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
    
    // Filter users with notification permissions and notifications enabled
    const notificationUsers = deviceUsers.filter(user => 
      user.notifications_permission && 
      user.notifications_enabled && 
      user.is_active
    );
    
    if (notificationUsers.length === 0) {
      console.log('No users have notifications enabled for this device');
      return;
    }
    
    console.log(`${notificationUsers.length} users have notifications enabled`);
    
    // Collect all push tokens for notification users
    const messages: ExpoPushMessage[] = [];
    const tokenToEndpointMap = new Map<string, UserEndpoint>();
    
    for (const user of notificationUsers) {
      try {
        // Get all active push endpoints for this user
        const userEndpoints = await DynamoDBHelper.getUserEndpoints(user.user_id) as UserEndpoint[];
        
        console.log(`User ${user.user_id} has ${userEndpoints.length} active endpoints`);
        
        for (const endpoint of userEndpoints) {
          // Skip if not a valid Expo push token
          if (!Expo.isExpoPushToken(endpoint.expo_push_token)) {
            console.warn(`Invalid Expo push token for user ${user.user_id}, device ${endpoint.device_fingerprint}`);
            continue;
          }
          
          // Store endpoint mapping for later processing
          tokenToEndpointMap.set(endpoint.expo_push_token, endpoint);
          
          // Create push message with single token (this is the recommended approach for tracking)
          const message: ExpoPushMessage = {
            to: endpoint.expo_push_token, // Always a single string in our implementation
            sound: user.notification_sound === 'silent' ? null : 'default',
            title: deviceMetadata.device_name || 'Acorn Pups',
            body: 'Your dog wants to go outside!',
            data: {
              deviceId: buttonEvent.deviceId,
              deviceName: deviceMetadata.device_name,
              buttonRfId: buttonEvent.buttonRfId,
              timestamp: buttonEvent.timestamp,
              batteryLevel: buttonEvent.batteryLevel,
            },
            priority: 'high',
            channelId: 'acorn-pups-notifications',
          };
          
          messages.push(message);
        }
      } catch (error) {
        console.error(`Error getting endpoints for user ${user.user_id}:`, error);
      }
    }
    
    if (messages.length === 0) {
      console.log('No valid push tokens found for notification');
      return;
    }
    
    console.log(`Sending ${messages.length} push notifications`);
    
    // Send notifications in chunks (Expo recommends chunks of 100)
    const chunks = expo.chunkPushNotifications(messages);
    const tickets: ExpoPushTicket[] = [];
    
    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
        console.log(`Successfully sent chunk of ${chunk.length} notifications`);
      } catch (error) {
        console.error('Error sending notification chunk:', {
          error,
          chunkSize: chunk.length,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
        // Add error tickets for failed chunks so we can still process other chunks
        for (let i = 0; i < chunk.length; i++) {
          tickets.push({
            status: 'error',
            message: `Failed to send chunk: ${error instanceof Error ? error.message : 'Unknown error'}`,
            details: { error: 'ExpoError' }
          });
        }
      }
    }
    
    console.log(`Sent ${tickets.length} push notifications`);
    
    // Process tickets for reactive cleanup
    const now = new Date().toISOString();
    const updatePromises: Promise<any>[] = [];
    
    // Process delivery receipts with robust token handling
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      const message = messages[i];
      
      // Handle both single tokens and arrays (production-grade approach)
      const tokens = Array.isArray(message.to) ? message.to : [message.to];
      
      for (const pushToken of tokens) {
        // Validate token format
        if (!pushToken || typeof pushToken !== 'string') {
          console.error('Invalid push token format:', typeof pushToken);
          continue;
        }
        
        const endpoint = tokenToEndpointMap.get(pushToken);
        if (!endpoint) {
          console.warn(`No endpoint found for token ${pushToken.substring(0, 20)}...`);
          continue;
        }
        
        if (ticket.status === 'ok') {
          // Update last_used timestamp for successful delivery
          updatePromises.push(
            DynamoDBHelper.updateItem(
              'user-endpoints',
              {
                PK: `USER#${endpoint.user_id}`,
                SK: `ENDPOINT#${endpoint.device_fingerprint}`,
              },
              'SET last_used = :lastUsed',
              { ':lastUsed': now }
            ).catch(error => {
              console.error(`Error updating last_used for endpoint ${endpoint.device_fingerprint}:`, error);
            })
          );
        } else if (ticket.status === 'error') {
          const errorType = ticket.details?.error || 'UnknownError';
          console.error(`Notification error for ${endpoint.device_fingerprint}:`, {
            message: ticket.message,
            errorType,
            deviceInfo: endpoint.device_info,
            platform: endpoint.platform
          });
          
          // Handle different types of errors appropriately
          if (errorType === 'DeviceNotRegistered') {
            console.log(`Marking endpoint ${endpoint.device_fingerprint} as inactive due to DeviceNotRegistered error`);
            
            updatePromises.push(
              DynamoDBHelper.updateItem(
                'user-endpoints',
                {
                  PK: `USER#${endpoint.user_id}`,
                  SK: `ENDPOINT#${endpoint.device_fingerprint}`,
                },
                'SET is_active = :inactive, updated_at = :updatedAt',
                { 
                  ':inactive': false,
                  ':updatedAt': now 
                }
              ).catch(error => {
                console.error(`Error marking endpoint ${endpoint.device_fingerprint} as inactive:`, error);
              })
            );
          } else if (errorType === 'InvalidCredentials') {
            console.warn(`Invalid credentials for endpoint ${endpoint.device_fingerprint} - may need token refresh`);
          } else if (errorType === 'MessageTooBig') {
            console.error(`Message too big for endpoint ${endpoint.device_fingerprint} - check message content`);
          } else if (errorType === 'MessageRateExceeded') {
            console.warn(`Rate limit exceeded for endpoint ${endpoint.device_fingerprint} - backing off`);
          } else {
            console.error(`Unhandled error type ${errorType} for endpoint ${endpoint.device_fingerprint}`);
          }
        }
      }
    }
    
    // Wait for all updates to complete
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
      console.log(`Updated ${updatePromises.length} endpoints`);
    }
    
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