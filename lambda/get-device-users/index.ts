import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import ResponseHandler from '../shared/response-handler';

interface DeviceUser {
  userId: string;
  email: string;
  role: 'owner' | 'viewer';
  addedAt: string;
  lastActive: string;
}

interface DeviceUsersResponse {
  deviceId: string;
  users: DeviceUser[];
  total: number;
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

    // TODO: Validate user has access to this device
    // TODO: Query DynamoDB for device users

    // Mock response for now
    const users: DeviceUser[] = [
      {
        userId: 'user-001',
        email: 'owner@example.com',
        role: 'owner',
        addedAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        lastActive: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      },
      {
        userId: 'user-002',
        email: 'viewer@example.com',
        role: 'viewer',
        addedAt: new Date(Date.now() - 43200000).toISOString(), // 12 hours ago
        lastActive: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
      },
    ];

    const usersResponse: DeviceUsersResponse = {
      deviceId,
      users,
      total: users.length,
    };

    console.log(`Device users retrieved: ${deviceId}, ${users.length} users`);

    const response = ResponseHandler.success(usersResponse, requestId);
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  } catch (error) {
    console.error('Get device users failed:', error);
    
    const response = ResponseHandler.internalError(
      'Failed to get device users',
      requestId
    );
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  }
}; 