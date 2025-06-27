import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import ResponseHandler from '../shared/response-handler';

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

    // TODO: Validate user owns this device or has permission to delete
    // TODO: Check if device exists
    // TODO: Delete device from DynamoDB
    // TODO: Revoke IoT certificates
    // TODO: Remove all user access
    // TODO: Delete device history

    console.log(`Device deleted: ${deviceId}`);

    // Return 204 No Content for successful deletion
    const response = {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'X-Request-ID': requestId,
      },
      body: '',
    };

    ResponseHandler.logResponse(response, requestId);
    return response;
  } catch (error) {
    console.error('Delete device failed:', error);
    
    const response = ResponseHandler.internalError(
      'Failed to delete device',
      requestId
    );
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  }
}; 