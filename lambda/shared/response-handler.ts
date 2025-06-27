import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

export interface ApiResponse<T = any> {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export interface ApiErrorResponse {
  error: string;
  message: string;
  requestId: string;
}

export interface ApiSuccessResponse<T = any> {
  data: T;
  requestId: string;
}

export class ResponseHandler {
  private static getDefaultHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': '*',
    };
  }

  static success<T>(data: T, requestId: string, statusCode: number = 200): ApiResponse<T> {
    const response: ApiSuccessResponse<T> = {
      data,
      requestId,
    };

    return {
      statusCode,
      headers: {
        ...this.getDefaultHeaders(),
        'X-Request-ID': requestId,
      },
      body: JSON.stringify(response),
    };
  }

  static error(
    error: string,
    message: string,
    requestId: string,
    statusCode: number = 400
  ): ApiResponse<ApiErrorResponse> {
    const response: ApiErrorResponse = {
      error,
      message,
      requestId,
    };

    return {
      statusCode,
      headers: {
        ...this.getDefaultHeaders(),
        'X-Request-ID': requestId,
      },
      body: JSON.stringify(response),
    };
  }

  static badRequest(message: string, requestId: string): ApiResponse<ApiErrorResponse> {
    return this.error('BadRequest', message, requestId, 400);
  }

  static unauthorized(message: string = 'Authentication required', requestId: string): ApiResponse<ApiErrorResponse> {
    return this.error('Unauthorized', message, requestId, 401);
  }

  static forbidden(message: string = 'Insufficient permissions', requestId: string): ApiResponse<ApiErrorResponse> {
    return this.error('Forbidden', message, requestId, 403);
  }

  static notFound(message: string = 'Resource not found', requestId: string): ApiResponse<ApiErrorResponse> {
    return this.error('NotFound', message, requestId, 404);
  }

  static internalError(message: string = 'Internal server error', requestId: string): ApiResponse<ApiErrorResponse> {
    return this.error('InternalServerError', message, requestId, 500);
  }

  static parseBody<T>(event: APIGatewayProxyEvent): T | null {
    try {
      if (!event.body) {
        return null;
      }
      return JSON.parse(event.body) as T;
    } catch (error) {
      console.error('Failed to parse request body:', error);
      return null;
    }
  }

  static getRequestId(event: APIGatewayProxyEvent): string {
    return event.requestContext?.requestId || 'unknown';
  }

  static getUserId(event: APIGatewayProxyEvent): string | null {
    // This will be populated when Cognito authorizer is added
    return event.requestContext?.authorizer?.claims?.sub || null;
  }

  static logRequest(event: APIGatewayProxyEvent, context: Context): void {
    const requestId = this.getRequestId(event);
    const userId = this.getUserId(event);
    
    console.log(JSON.stringify({
      requestId,
      userId,
      httpMethod: event.httpMethod,
      resourcePath: event.resource,
      pathParameters: event.pathParameters,
      queryStringParameters: event.queryStringParameters,
      userAgent: event.headers?.['User-Agent'],
      sourceIp: event.requestContext?.identity?.sourceIp,
      functionName: context.functionName,
      functionVersion: context.functionVersion,
    }));
  }

  static logResponse(response: ApiResponse, requestId: string): void {
    console.log(JSON.stringify({
      requestId,
      statusCode: response.statusCode,
      responseSize: response.body.length,
    }));
  }
}

export default ResponseHandler; 