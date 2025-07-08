import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import ResponseHandler from '../shared/response-handler';

interface DeviceSettingsRequest {
  soundEnabled?: boolean;
  soundVolume?: number;
  ledBrightness?: number;
  notificationCooldown?: number;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

interface DeviceSettings {
  soundEnabled: boolean;
  soundVolume: number;
  ledBrightness: number;
  notificationCooldown: number;
  quietHoursEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

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

    // Parse and validate request body
    const body = ResponseHandler.parseBody<DeviceSettingsRequest>(event);
    if (!body) {
      return ResponseHandler.badRequest('Request body is required', requestId);
    }

    // Validate settings values
    const { soundEnabled, soundVolume, ledBrightness, notificationCooldown, quietHoursEnabled, quietHoursStart, quietHoursEnd } = body;

    // Validate sound volume range (1-10)
    if (soundVolume !== undefined && (soundVolume < 1 || soundVolume > 10)) {
      return ResponseHandler.badRequest('soundVolume must be between 1 and 10', requestId);
    }

    // Validate LED brightness range (1-10)  
    if (ledBrightness !== undefined && (ledBrightness < 1 || ledBrightness > 10)) {
      return ResponseHandler.badRequest('ledBrightness must be between 1 and 10', requestId);
    }

    // Validate notification cooldown range (0-300 seconds)
    if (notificationCooldown !== undefined && (notificationCooldown < 0 || notificationCooldown > 300)) {
      return ResponseHandler.badRequest('notificationCooldown must be between 0 and 300 seconds', requestId);
    }

    // Validate time format (HH:MM)
    const timePattern = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (quietHoursStart && !timePattern.test(quietHoursStart)) {
      return ResponseHandler.badRequest('quietHoursStart must be in HH:MM format', requestId);
    }

    if (quietHoursEnd && !timePattern.test(quietHoursEnd)) {
      return ResponseHandler.badRequest('quietHoursEnd must be in HH:MM format', requestId);
    }

    // TODO: Validate user has permission to update this device
    // TODO: Check if device exists in DynamoDB
    // TODO: Update device settings in DynamoDB
    // TODO: Notify device of settings change via IoT Core

    // Mock current settings (would come from DynamoDB)
    const currentSettings: DeviceSettings = {
      soundEnabled: true,
      soundVolume: 7,
      ledBrightness: 5,
      notificationCooldown: 30,
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
    };

    // Apply updates
    const updatedSettings: DeviceSettings = {
      soundEnabled: soundEnabled !== undefined ? soundEnabled : currentSettings.soundEnabled,
      soundVolume: soundVolume !== undefined ? soundVolume : currentSettings.soundVolume,
      ledBrightness: ledBrightness !== undefined ? ledBrightness : currentSettings.ledBrightness,
      notificationCooldown: notificationCooldown !== undefined ? notificationCooldown : currentSettings.notificationCooldown,
      quietHoursEnabled: quietHoursEnabled !== undefined ? quietHoursEnabled : currentSettings.quietHoursEnabled,
      quietHoursStart: quietHoursStart !== undefined ? quietHoursStart : currentSettings.quietHoursStart,
      quietHoursEnd: quietHoursEnd !== undefined ? quietHoursEnd : currentSettings.quietHoursEnd,
    };

    console.log(`Device settings updated for device: ${deviceId}`);

    const response = ResponseHandler.success(updatedSettings, requestId);
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  } catch (error) {
    console.error('Failed to update device settings:', error);
    
    const response = ResponseHandler.internalError(
      'Failed to update device settings',
      requestId
    );
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  }
}; 