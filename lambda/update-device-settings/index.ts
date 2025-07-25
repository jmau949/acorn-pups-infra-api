import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import ResponseHandler from '../shared/response-handler';
import { DynamoDBHelper } from '../shared/dynamodb-client';
import { DeviceMetadata, DeviceSettings, DeviceUser, ValidationError } from '../shared/types';

// ==== Device Settings Types (specific to this lambda) ====

interface DeviceSettingsRequest {
  soundEnabled?: boolean;
  soundVolume?: number;
  ledBrightness?: number;
  notificationCooldown?: number;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

interface DeviceSettingsResponse {
  soundEnabled: boolean;
  soundVolume: number;
  ledBrightness: number;
  notificationCooldown: number;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

/**
 * Update Device Settings
 * 
 * Updates configuration settings for a specific ESP32 receiver device.
 * Requires the user to have settings permission for the device.
 * Publishes settings changes to the device via IoT Core MQTT.
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = ResponseHandler.getRequestId(event);
  
  try {
    ResponseHandler.logRequest(event, context);

    // Get deviceId from path parameters
    const deviceId = ResponseHandler.getPathParameter(event, 'deviceId');
    if (!deviceId) {
      return ResponseHandler.badRequest('deviceId path parameter is required', requestId);
    }

    // Validate device ID format
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(deviceId)) {
      return ResponseHandler.badRequest('Invalid deviceId format', requestId);
    }

    // Get cognito_sub from JWT token for authorization
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

    // Check if device exists
    const deviceMetadata = await DynamoDBHelper.getDeviceMetadata(deviceId) as DeviceMetadata | undefined;
    if (!deviceMetadata) {
      return ResponseHandler.notFound('Device not found', requestId);
    }

    // Check if user has access to this device and settings permission
    const userDeviceAccess = await DynamoDBHelper.getUserDeviceAccess(deviceId, userId) as DeviceUser | undefined;
    if (!userDeviceAccess || !userDeviceAccess.is_active) {
      return ResponseHandler.forbidden('You do not have access to this device', requestId);
    }

    if (!userDeviceAccess.settings_permission) {
      return ResponseHandler.forbidden('You do not have permission to modify settings for this device', requestId);
    }

    // Parse and validate request body
    const body = ResponseHandler.parseBody<DeviceSettingsRequest>(event);
    if (!body) {
      return ResponseHandler.badRequest('Request body is required', requestId);
    }

    // Validate settings values
    const validationErrors: ValidationError[] = [];
    const { soundEnabled, soundVolume, ledBrightness, notificationCooldown, quietHoursEnabled, quietHoursStart, quietHoursEnd } = body;

    // Validate sound volume range (1-10)
    if (soundVolume !== undefined && (soundVolume < 1 || soundVolume > 10)) {
      validationErrors.push({ field: 'soundVolume', message: 'Sound volume must be between 1 and 10' });
    }

    // Validate LED brightness range (1-10)  
    if (ledBrightness !== undefined && (ledBrightness < 1 || ledBrightness > 10)) {
      validationErrors.push({ field: 'ledBrightness', message: 'LED brightness must be between 1 and 10' });
    }

    // Validate notification cooldown range (0-300 seconds)
    if (notificationCooldown !== undefined && (notificationCooldown < 0 || notificationCooldown > 300)) {
      validationErrors.push({ field: 'notificationCooldown', message: 'Notification cooldown must be between 0 and 300 seconds' });
    }

    // Validate time format (HH:MM)
    const timePattern = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (quietHoursStart && !timePattern.test(quietHoursStart)) {
      validationErrors.push({ field: 'quietHoursStart', message: 'Quiet hours start must be in HH:MM format' });
    }

    if (quietHoursEnd && !timePattern.test(quietHoursEnd)) {
      validationErrors.push({ field: 'quietHoursEnd', message: 'Quiet hours end must be in HH:MM format' });
    }

    if (validationErrors.length > 0) {
      return ResponseHandler.validationError('Settings validation failed', validationErrors, requestId);
    }

    // Get current settings
    const currentSettings = await DynamoDBHelper.getDeviceSettings(deviceId) as DeviceSettings | undefined;
    if (!currentSettings) {
      return ResponseHandler.notFound('Device settings not found', requestId);
    }

    // Build update expression for changed fields only
    const updateExpressions: string[] = [];
    const expressionAttributeValues: Record<string, any> = {};
    const expressionAttributeNames: Record<string, string> = {};

    let fieldIndex = 0;

    if (soundEnabled !== undefined && soundEnabled !== currentSettings.sound_enabled) {
      updateExpressions.push(`#soundEnabled${fieldIndex} = :soundEnabled${fieldIndex}`);
      expressionAttributeNames[`#soundEnabled${fieldIndex}`] = 'sound_enabled';
      expressionAttributeValues[`:soundEnabled${fieldIndex}`] = soundEnabled;
      fieldIndex++;
    }

    if (soundVolume !== undefined && soundVolume !== currentSettings.sound_volume) {
      updateExpressions.push(`#soundVolume${fieldIndex} = :soundVolume${fieldIndex}`);
      expressionAttributeNames[`#soundVolume${fieldIndex}`] = 'sound_volume';
      expressionAttributeValues[`:soundVolume${fieldIndex}`] = soundVolume;
      fieldIndex++;
    }

    if (ledBrightness !== undefined && ledBrightness !== currentSettings.led_brightness) {
      updateExpressions.push(`#ledBrightness${fieldIndex} = :ledBrightness${fieldIndex}`);
      expressionAttributeNames[`#ledBrightness${fieldIndex}`] = 'led_brightness';
      expressionAttributeValues[`:ledBrightness${fieldIndex}`] = ledBrightness;
      fieldIndex++;
    }

    if (notificationCooldown !== undefined && notificationCooldown !== currentSettings.notification_cooldown) {
      updateExpressions.push(`#notificationCooldown${fieldIndex} = :notificationCooldown${fieldIndex}`);
      expressionAttributeNames[`#notificationCooldown${fieldIndex}`] = 'notification_cooldown';
      expressionAttributeValues[`:notificationCooldown${fieldIndex}`] = notificationCooldown;
      fieldIndex++;
    }

    if (quietHoursEnabled !== undefined && quietHoursEnabled !== currentSettings.quiet_hours_enabled) {
      updateExpressions.push(`#quietHoursEnabled${fieldIndex} = :quietHoursEnabled${fieldIndex}`);
      expressionAttributeNames[`#quietHoursEnabled${fieldIndex}`] = 'quiet_hours_enabled';
      expressionAttributeValues[`:quietHoursEnabled${fieldIndex}`] = quietHoursEnabled;
      fieldIndex++;
    }

    if (quietHoursStart !== undefined && quietHoursStart !== currentSettings.quiet_hours_start) {
      updateExpressions.push(`#quietHoursStart${fieldIndex} = :quietHoursStart${fieldIndex}`);
      expressionAttributeNames[`#quietHoursStart${fieldIndex}`] = 'quiet_hours_start';
      expressionAttributeValues[`:quietHoursStart${fieldIndex}`] = quietHoursStart;
      fieldIndex++;
    }

    if (quietHoursEnd !== undefined && quietHoursEnd !== currentSettings.quiet_hours_end) {
      updateExpressions.push(`#quietHoursEnd${fieldIndex} = :quietHoursEnd${fieldIndex}`);
      expressionAttributeNames[`#quietHoursEnd${fieldIndex}`] = 'quiet_hours_end';
      expressionAttributeValues[`:quietHoursEnd${fieldIndex}`] = quietHoursEnd;
      fieldIndex++;
    }

    // Always update the updated_at timestamp
    updateExpressions.push(`#updatedAt = :updatedAt`);
    expressionAttributeNames['#updatedAt'] = 'updated_at';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    if (updateExpressions.length === 1) {
      // Only updated_at changed, which means no actual settings changed
      console.log(`No settings changes detected for device: ${deviceId}`);
    } else {
      console.log(`Updating ${updateExpressions.length - 1} settings for device: ${deviceId}`);
    }

    // Update settings in DynamoDB
    const updateExpression = `SET ${updateExpressions.join(', ')}`;
    
    const updatedResult = await DynamoDBHelper.updateItem(
      'devices',
      { PK: `DEVICE#${deviceId}`, SK: 'SETTINGS' },
      updateExpression,
      expressionAttributeValues,
      expressionAttributeNames
    );

    // Build response with updated settings
    const updatedSettings = updatedResult.Attributes as DeviceSettings;
    const settingsResponse: DeviceSettingsResponse = {
      soundEnabled: updatedSettings.sound_enabled,
      soundVolume: updatedSettings.sound_volume,
      ledBrightness: updatedSettings.led_brightness,
      notificationCooldown: updatedSettings.notification_cooldown,
      quietHoursEnabled: updatedSettings.quiet_hours_enabled,
      quietHoursStart: updatedSettings.quiet_hours_start,
      quietHoursEnd: updatedSettings.quiet_hours_end,
    };

    // TODO: Publish settings update to IoT Core for the device
    // This would send an MQTT message to topic: acorn-pups/settings/{deviceId}
    console.log(`Device settings updated successfully for device: ${deviceId}`);

    const response = ResponseHandler.success(settingsResponse, requestId);
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  } catch (error) {
    console.error('Failed to update device settings:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('User not found')) {
        return ResponseHandler.unauthorized('User authentication failed', requestId);
      } else if (error.message.includes('Device not found')) {
        return ResponseHandler.notFound('Device not found', requestId);
      } else if (error.message.includes('permission')) {
        return ResponseHandler.forbidden('Insufficient permissions', requestId);
      }
    }
    
    const response = ResponseHandler.internalError(
      'Failed to update device settings',
      requestId
    );
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  }
}; 