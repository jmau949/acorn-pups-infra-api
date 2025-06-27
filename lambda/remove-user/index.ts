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
    const userId = event.pathParameters?.userId;

    if (!deviceId) {
      return ResponseHandler.badRequest('Missing deviceId parameter', requestId);
    }

    if (!userId) {
      return ResponseHandler.badRequest('Missing userId parameter', requestId);
    }

    // TODO: Validate current user has permission to remove others from this device
    // TODO: Check if device exists
    // TODO: Check if target user has access to the device
    // TODO: Prevent removing the last owner
    // TODO: Remove user access from DynamoDB
    // TODO: Send notification to removed user

    console.log(`User access removed: ${userId} from device: ${deviceId}`);

    // Return 204 No Content for successful removal
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
    console.error('Remove user access failed:', error);
    
    const response = ResponseHandler.internalError(
      'Failed to remove user access',
      requestId
    );
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  }
}; 