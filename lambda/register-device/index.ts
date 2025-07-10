import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { IoTClient, CreateKeysAndCertificateCommand, CreateThingCommand, AttachPolicyCommand, AttachThingPrincipalCommand, DescribeEndpointCommand } from '@aws-sdk/client-iot';
import { v4 as uuidv4 } from 'uuid';
import ResponseHandler from '../shared/response-handler';
import { DynamoDBHelper } from '../shared/dynamodb-client';

// ==== Device Registration Types (specific to this lambda) ====

interface DeviceRegistrationRequest {
  deviceId: string;
  deviceName: string;
  serialNumber: string;
  macAddress: string;
}

interface DeviceCertificates {
  deviceCertificate: string;
  privateKey: string;
  iotEndpoint: string;
}

interface DeviceRegistrationResponse {
  deviceId: string;
  deviceName: string;
  serialNumber: string;
  ownerId: string;
  registeredAt: string;
  status: 'pending' | 'active';
  certificates: DeviceCertificates;
}

// Initialize IoT client
const iotClient = new IoTClient({
  region: process.env.REGION || 'us-east-1',
});

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

    // Basic validation patterns - loosened to avoid false rejections
    const deviceIdPattern = /^[a-zA-Z0-9_.@#+-]+$/; // Allow common special characters
    const deviceNamePattern = /^[\p{L}\p{N}\p{P}\p{Z}]+$/u; // Allow Unicode letters, numbers, punctuation, and spaces
    // Permissive serial number pattern - allows alphanumeric and common special chars
    const serialNumberPattern = /^[\w\-.@#+&(){}[\]/\\|*%$!~`'"<>?=^]+$/;
    // More flexible MAC address pattern - accepts various separators and formats
    const macAddressPattern = /^([0-9A-Fa-f]{2}[:.\-]?){5}[0-9A-Fa-f]{2}$|^[0-9A-Fa-f]{12}$/;


    if (!deviceIdPattern.test(deviceId)) {
      return ResponseHandler.badRequest('deviceId contains invalid characters', requestId);
    }

    if (deviceName.length < 1 || deviceName.length > 100 || !deviceNamePattern.test(deviceName)) {
      return ResponseHandler.badRequest('deviceName format is invalid or too long (max 100 characters)', requestId);
    }

    if (serialNumber.length < 1 || serialNumber.length > 100 || !serialNumberPattern.test(serialNumber)) {
      return ResponseHandler.badRequest('serialNumber format is invalid or too long (max 100 characters)', requestId);
    }

    if (!macAddressPattern.test(macAddress)) {
      return ResponseHandler.badRequest('macAddress format is invalid', requestId);
    }

    // Get cognito_sub from JWT token
    const cognitoSub = event.requestContext.authorizer?.claims?.sub;
    if (!cognitoSub) {
      return ResponseHandler.unauthorized('Valid JWT token required', requestId);
    }

    // Look up user by cognito_sub
    const users = await DynamoDBHelper.getUserByCognitoSub(cognitoSub);
    if (!users || users.length === 0) {
      return ResponseHandler.unauthorized('User not found', requestId);
    }

    const user = users[0];
    const userId = user.user_id;
    console.log(`Device registration requested by user: ${userId}`);

    // Check if device with this serial number already exists
    const existingDevices = await DynamoDBHelper.getDeviceBySerial(serialNumber);
    if (existingDevices && existingDevices.length > 0) {
      return ResponseHandler.conflict('Device with this serial number already exists', requestId);
    }

    // Generate unique device UUID
    const deviceUuid = uuidv4();
    const iotThingName = `acorn-receiver-${deviceUuid}`;

    // Create AWS IoT Core managed certificate
    console.log('Creating IoT certificate...');
    const createCertCommand = new CreateKeysAndCertificateCommand({
      setAsActive: true,
    });
    const certResponse = await iotClient.send(createCertCommand);

    if (!certResponse.certificateArn || !certResponse.certificatePem || !certResponse.keyPair?.PrivateKey) {
      throw new Error('Failed to create IoT certificate');
    }

    // Create IoT Thing
    console.log(`Creating IoT Thing: ${iotThingName}`);
    const createThingCommand = new CreateThingCommand({
      thingName: iotThingName,
      thingTypeName: `AcornPupsReceiver-${process.env.ENVIRONMENT}`,
      attributePayload: {
        attributes: {
          deviceId: deviceUuid,
          serialNumber: serialNumber,
          macAddress: macAddress,
          ownerId: userId,
        },
      },
    });
    await iotClient.send(createThingCommand);

    // Attach device policy to certificate
    const policyName = `AcornPupsReceiverPolicy-${process.env.ENVIRONMENT}`;
    console.log(`Attaching policy: ${policyName}`);
    const attachPolicyCommand = new AttachPolicyCommand({
      policyName: policyName,
      target: certResponse.certificateArn,
    });
    await iotClient.send(attachPolicyCommand);

    // Attach certificate to Thing
    console.log('Attaching certificate to Thing...');
    const attachThingCommand = new AttachThingPrincipalCommand({
      thingName: iotThingName,
      principal: certResponse.certificateArn,
    });
    await iotClient.send(attachThingCommand);

    // Get IoT endpoint
    const endpointCommand = new DescribeEndpointCommand({
      endpointType: 'iot:Data-ATS',
    });
    const endpointResponse = await iotClient.send(endpointCommand);

    if (!endpointResponse.endpointAddress) {
      throw new Error('Failed to get IoT endpoint');
    }

    const now = new Date().toISOString();

    // Use transaction to ensure atomicity of DynamoDB operations
    console.log('Creating database records atomically...');
    await DynamoDBHelper.transactWrite([
      // Device metadata record
      {
        action: 'Put',
        tableParam: 'devices',
        item: {
          PK: `DEVICE#${deviceUuid}`,
          SK: 'METADATA',
          device_id: deviceUuid,
          serial_number: serialNumber,
          mac_address: macAddress,
          device_name: deviceName,
          owner_user_id: userId,
          firmware_version: '1.0.0',
          hardware_version: '1.0',
          is_online: false,
          last_seen: now,
          wifi_ssid: '',
          signal_strength: 0,
          created_at: now,
          updated_at: now,
          is_active: true,
          iot_thing_name: iotThingName,
          iot_certificate_arn: certResponse.certificateArn,
        },
        // Note: Serial number uniqueness is enforced by the pre-check using GSI
      },
      // Device settings record
      {
        action: 'Put',
        tableParam: 'devices',
        item: {
          PK: `DEVICE#${deviceUuid}`,
          SK: 'SETTINGS',
          device_id: deviceUuid,
          sound_enabled: true,
          sound_volume: 7,
          led_brightness: 5,
          notification_cooldown: 30,
          quiet_hours_enabled: false,
          quiet_hours_start: '22:00',
          quiet_hours_end: '07:00',
          updated_at: now,
        },
      },
      // Device-user relationship (owner)
      {
        action: 'Put',
        tableParam: 'device-users',
        item: {
          PK: `DEVICE#${deviceUuid}`,
          SK: `USER#${userId}`,
          device_id: deviceUuid,
          user_id: userId,
          notifications_permission: true,
          settings_permission: true,
          notifications_enabled: true,
          notification_sound: 'default',
          notification_vibration: true,
          quiet_hours_enabled: false,
          quiet_hours_start: '22:00',
          quiet_hours_end: '07:00',
          custom_notification_sound: '',
          device_nickname: deviceName,
          invited_by: userId, // Owner invited themselves
          invited_at: now,
          accepted_at: now,
          is_active: true,
        },
      },
    ]);

    // Prepare response
    const registrationResponse: DeviceRegistrationResponse = {
      deviceId: deviceUuid,
      deviceName: deviceName,
      serialNumber: serialNumber,
      ownerId: userId,
      registeredAt: now,
      status: 'active',
      certificates: {
        deviceCertificate: certResponse.certificatePem,
        privateKey: certResponse.keyPair.PrivateKey,
        iotEndpoint: endpointResponse.endpointAddress,
      },
    };

    console.log(`Device registered successfully: ${deviceUuid} for user: ${userId}`);

    const response = ResponseHandler.success(registrationResponse, requestId, 201);
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  } catch (error) {
    console.error('Device registration failed:', error);
    
    // Determine if this is a client error or server error
    let errorMessage = 'Failed to register device';
    let statusCode = 500;
    
    if (error instanceof Error) {
      if (error.message.includes('User not found')) {
        statusCode = 401;
        errorMessage = 'User authentication failed';
      } else if (error.message.includes('already exists') || error.message.includes('ConditionalCheckFailedException')) {
        statusCode = 409;
        errorMessage = 'Device with this serial number already exists';
      } else if (error.message.includes('validation') || error.message.includes('invalid')) {
        statusCode = 400;
        errorMessage = error.message;
      }
    }
    
    const response = statusCode === 500 
      ? ResponseHandler.internalError(errorMessage, requestId)
      : ResponseHandler.createResponse(statusCode as any, undefined, 'registration_failed', errorMessage, requestId);
    
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  }
}; 