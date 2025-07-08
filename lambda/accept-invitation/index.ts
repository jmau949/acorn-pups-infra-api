import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import ResponseHandler from '../shared/response-handler';
import { InvitationActionResponse } from '../../lib/types';

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

    // TODO: Verify invitation exists and is valid (not expired)
    // TODO: Get invitation details from DynamoDB
    // TODO: Verify requesting user matches invitation email
    // TODO: Check if invitation already processed (return 409 if so)
    // TODO: Create DeviceUsers entry in DynamoDB
    // TODO: Mark invitation as accepted
    // TODO: Send notification to device owner

    const processedAt = new Date().toISOString();

    // Mock response for now
    const actionResponse: InvitationActionResponse = {
      invitationId,
      action: 'accepted',
      message: 'Invitation accepted successfully',
      processedAt,
      deviceId: 'acorn-receiver-001', // TODO: Get from actual invitation
      deviceName: 'Living Room Receiver', // TODO: Get from actual invitation
    };

    console.log(`Invitation ${invitationId} accepted at ${processedAt}`);

    const response = ResponseHandler.success(actionResponse, requestId);
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  } catch (error) {
    console.error('Accept invitation failed:', error);
    
    const response = ResponseHandler.internalError(
      'Failed to accept invitation',
      requestId
    );
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  }
}; 