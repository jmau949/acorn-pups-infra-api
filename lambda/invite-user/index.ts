import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import ResponseHandler from '../shared/response-handler';
import { 
  UserInviteRequest, 
  UserInviteResponse, 
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
    const body = ResponseHandler.parseBody<UserInviteRequest>(event);
    if (!body) {
      return ResponseHandler.badRequest('Request body is required', requestId);
    }

    const { email, notificationsPermission = true, settingsPermission = false } = body;

    // Validate required fields and format
    const validationErrors: ValidationError[] = [];

    // Email validation
    if (!email) {
      validationErrors.push({
        field: 'email',
        message: 'email is required',
      });
    } else {
      validationErrors.push(...ResponseHandler.validateEmail(email, 'email'));
    }

    // Return validation errors if any
    if (validationErrors.length > 0) {
      return ResponseHandler.validationError(
        'Invalid invitation data',
        requestId,
        validationErrors
      );
    }

    // TODO: Verify user has permission to invite others to this device (must be owner/admin)
    // TODO: Check if device exists (return 404 if not)
    // TODO: Check if user is already invited or has access
    // TODO: Create invitation record in DynamoDB
    // TODO: Send email invitation with deep link

    const sentAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days from now

    // Mock response for now
    const inviteResponse: UserInviteResponse = {
      invitationId: `inv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      email,
      deviceId,
      deviceName: 'Mock Device Name', // TODO: Get actual device name from DynamoDB
      notificationsPermission,
      settingsPermission,
      expiresAt,
      sentAt,
    };

    console.log(`Invitation sent to ${email} for device: ${deviceId}`);

    const response = ResponseHandler.success(inviteResponse, requestId, 201);
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  } catch (error) {
    console.error('User invitation failed:', error);
    
    const response = ResponseHandler.internalError(
      'Failed to send invitation',
      requestId
    );
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  }
}; 