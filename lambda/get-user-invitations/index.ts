import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import ResponseHandler from '../shared/response-handler';

interface Invitation {
  invitationId: string;
  deviceId: string;
  deviceName: string;
  invitedBy: string;
  notificationsPermission: boolean;
  settingsPermission: boolean;
  createdAt: string;
  expiresAt: string;
}

interface UserInvitationsResponse {
  invitations: Invitation[];
  total: number;
}

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

    // TODO: Validate user has permission to view these invitations (from JWT token)
    // TODO: Query DynamoDB for pending invitations for this user
    // TODO: Filter out expired invitations

    // Mock invitations data
    const mockInvitations: Invitation[] = [
      {
        invitationId: 'inv_1234567890_abcdef123',
        deviceId: 'acorn-receiver-003',
        deviceName: 'Bedroom Receiver',
        invitedBy: 'john@example.com',
        notificationsPermission: true,
        settingsPermission: false,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
      },
      {
        invitationId: 'inv_0987654321_xyz789456',
        deviceId: 'acorn-receiver-004',
        deviceName: 'Office Receiver',
        invitedBy: 'sarah@example.com',
        notificationsPermission: true,
        settingsPermission: true,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(), // 6 days from now
      },
    ];

    const invitationsResponse: UserInvitationsResponse = {
      invitations: mockInvitations,
      total: mockInvitations.length,
    };

    console.log(`Retrieved ${mockInvitations.length} invitations for user: ${userId}`);

    const response = ResponseHandler.success(invitationsResponse, requestId);
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  } catch (error) {
    console.error('Failed to get user invitations:', error);
    
    const response = ResponseHandler.internalError(
      'Failed to retrieve user invitations',
      requestId
    );
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  }
}; 