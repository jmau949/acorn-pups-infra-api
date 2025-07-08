import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import ResponseHandler from '../shared/response-handler';
import { 
  DeviceSettingsRequest, 
  DeviceSettings, 
  ValidationError,
  VALIDATION_CONSTRAINTS 
} from '../../lib/types';

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

    const {
      soundEnabled,
      soundVolume,
      ledBrightness,
      notificationCooldown,
      quietHoursEnabled,
      quietHoursStart,
      quietHoursEnd,
    } = body;

    // Validate settings
    const validationErrors: ValidationError[] = [];

    // Sound volume validation
    if (soundVolume !== undefined) {
      validationErrors.push(...ResponseHandler.validateNumber(
        soundVolume,
        'soundVolume',
        VALIDATION_CONSTRAINTS.SOUND_VOLUME.MIN,
        VALIDATION_CONSTRAINTS.SOUND_VOLUME.MAX
      ));
    }

    // LED brightness validation
    if (ledBrightness !== undefined) {
      validationErrors.push(...ResponseHandler.validateNumber(
        ledBrightness,
        'ledBrightness',
        VALIDATION_CONSTRAINTS.LED_BRIGHTNESS.MIN,
        VALIDATION_CONSTRAINTS.LED_BRIGHTNESS.MAX
      ));
    }

    // Notification cooldown validation
    if (notificationCooldown !== undefined) {
      validationErrors.push(...ResponseHandler.validateNumber(
        notificationCooldown,
        'notificationCooldown',
        VALIDATION_CONSTRAINTS.NOTIFICATION_COOLDOWN.MIN,
        VALIDATION_CONSTRAINTS.NOTIFICATION_COOLDOWN.MAX
      ));
    }

    // Quiet hours time format validation
    if (quietHoursStart !== undefined && quietHoursStart !== '') {
      validationErrors.push(...ResponseHandler.validateString(
        quietHoursStart,
        'quietHoursStart',
        undefined,
        undefined,
        VALIDATION_CONSTRAINTS.TIME_FORMAT.PATTERN
      ));
    }

    if (quietHoursEnd !== undefined && quietHoursEnd !== '') {
      validationErrors.push(...ResponseHandler.validateString(
        quietHoursEnd,
        'quietHoursEnd',
        undefined,
        undefined,
        VALIDATION_CONSTRAINTS.TIME_FORMAT.PATTERN
      ));
    }

    // Return validation errors if any
    if (validationErrors.length > 0) {
      return ResponseHandler.validationError(
        'Invalid settings provided',
        requestId,
        validationErrors
      );
    }

    // TODO: Verify user has permission to modify device settings (from JWT token)
    // TODO: Check if device exists (return 404 if not)
    // TODO: Update device settings in DynamoDB
    // TODO: Publish settings update to MQTT topic for device

    // Mock updated settings response
    const updatedSettings: DeviceSettings = {
      soundEnabled: soundEnabled ?? true,
      soundVolume: soundVolume ?? 7,
      ledBrightness: ledBrightness ?? 5,
      notificationCooldown: notificationCooldown ?? 30,
      quietHoursEnabled: quietHoursEnabled ?? true,
      quietHoursStart: quietHoursStart ?? '22:00',
      quietHoursEnd: quietHoursEnd ?? '07:00',
    };

    console.log(`Device settings updated for device: ${deviceId}`, updatedSettings);

    const response = ResponseHandler.success(updatedSettings, requestId);
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  } catch (error) {
    console.error('Device settings update failed:', error);
    
    const response = ResponseHandler.internalError(
      'Failed to update device settings',
      requestId
    );
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  }
}; 