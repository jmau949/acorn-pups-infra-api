import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import ResponseHandler from '../shared/response-handler';
import { InvitationActionResponse } from '../shared/types';

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = ResponseHandler.getRequestId(event);
  
  try {
    ResponseHandler.logRequest(event, context);

    // Get invitationId from path parameters
    const invitationId = ResponseHandler.getPathParameter(event, 'invitationId');
    if (!invitationId) {
      return ResponseHandler.badRequest('invitationId path parameter is required', requestId);
    }

    // Get user_id directly from JWT token (Cognito Sub)
    const userId = event.requestContext.authorizer?.claims?.sub;
    if (!userId) {
      return ResponseHandler.unauthorized('Valid JWT token required', requestId);
    }

    // TODO: Validate invitation exists and is not expired
    // TODO: Validate user has permission to accept this invitation
    // TODO: Create DeviceUser record in DynamoDB  
    // TODO: Delete invitation from DynamoDB
    // TODO: Send notification to device owner

    // Mock invitation data (would come from DynamoDB)
    const mockDeviceId = 'acorn-receiver-001';
    const mockDeviceName = 'Living Room Receiver';

    const actionResponse: InvitationActionResponse = {
      invitationId,
      action: 'accepted',
      message: 'Invitation accepted successfully',
      processedAt: new Date().toISOString(),
      deviceId: mockDeviceId,
      deviceName: mockDeviceName,
    };

    console.log(`Invitation ${invitationId} accepted successfully`);

    const response = ResponseHandler.success(actionResponse, requestId);
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  } catch (error) {
    console.error('Failed to accept invitation:', error);
    
    const response = ResponseHandler.internalError(
      'Failed to accept invitation',
      requestId
    );
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  }
}; 