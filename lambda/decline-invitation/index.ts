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

    // TODO: Validate invitation exists and is not expired
    // TODO: Validate user has permission to decline this invitation (from JWT token)
    // TODO: Delete invitation from DynamoDB
    // TODO: Send notification to device owner (optional)

    // Mock invitation data (would come from DynamoDB)
    const mockDeviceId = 'acorn-receiver-001';
    const mockDeviceName = 'Living Room Receiver';

    const actionResponse: InvitationActionResponse = {
      invitationId,
      action: 'declined',
      message: 'Invitation declined successfully',
      processedAt: new Date().toISOString(),
      deviceId: mockDeviceId,
      deviceName: mockDeviceName,
    };

    console.log(`Invitation ${invitationId} declined successfully`);

    const response = ResponseHandler.success(actionResponse, requestId);
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  } catch (error) {
    console.error('Failed to decline invitation:', error);
    
    const response = ResponseHandler.internalError(
      'Failed to decline invitation',
      requestId
    );
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  }
}; 