import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import ResponseHandler from '../shared/response-handler';

interface ButtonPress {
  timestamp: string;
  duration: number;
  batteryLevel: number;
  signalStrength: number;
}

interface DeviceHistoryResponse {
  deviceId: string;
  presses: ButtonPress[];
  total: number;
  hasMore: boolean;
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

    // Parse query parameters
    const limit = parseInt(event.queryStringParameters?.limit || '50');
    const startTime = event.queryStringParameters?.startTime;
    const endTime = event.queryStringParameters?.endTime;

    // Validate limit
    if (limit < 1 || limit > 100) {
      return ResponseHandler.badRequest('Limit must be between 1 and 100', requestId);
    }

    // TODO: Validate user has access to this device
    // TODO: Query DynamoDB for button press history
    // TODO: Apply time filters and pagination

    // Mock response for now
    const mockPresses: ButtonPress[] = [];
    const pressCount = Math.min(limit, Math.floor(Math.random() * 20) + 5);
    
    for (let i = 0; i < pressCount; i++) {
      mockPresses.push({
        timestamp: new Date(Date.now() - (i + 1) * 300000).toISOString(), // Every 5 minutes
        duration: Math.floor(Math.random() * 2000) + 500, // 500-2500ms
        batteryLevel: Math.floor(Math.random() * 100),
        signalStrength: Math.floor(Math.random() * 40) - 80,
      });
    }

    const historyResponse: DeviceHistoryResponse = {
      deviceId,
      presses: mockPresses,
      total: mockPresses.length,
      hasMore: false, // Mock data doesn't have pagination
    };

    console.log(`Device history retrieved: ${deviceId}, ${mockPresses.length} presses`);

    const response = ResponseHandler.success(historyResponse, requestId);
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  } catch (error) {
    console.error('Get device history failed:', error);
    
    const response = ResponseHandler.internalError(
      'Failed to get device history',
      requestId
    );
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  }
}; 