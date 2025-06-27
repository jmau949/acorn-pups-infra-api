import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import ResponseHandler from '../shared/response-handler';

interface UserInviteRequest {
  email: string;
  role: 'owner' | 'viewer';
}

interface UserInviteResponse {
  inviteId: string;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'expired';
  expiresAt: string;
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

    // Parse and validate request body
    const body = ResponseHandler.parseBody<UserInviteRequest>(event);
    if (!body) {
      return ResponseHandler.badRequest('Invalid request body', requestId);
    }

    const { email, role } = body;

    // Basic validation
    if (!email || !role) {
      return ResponseHandler.badRequest('Missing required fields: email, role', requestId);
    }

    if (!['owner', 'viewer'].includes(role)) {
      return ResponseHandler.badRequest('Role must be either "owner" or "viewer"', requestId);
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return ResponseHandler.badRequest('Invalid email format', requestId);
    }

    // TODO: Validate user has permission to invite others to this device
    // TODO: Check if device exists
    // TODO: Check if user is already invited/has access
    // TODO: Create invitation in DynamoDB
    // TODO: Send invitation email via SES

    // Mock response for now
    const inviteResponse: UserInviteResponse = {
      inviteId: `invite-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      email,
      role,
      status: 'pending',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    };

    console.log(`User invited: ${email} to device: ${deviceId} with role: ${role}`);

    const response = ResponseHandler.success(inviteResponse, requestId, 201);
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  } catch (error) {
    console.error('User invitation failed:', error);
    
    const response = ResponseHandler.internalError(
      'Failed to invite user',
      requestId
    );
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  }
}; 