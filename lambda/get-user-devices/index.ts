import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import ResponseHandler from '../shared/response-handler';

interface Device {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  status: 'online' | 'offline' | 'pending';
  lastSeen: string;
  registeredAt: string;
  settings: {
    buttonSensitivity: number;
    notificationPreferences: {
      pushEnabled: boolean;
      emailEnabled: boolean;
    };
  };
}

interface GetUserDevicesResponse {
  devices: Device[];
  total: number;
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = ResponseHandler.getRequestId(event);
  
  try {
    ResponseHandler.logRequest(event, context);

    const userId = event.pathParameters?.userId;
    if (!userId) {
      return ResponseHandler.badRequest('Missing userId parameter', requestId);
    }

    // TODO: Validate userId from JWT token when Cognito is integrated
    // TODO: Query DynamoDB for user's devices

    // Mock response for now
    const devices: Device[] = [
      {
        deviceId: 'device-001',
        deviceName: 'Buddy\'s Button',
        deviceType: 'acorn-button-v1',
        status: 'online',
        lastSeen: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
        registeredAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        settings: {
          buttonSensitivity: 5,
          notificationPreferences: {
            pushEnabled: true,
            emailEnabled: false,
          },
        },
      },
      {
        deviceId: 'device-002',
        deviceName: 'Luna\'s Button',
        deviceType: 'acorn-button-v1',
        status: 'offline',
        lastSeen: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        registeredAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
        settings: {
          buttonSensitivity: 3,
          notificationPreferences: {
            pushEnabled: true,
            emailEnabled: true,
          },
        },
      },
    ];

    const response: GetUserDevicesResponse = {
      devices,
      total: devices.length,
    };

    console.log(`Retrieved ${devices.length} devices for user: ${userId}`);

    const apiResponse = ResponseHandler.success(response, requestId);
    ResponseHandler.logResponse(apiResponse, requestId);
    
    return apiResponse;
  } catch (error) {
    console.error('Get user devices failed:', error);
    
    const response = ResponseHandler.internalError(
      'Failed to retrieve user devices',
      requestId
    );
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  }
}; 