import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBHelper } from '../shared/dynamodb-client';
import ResponseHandler from '../shared/response-handler';

// Table parameter for DynamoDB operations  
const TABLE_PARAM = 'user-endpoints'; // Uses parameter store path, not the constant

interface PushTokenRequest {
  expoPushToken: string;
  deviceFingerprint: string;
  platform: 'ios' | 'android';
  deviceInfo: string;
}

interface UserEndpoint {
  PK: string;
  SK: string;
  user_id: string;
  device_fingerprint: string;
  expo_push_token: string;
  platform: string;
  device_info: string;
  is_active: boolean;
  created_at: string;
  last_used?: string;
  updated_at: string;
}

export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  ResponseHandler.logRequest(event, context);
  const requestId = ResponseHandler.getRequestId(event);

  try {
    // Extract user ID from JWT token (Cognito Sub)
    const userId = ResponseHandler.getUserId(event);
    if (!userId) {
      return ResponseHandler.unauthorized('User not authenticated', requestId);
    }

    // Parse request body
    const body = ResponseHandler.parseBody<PushTokenRequest>(event);
    if (!body) {
      return ResponseHandler.badRequest('Invalid request body', requestId);
    }

    const { expoPushToken, deviceFingerprint, platform, deviceInfo } = body;

    // Validate required fields
    if (!expoPushToken || !deviceFingerprint || !platform || !deviceInfo) {
      return ResponseHandler.badRequest('Missing required fields', requestId, [
        { field: 'expoPushToken', message: 'Expo push token is required' },
        { field: 'deviceFingerprint', message: 'Device fingerprint is required' },
        { field: 'platform', message: 'Platform is required' },
        { field: 'deviceInfo', message: 'Device info is required' },
      ]);
    }

    // Validate Expo push token format
    if (!expoPushToken.match(/^ExponentPushToken\[.+\]$/)) {
      return ResponseHandler.badRequest('Invalid Expo push token format', requestId, [
        { field: 'expoPushToken', message: 'Token must be in format ExponentPushToken[...]' },
      ]);
    }

    // Validate platform
    if (!['ios', 'android'].includes(platform)) {
      return ResponseHandler.badRequest('Invalid platform', requestId, [
        { field: 'platform', message: 'Platform must be either ios or android' },
      ]);
    }

    console.log('Processing push token registration:', {
      userId,
      deviceFingerprint,
      platform,
      requestId,
    });

    // Check if endpoint already exists
    const existingEndpoint = await DynamoDBHelper.getItem(
      TABLE_PARAM,
      {
        PK: `USER#${userId}`,
        SK: `ENDPOINT#${deviceFingerprint}`,
      }
    ) as UserEndpoint | undefined;

    let action: 'created' | 'updated' | 'unchanged' = 'created';
    let tokenChanged = false;
    const now = new Date().toISOString();

    if (existingEndpoint) {
      // Endpoint exists, check if token changed
      if (existingEndpoint.expo_push_token === expoPushToken) {
        // Token unchanged
        action = 'unchanged';
        console.log('Push token unchanged for device:', deviceFingerprint);
      } else {
        // Token changed, update it
        action = 'updated';
        tokenChanged = true;
        console.log('Push token changed for device:', deviceFingerprint);

        await DynamoDBHelper.updateItem(
          TABLE_PARAM,
          {
            PK: `USER#${userId}`,
            SK: `ENDPOINT#${deviceFingerprint}`,
          },
          'SET expo_push_token = :token, platform = :platform, device_info = :deviceInfo, is_active = :active, updated_at = :updatedAt',
          {
            ':token': expoPushToken,
            ':platform': platform,
            ':deviceInfo': deviceInfo,
            ':active': true,
            ':updatedAt': now,
          }
        );
      }
    } else {
      // New endpoint, create it
      const newEndpoint: UserEndpoint = {
        PK: `USER#${userId}`,
        SK: `ENDPOINT#${deviceFingerprint}`,
        user_id: userId,
        device_fingerprint: deviceFingerprint,
        expo_push_token: expoPushToken,
        platform,
        device_info: deviceInfo,
        is_active: true,
        created_at: now,
        updated_at: now,
      };

      await DynamoDBHelper.putItem(TABLE_PARAM, newEndpoint);
      tokenChanged = true;
      console.log('Created new push endpoint for device:', deviceFingerprint);
    }

    const response = {
      userId,
      deviceFingerprint,
      action,
      message: `Push token ${action} successfully`,
      tokenChanged,
      isActive: true,
      registeredAt: existingEndpoint?.created_at || now,
    };

    return ResponseHandler.success(response, requestId);
  } catch (error) {
    console.error('Error registering push token:', {
      error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      requestId,
    });
    return ResponseHandler.internalError(
      'Failed to register push token',
      requestId
    );
  }
};