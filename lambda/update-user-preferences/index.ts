import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import ResponseHandler from '../shared/response-handler';

interface UserPreferencesRequest {
  notifications?: {
    pushEnabled?: boolean;
    emailEnabled?: boolean;
    quietHours?: {
      enabled?: boolean;
      startTime?: string;
      endTime?: string;
    };
  };
  app?: {
    theme?: 'light' | 'dark' | 'auto';
    language?: string;
  };
}

interface UserPreferencesResponse {
  userId: string;
  notifications: {
    pushEnabled: boolean;
    emailEnabled: boolean;
    quietHours: {
      enabled: boolean;
      startTime: string;
      endTime: string;
    };
  };
  app: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
  };
  updatedAt: string;
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = ResponseHandler.getRequestId(event);
  
  try {
    ResponseHandler.logRequest(event, context);

    const userId = event.pathParameters?.userId;
    if (!userId) {
      return ResponseHandler.badRequest('Missing userId parameter', requestId);
    }

    // Parse request body
    const body = ResponseHandler.parseBody<UserPreferencesRequest>(event);
    if (!body) {
      return ResponseHandler.badRequest('Invalid request body', requestId);
    }

    // TODO: Validate user is updating their own preferences or has admin access
    // TODO: Validate preference values
    // TODO: Update preferences in DynamoDB

    // Mock response for now
    const preferencesResponse: UserPreferencesResponse = {
      userId,
      notifications: {
        pushEnabled: body.notifications?.pushEnabled ?? true,
        emailEnabled: body.notifications?.emailEnabled ?? false,
        quietHours: {
          enabled: body.notifications?.quietHours?.enabled ?? false,
          startTime: body.notifications?.quietHours?.startTime ?? '22:00',
          endTime: body.notifications?.quietHours?.endTime ?? '08:00',
        },
      },
      app: {
        theme: body.app?.theme ?? 'auto',
        language: body.app?.language ?? 'en-US',
      },
      updatedAt: new Date().toISOString(),
    };

    console.log(`User preferences updated: ${userId}`);

    const response = ResponseHandler.success(preferencesResponse, requestId);
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  } catch (error) {
    console.error('Update user preferences failed:', error);
    
    const response = ResponseHandler.internalError(
      'Failed to update user preferences',
      requestId
    );
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  }
}; 