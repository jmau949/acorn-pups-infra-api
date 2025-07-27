import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import ResponseHandler from '../shared/response-handler';

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = ResponseHandler.getRequestId(event);
  
  try {
    ResponseHandler.logRequest(event, context);

    // Get deviceId and userId from path parameters
    const deviceId = ResponseHandler.getPathParameter(event, 'deviceId');
    const userId = ResponseHandler.getPathParameter(event, 'userId');
    
    if (!deviceId) {
      return ResponseHandler.badRequest('deviceId path parameter is required', requestId);
    }
    
    if (!userId) {
      return ResponseHandler.badRequest('userId path parameter is required', requestId);
    }

    // Get requesting user_id directly from JWT token (Cognito Sub)
    const requestingUserId = event.requestContext.authorizer?.claims?.sub;
    if (!requestingUserId) {
      return ResponseHandler.unauthorized('Valid JWT token required', requestId);
    }

    // TODO: Verify requesting user has permission to remove users from this device (must be owner/admin)
    // TODO: Check if device exists (return 404 if not)
    // TODO: Check if user to be removed exists (return 404 if not)
    // TODO: Check if user has access to device (return 404 if not)
    // TODO: Remove user access from DeviceUsers table in DynamoDB
    // TODO: Send notification to removed user

    console.log(`Removed user ${userId} access from device: ${deviceId}`);

    // Return 204 No Content for successful deletion
    const response = ResponseHandler.noContent(requestId);
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  } catch (error) {
    console.error('Remove user access failed:', error);
    
    const response = ResponseHandler.internalError(
      'Failed to remove user access',
      requestId
    );
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  }
}; 