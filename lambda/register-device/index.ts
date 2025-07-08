import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import ResponseHandler from '../shared/response-handler';

interface DeviceRegistrationRequest {
  deviceId: string;
  deviceName: string;
  serialNumber: string;
  macAddress: string;
}

interface DeviceRegistrationResponse {
  deviceId: string;
  deviceName: string;
  serialNumber: string;
  ownerId: string;
  registeredAt: string;
  status: 'pending' | 'active';
  certificates: {
    deviceCertificate: string;
    privateKey: string;
    iotEndpoint: string;
  };
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
      return ResponseHandler.badRequest('Request body is required', requestId);
    }

    const { deviceId, deviceName, serialNumber, macAddress } = body;

    // Validate required fields
    if (!deviceId || !deviceName || !serialNumber || !macAddress) {
      return ResponseHandler.badRequest(
        'Missing required fields: deviceId, deviceName, serialNumber, macAddress',
        requestId
      );
    }

    // Basic validation patterns
    const deviceIdPattern = /^[a-zA-Z0-9\-_]+$/;
    const deviceNamePattern = /^[a-zA-Z0-9\s\-_.]+$/;
    const serialNumberPattern = /^[A-Z0-9]+$/;
    const macAddressPattern = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

    if (!deviceIdPattern.test(deviceId)) {
      return ResponseHandler.badRequest('deviceId format is invalid', requestId);
    }

    if (deviceName.length < 1 || deviceName.length > 50 || !deviceNamePattern.test(deviceName)) {
      return ResponseHandler.badRequest('deviceName format is invalid', requestId);
    }

    if (serialNumber.length < 1 || serialNumber.length > 50 || !serialNumberPattern.test(serialNumber)) {
      return ResponseHandler.badRequest('serialNumber format is invalid', requestId);
    }

    if (!macAddressPattern.test(macAddress)) {
      return ResponseHandler.badRequest('macAddress format is invalid', requestId);
    }

    // TODO: Get userId from JWT token when Cognito is integrated
    const userId = ResponseHandler.getUserId(event) || 'mock-user-id';

    // TODO: Check if device already exists (return 409 if it does)
    // TODO: Generate AWS IoT Core device certificates
    // TODO: Save device to DynamoDB

    // Mock response for now
    const registrationResponse: DeviceRegistrationResponse = {
      deviceId,
      deviceName,
      serialNumber,
      ownerId: userId,
      registeredAt: new Date().toISOString(),
      status: 'active',
      certificates: {
        deviceCertificate: '-----BEGIN CERTIFICATE-----\nMIIBIjANBgkqhkiG9w0BAQEFA...',
        privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...',
        iotEndpoint: 'a1b2c3d4e5f6g7-ats.iot.us-west-2.amazonaws.com',
      },
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