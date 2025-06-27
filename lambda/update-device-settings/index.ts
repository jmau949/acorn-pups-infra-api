import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import ResponseHandler from '../shared/response-handler';

interface DeviceSettingsRequest {
  buttonSensitivity?: number;
  notificationPreferences?: {
    pushEnabled: boolean;
    emailEnabled: boolean;
  };
}

interface DeviceSettingsResponse {
  buttonSensitivity: number;
  notificationPreferences: {
    pushEnabled: boolean;
    emailEnabled: boolean;
  };
  updatedAt: string;
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = ResponseHandler.getRequestId(event);
  
  try {
    ResponseHandler.logRequest(event, context);

    const deviceId = event.pathParameters?.deviceId;
    if (!deviceId) {
      return ResponseHandler.badRequest('Missing deviceId parameter', requestId);
    }

    // Parse request body
    const body = ResponseHandler.parseBody<DeviceSettingsRequest>(event);
    if (!body) {
      return ResponseHandler.badRequest('Invalid request body', requestId);
    }

    // TODO: Validate user has permission to modify this device
    // TODO: Validate settings values
    // TODO: Update settings in DynamoDB
    // TODO: Notify device of settings change via IoT Core

    // Mock response for now
    const settingsResponse: DeviceSettingsResponse = {
      buttonSensitivity: body.buttonSensitivity || 5,
      notificationPreferences: body.notificationPreferences || {
        pushEnabled: true,
        emailEnabled: false,
      },
      updatedAt: new Date().toISOString(),
    };

    console.log(`Device settings updated: ${deviceId}`);

    const response = ResponseHandler.success(settingsResponse, requestId);
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  } catch (error) {
    console.error('Update device settings failed:', error);
    
    const response = ResponseHandler.internalError(
      'Failed to update device settings',
      requestId
    );
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  }
}; 