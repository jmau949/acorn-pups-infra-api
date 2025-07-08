import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import ResponseHandler from '../shared/response-handler';
import { UserDevicesResponse, Device } from '../../lib/types';

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = ResponseHandler.getRequestId(event);
  
  try {
    ResponseHandler.logRequest(event, context);

    // Get userId from path parameters
    const userId = ResponseHandler.getPathParameter(event, 'userId');
    if (!userId) {
      return ResponseHandler.badRequest('userId path parameter is required', requestId);
    }

    // TODO: Validate userId format (UUID)
    // TODO: Verify user has permission to access these devices (from JWT token)
    // TODO: Query DynamoDB to get user's devices

    // Mock response for now
    const mockDevices: Device[] = [
      {
        deviceId: 'acorn-receiver-001',
        deviceName: 'Living Room Receiver',
        serialNumber: 'SN123456789',
        isOnline: true,
        lastSeen: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
        registeredAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        firmwareVersion: '1.2.3',
        settings: {
          soundEnabled: true,
          soundVolume: 7,
          ledBrightness: 5,
          notificationCooldown: 30,
          quietHoursEnabled: true,
          quietHoursStart: '22:00',
          quietHoursEnd: '07:00',
        },
        permissions: {
          notifications: true,
          settings: true,
        },
      },
      {
        deviceId: 'acorn-receiver-002',
        deviceName: 'Kitchen Receiver',
        serialNumber: 'SN987654321',
        isOnline: false,
        lastSeen: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        registeredAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week ago
        firmwareVersion: '1.1.8',
        settings: {
          soundEnabled: true,
          soundVolume: 5,
          ledBrightness: 3,
          notificationCooldown: 60,
          quietHoursEnabled: false,
        },
        permissions: {
          notifications: true,
          settings: false, // User has limited permissions for this device
        },
      },
    ];

    const userDevicesResponse: UserDevicesResponse = {
      devices: mockDevices,
      total: mockDevices.length,
    };

    console.log(`Retrieved ${mockDevices.length} devices for user: ${userId}`);

    const response = ResponseHandler.success(userDevicesResponse, requestId);
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  } catch (error) {
    console.error('Failed to get user devices:', error);
    
    const response = ResponseHandler.internalError(
      'Failed to retrieve user devices',
      requestId
    );
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  }
}; 