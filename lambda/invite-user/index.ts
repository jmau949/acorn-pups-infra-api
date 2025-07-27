import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import ResponseHandler from '../shared/response-handler';

interface UserInviteRequest {
  email: string;
  notificationsPermission?: boolean;
  settingsPermission?: boolean;
}

interface UserInviteResponse {
  invitationId: string;
  email: string;
  deviceId: string;
  deviceName: string;
  notificationsPermission: boolean;
  settingsPermission: boolean;
  expiresAt: string;
  sentAt: string;
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
    const body = ResponseHandler.parseBody<UserInviteRequest>(event);
    if (!body) {
      return ResponseHandler.badRequest('Request body is required', requestId);
    }

    const { email, notificationsPermission, settingsPermission } = body;

    // Validate required fields
    if (!email) {
      return ResponseHandler.badRequest('email is required', requestId);
    }

    // Validate email format
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return ResponseHandler.badRequest('Invalid email format', requestId);
    }

    // Validate email length
    if (email.length < 5 || email.length > 254) {
      return ResponseHandler.badRequest('Email must be between 5 and 254 characters', requestId);
    }

    // Get user_id directly from JWT token (Cognito Sub)
    const userId = event.requestContext.authorizer?.claims?.sub;
    if (!userId) {
      return ResponseHandler.unauthorized('Valid JWT token required', requestId);
    }

    // TODO: Validate user has permission to invite users to this device
    // TODO: Check if device exists in DynamoDB (return 404 if not)
    // TODO: Check if user is already invited or has access (return 409 if they do)
    // TODO: Generate invitation token and store in DynamoDB
    // TODO: Send invitation email via SES

    // Mock device name (would come from DynamoDB)
    const deviceName = `Device ${deviceId}`;

    // Generate mock invitation
    const invitationId = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days from now

    const inviteResponse: UserInviteResponse = {
      invitationId,
      email,
      deviceId,
      deviceName,
      notificationsPermission: notificationsPermission || false,
      settingsPermission: settingsPermission || false,
      expiresAt,
      sentAt: new Date().toISOString(),
    };

    console.log(`User invitation sent to ${email} for device: ${deviceId}`);

    const response = ResponseHandler.success(inviteResponse, requestId, 201);
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  } catch (error) {
    console.error('Failed to invite user:', error);
    
    const response = ResponseHandler.internalError(
      'Failed to send user invitation',
      requestId
    );
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  }
}; 