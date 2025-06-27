import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import ResponseHandler from '../shared/response-handler';

interface DeviceStatusResponse {
  deviceId: string;
  status: 'online' | 'offline' | 'pending';
  lastSeen: string;
  batteryLevel: number;
  signalStrength: number;
  firmwareVersion: string;
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

    // TODO: Validate user has access to this device
    // TODO: Query IoT Core device shadow for current status
    // TODO: Get latest telemetry data

    // Mock response for now
    const statusResponse: DeviceStatusResponse = {
      deviceId,
      status: Math.random() > 0.5 ? 'online' : 'offline',
      lastSeen: new Date(Date.now() - Math.random() * 3600000).toISOString(), // Random within last hour
      batteryLevel: Math.floor(Math.random() * 100),
      signalStrength: Math.floor(Math.random() * 40) - 80, // -80 to -40 dBm
      firmwareVersion: '1.2.3',
    };

    console.log(`Device status retrieved: ${deviceId}, status: ${statusResponse.status}`);

    const response = ResponseHandler.success(statusResponse, requestId);
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  } catch (error) {
    console.error('Get device status failed:', error);
    
    const response = ResponseHandler.internalError(
      'Failed to get device status',
      requestId
    );
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  }
}; 