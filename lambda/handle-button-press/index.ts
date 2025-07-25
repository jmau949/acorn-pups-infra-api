import { Context } from 'aws-lambda';
import { DynamoDBHelper } from '../shared/dynamodb-client';
import { ButtonPressEvent, DeviceUser, DeviceMetadata } from '../shared/types';

/**
 * Handle Button Press Events
 * 
 * This function is triggered by IoT Core rules when RF buttons are pressed.
 * Currently processes basic button press validation and logging.
 * 
 * TODO: Final button press notification design has not been decided yet.
 * Consider the following options:
 * 1. Real-time push notifications via SNS
 * 2. WebSocket-based real-time updates
 * 3. Persistent event storage for later retrieval
 * 4. Hybrid approach with immediate + persistent notifications
 * 5. Integration with third-party notification services
 * 
 * Current implementation provides basic event parsing and device validation
 * as a foundation for the final notification system.
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
    
    // TODO: Implement notification system based on final design decision
    // Options to consider:
    // 1. Push notifications via SNS/FCM
    // 2. WebSocket real-time updates
    // 3. Store events for later retrieval
    // 4. Email notifications
    // 5. SMS notifications
    // 6. Third-party integrations (Slack, Discord, etc.)
    
    // TODO: Implement user preference filtering
    // Consider user notification preferences:
    // - notifications_enabled flag
    // - quiet hours settings
    // - notification_sound preferences
    // - custom notification settings
    
    // TODO: Implement rate limiting/cooldown
    // Prevent notification spam:
    // - Device-level notification cooldown
    // - User-level notification preferences
    // - Time-based rate limiting
    
    // TODO: Implement notification delivery confirmation
    // Track delivery success/failure:
    // - Delivery receipts
    // - Retry mechanisms
    // - Fallback notification methods
    
    // TODO: Implement analytics and monitoring
    // Track button press patterns:
    // - Frequency analysis
    // - User engagement metrics
    // - Device performance monitoring
    
    console.log(`Button press processing completed for device: ${buttonEvent.deviceId} (notification system pending final design)`);
    
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