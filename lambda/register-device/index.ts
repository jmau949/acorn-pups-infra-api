import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import ResponseHandler from '../shared/response-handler';

interface DeviceRegistrationRequest {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  userId: string;
}

interface DeviceRegistrationResponse {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  ownerId: string;
  registeredAt: string;
  status: 'pending' | 'active';
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = ResponseHandler.getRequestId(event);
  
  try {
    ResponseHandler.logRequest(event, context);

    // Parse and validate request body
    const body = ResponseHandler.parseBody<DeviceRegistrationRequest>(event);
    if (!body) {
      return ResponseHandler.badRequest('Invalid request body', requestId);
    }

    const { deviceId, deviceName, deviceType, userId } = body;

    // Basic validation
    if (!deviceId || !deviceName || !deviceType || !userId) {
      return ResponseHandler.badRequest(
        'Missing required fields: deviceId, deviceName, deviceType, userId',
        requestId
      );
    }

    // TODO: Validate userId from JWT token when Cognito is integrated
    // TODO: Check if device already exists
    // TODO: Generate device certificates for IoT Core
    // TODO: Save device to DynamoDB

    // Mock response for now
    const registrationResponse: DeviceRegistrationResponse = {
      deviceId,
      deviceName,
      deviceType,
      ownerId: userId,
      registeredAt: new Date().toISOString(),
      status: 'pending', // Will be 'active' once device connects to IoT Core
    };

    console.log(`Device registered: ${deviceId} for user: ${userId}`);

    const response = ResponseHandler.success(registrationResponse, requestId, 201);
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  } catch (error) {
    console.error('Device registration failed:', error);
    
    const response = ResponseHandler.internalError(
      'Failed to register device',
      requestId
    );
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  }
}; 