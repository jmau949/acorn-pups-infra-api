import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { ValidationError } from './types';

type HttpStatusCode = 200 | 201 | 204 | 400 | 401 | 403 | 404 | 409 | 422 | 500 | 503;

interface ApiErrorResponse {
  error: string;
  message: string;
  requestId: string;
  validationErrors?: ValidationError[];
}

interface ApiSuccessResponse<T = any> {
  data?: T;
  requestId: string;
}

class ResponseHandler {
  private static readonly DEFAULT_HEADERS = {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  };

  static getRequestId(event: APIGatewayProxyEvent): string {
    return event.requestContext.requestId || 'unknown';
  }

  static getUserId(event: APIGatewayProxyEvent): string | null {
    // Extract user_id directly from JWT token (Cognito Sub)
    return event.requestContext.authorizer?.claims?.sub || null;
  }

  static getPathParameter(event: APIGatewayProxyEvent, paramName: string): string | null {
    return event.pathParameters?.[paramName] || null;
  }

  static parseBody<T>(event: APIGatewayProxyEvent): T | null {
    if (!event.body) return null;
    
    try {
      return JSON.parse(event.body) as T;
    } catch (error) {
      console.error('Failed to parse request body:', error);
      return null;
    }
  }

  static logRequest(event: APIGatewayProxyEvent, context: Context): void {
    console.log('Request:', {
      requestId: event.requestContext.requestId,
      httpMethod: event.httpMethod,
      path: event.path,
      headers: event.headers,
      queryStringParameters: event.queryStringParameters,
      pathParameters: event.pathParameters,
      functionName: context.functionName,
      remainingTimeInMillis: context.getRemainingTimeInMillis(),
    });
  }

  static logResponse(response: APIGatewayProxyResult, requestId: string): void {
    console.log('Response:', {
      requestId,
      statusCode: response.statusCode,
      headers: response.headers,
      body: response.body,
    });
  }

  static createResponse<T>(
    statusCode: HttpStatusCode,
    data?: T,
    error?: string,
    message?: string,
    requestId?: string,
    validationErrors?: ValidationError[]
  ): APIGatewayProxyResult {
    const headers = {
      ...ResponseHandler.DEFAULT_HEADERS,
      'X-Request-ID': requestId || 'unknown',
      'X-API-Version': '1.0',
      'X-Correlation-ID': requestId || 'unknown',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Client-Version',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Max-Age': '86400',
    };

    let body: string;
    
    if (statusCode >= 400) {
      const errorResponse: ApiErrorResponse = {
        error: error || 'Unknown error',
        message: message || 'An error occurred',
        requestId: requestId || 'unknown',
        ...(validationErrors && { validationErrors }),
      };
      body = JSON.stringify(errorResponse);
    } else {
      if (statusCode === 204) {
        body = '';
      } else {
        const successResponse: ApiSuccessResponse<T> = {
          ...(data !== undefined && { data }),
          requestId: requestId || 'unknown',
        };
        body = JSON.stringify(successResponse);
      }
    }

    return {
      statusCode,
      headers,
      body,
    };
  }

  // Success responses
  static success<T>(data: T, requestId: string, statusCode: HttpStatusCode = 200): APIGatewayProxyResult {
    return ResponseHandler.createResponse(statusCode, data, undefined, undefined, requestId);
  }

  static noContent(requestId: string): APIGatewayProxyResult {
    return ResponseHandler.createResponse(204, undefined, undefined, undefined, requestId);
  }

  // Error responses
  static badRequest(message: string, requestId: string, validationErrors?: ValidationError[]): APIGatewayProxyResult {
    return ResponseHandler.createResponse(400, undefined, 'bad_request', message, requestId, validationErrors);
  }

  static unauthorized(message: string = 'Unauthorized', requestId: string): APIGatewayProxyResult {
    return ResponseHandler.createResponse(401, undefined, 'unauthorized', message, requestId);
  }

  static forbidden(message: string = 'Forbidden', requestId: string): APIGatewayProxyResult {
    return ResponseHandler.createResponse(403, undefined, 'forbidden', message, requestId);
  }

  static notFound(message: string = 'Resource not found', requestId: string): APIGatewayProxyResult {
    return ResponseHandler.createResponse(404, undefined, 'not_found', message, requestId);
  }

  static conflict(message: string, requestId: string): APIGatewayProxyResult {
    return ResponseHandler.createResponse(409, undefined, 'conflict', message, requestId);
  }

  static validationError(message: string, validationErrors: ValidationError[], requestId: string): APIGatewayProxyResult {
    return ResponseHandler.createResponse(422, undefined, 'validation_failed', message, requestId, validationErrors);
  }

  static internalError(message: string = 'Internal server error', requestId: string): APIGatewayProxyResult {
    return ResponseHandler.createResponse(500, undefined, 'internal_server_error', message, requestId);
  }

  static serviceUnavailable(message: string = 'Service unavailable', requestId: string): APIGatewayProxyResult {
    return ResponseHandler.createResponse(503, undefined, 'service_unavailable', message, requestId);
  }
}

export default ResponseHandler; 