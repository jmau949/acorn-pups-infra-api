import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import ResponseHandler from '../shared/response-handler';
import { UserInvitationsResponse, Invitation } from '../../lib/types';

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

    // TODO: Verify requesting user has permission to view invitations for this userId (must be same user or admin)
    // TODO: Query DynamoDB for pending invitations by user email
    // TODO: Filter out expired invitations

    // Mock invitations response
    const mockInvitations: Invitation[] = [
      {
        invitationId: 'inv-123e4567-e89b-12d3-a456-426614174000',
        deviceId: 'acorn-receiver-001',
        deviceName: 'Living Room Receiver',
        invitedBy: 'owner@example.com',
        notificationsPermission: true,
        settingsPermission: false,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
      },
      {
        invitationId: 'inv-987fcdeb-a21c-34d5-b789-852741963000',
        deviceId: 'acorn-receiver-002',
        deviceName: 'Kitchen Receiver',
        invitedBy: 'friend@example.com',
        notificationsPermission: true,
        settingsPermission: true,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(), // 6 days from now
      },
    ];

    const userInvitationsResponse: UserInvitationsResponse = {
      invitations: mockInvitations,
      total: mockInvitations.length,
    };

    console.log(`Retrieved ${mockInvitations.length} pending invitations for user: ${userId}`);

    const response = ResponseHandler.success(userInvitationsResponse, requestId);
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