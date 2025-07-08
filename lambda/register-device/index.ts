import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import ResponseHandler from '../shared/response-handler';
import { 
  DeviceRegistrationRequest, 
  DeviceRegistrationResponse, 
  ValidationError,
  VALIDATION_CONSTRAINTS 
} from '../../lib/types';

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
    const requiredFields = {
      deviceId,
      deviceName,
      serialNumber,
      macAddress,
    };

    const validationErrors: ValidationError[] = [];
    
    // Required field validation
    validationErrors.push(...ResponseHandler.validateRequired(requiredFields, requestId));

    // Field-specific validation
    if (deviceId) {
      validationErrors.push(...ResponseHandler.validateString(
        deviceId,
        'deviceId',
        VALIDATION_CONSTRAINTS.DEVICE_ID.MIN_LENGTH,
        VALIDATION_CONSTRAINTS.DEVICE_ID.MAX_LENGTH,
        VALIDATION_CONSTRAINTS.DEVICE_ID.PATTERN
      ));
    }

    if (deviceName) {
      validationErrors.push(...ResponseHandler.validateString(
        deviceName,
        'deviceName',
        VALIDATION_CONSTRAINTS.DEVICE_NAME.MIN_LENGTH,
        VALIDATION_CONSTRAINTS.DEVICE_NAME.MAX_LENGTH,
        VALIDATION_CONSTRAINTS.DEVICE_NAME.PATTERN
      ));
    }

    if (serialNumber) {
      validationErrors.push(...ResponseHandler.validateString(
        serialNumber,
        'serialNumber',
        VALIDATION_CONSTRAINTS.SERIAL_NUMBER.MIN_LENGTH,
        VALIDATION_CONSTRAINTS.SERIAL_NUMBER.MAX_LENGTH,
        VALIDATION_CONSTRAINTS.SERIAL_NUMBER.PATTERN
      ));
    }

    if (macAddress) {
      validationErrors.push(...ResponseHandler.validateString(
        macAddress,
        'macAddress',
        undefined,
        undefined,
        VALIDATION_CONSTRAINTS.MAC_ADDRESS.PATTERN
      ));
    }

    // Return validation errors if any
    if (validationErrors.length > 0) {
      return ResponseHandler.validationError(
        'Request validation failed',
        requestId,
        validationErrors
      );
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