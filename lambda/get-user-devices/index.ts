import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import ResponseHandler from '../shared/response-handler';
import { DynamoDBHelper } from '../shared/dynamodb-client';
import { DeviceMetadata, DeviceSettings, DeviceUser } from '../shared/types';

// ==== User Devices Types (specific to this lambda) ====

interface DeviceSettingsResponse {
  soundEnabled: boolean;
  soundVolume: number;
  ledBrightness: number;
  notificationCooldown: number;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

interface UserDevice {
  deviceId: string;
  deviceInstanceId: string;
  deviceName: string;
  serialNumber: string;
  isOnline: boolean;
  lastSeen: string;
  registeredAt: string;
  lastResetAt?: string;
  firmwareVersion: string;
  settings: DeviceSettingsResponse;
  permissions: {
    notifications: boolean;
    settings: boolean;
  };
}

interface UserDevicesResponse {
  devices: UserDevice[];
  total: number;
}

/**
 * Get User's Devices
 * 
 * Retrieves all devices accessible by the specified user, including:
 * - Device metadata with new device_instance_id field
 * - Device settings and user permissions
 * - Online status and firmware information
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = ResponseHandler.getRequestId(event);
  
  try {
    ResponseHandler.logRequest(event, context);

    // Get userId from path parameters
    const userId = ResponseHandler.getPathParameter(event, 'userId');
    if (!userId) {
      return ResponseHandler.badRequest('userId path parameter is required', requestId);
    }

    // Validate UUID format (accept any valid UUID format, not just v4)
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(userId)) {
      return ResponseHandler.badRequest('Invalid userId format', requestId);
    }

    // Get requesting user_id directly from JWT token (Cognito Sub)
    const requestingUserId = event.requestContext.authorizer?.claims?.sub;
    if (!requestingUserId) {
      return ResponseHandler.unauthorized('Valid JWT token required', requestId);
    }

    // Verify the requesting user has permission to access this user's devices
    // Users can only access their own devices
    if (requestingUserId !== userId) {
      return ResponseHandler.forbidden('You can only access your own devices', requestId);
    }

    console.log(`Getting devices for user: ${userId}`);

    // Get all device-user relationships for this user
    const deviceUserRelationships = await DynamoDBHelper.getUserDevices(userId);
    
    if (!deviceUserRelationships || deviceUserRelationships.length === 0) {
      console.log(`No devices found for user: ${userId}`);
      const emptyResponse: UserDevicesResponse = {
        devices: [],
        total: 0,
      };
      return ResponseHandler.success(emptyResponse, requestId);
    }

    console.log(`Found ${deviceUserRelationships.length} device relationships for user: ${userId}`);

    // Fetch device details for each device the user has access to
    const devices: UserDevice[] = [];
    
    for (const deviceUser of deviceUserRelationships as DeviceUser[]) {
      try {
        // Skip inactive relationships
        if (!deviceUser.is_active) {
          continue;
        }

        // Get device metadata
        const deviceMetadata = await DynamoDBHelper.getDeviceMetadata(deviceUser.device_id) as DeviceMetadata | undefined;
        if (!deviceMetadata) {
          console.warn(`Device metadata not found for device: ${deviceUser.device_id}`);
          continue;
        }

        // Get device settings
        const deviceSettings = await DynamoDBHelper.getDeviceSettings(deviceUser.device_id) as DeviceSettings | undefined;
        if (!deviceSettings) {
          console.warn(`Device settings not found for device: ${deviceUser.device_id}`);
          continue;
        }

        // Build the user device response
        const userDevice: UserDevice = {
          deviceId: deviceMetadata.device_id,
          deviceInstanceId: deviceMetadata.device_instance_id, // Include instance ID
          deviceName: deviceUser.device_nickname || deviceMetadata.device_name,
          serialNumber: deviceMetadata.serial_number,
          isOnline: deviceMetadata.is_online,
          lastSeen: deviceMetadata.last_seen,
          registeredAt: deviceMetadata.created_at,
          lastResetAt: deviceMetadata.last_reset_at, // Include last reset timestamp
          firmwareVersion: deviceMetadata.firmware_version,
          settings: {
            soundEnabled: deviceSettings.sound_enabled,
            soundVolume: deviceSettings.sound_volume,
            ledBrightness: deviceSettings.led_brightness,
            notificationCooldown: deviceSettings.notification_cooldown,
            quietHoursEnabled: deviceSettings.quiet_hours_enabled,
            quietHoursStart: deviceSettings.quiet_hours_start,
            quietHoursEnd: deviceSettings.quiet_hours_end,
          },
          permissions: {
            notifications: deviceUser.notifications_permission,
            settings: deviceUser.settings_permission,
          },
        };

        devices.push(userDevice);
      } catch (error) {
        console.error(`Error processing device ${deviceUser.device_id}:`, error);
        // Continue processing other devices
      }
    }

    const userDevicesResponse: UserDevicesResponse = {
      devices: devices,
      total: devices.length,
    };

    console.log(`Retrieved ${devices.length} devices for user: ${userId}`);

    const response = ResponseHandler.success(userDevicesResponse, requestId);
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  } catch (error) {
    console.error('Failed to get user devices:', error);
    
    // Handle specific error types
    if (error instanceof Error && error.message.includes('User not found')) {
      return ResponseHandler.notFound('User not found', requestId);
    }
    
    const response = ResponseHandler.internalError(
      'Failed to retrieve user devices',
      requestId
    );
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  }
}; 