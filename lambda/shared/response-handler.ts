import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { ValidationError, ValidationErrorResponse, ErrorCode, ERROR_CODES } from '../../lib/types';

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
  private static getDefaultHeaders(requestId: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,X-Requested-With,X-Correlation-ID,X-Client-Version',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Expose-Headers': 'X-Request-ID,X-API-Version',
      'X-Request-ID': requestId,
      'X-API-Version': '1.0.0',
    };
  }

  static success<T>(data: T, requestId: string, statusCode: number = 200): ApiResponse<T> {
    const response: ApiSuccessResponse<T> = {
      data,
      requestId,
    };

    return {
      statusCode,
      headers: this.getDefaultHeaders(requestId),
      body: JSON.stringify(response),
    };
  }

  static error(
    error: ErrorCode,
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
      headers: this.getDefaultHeaders(requestId),
      body: JSON.stringify(response),
    };
  }

  static validationError(
    message: string,
    requestId: string,
    validationErrors: ValidationError[]
  ): ApiResponse<ValidationErrorResponse> {
    const response: ValidationErrorResponse = {
      error: ERROR_CODES.VALIDATION_FAILED,
      message,
      requestId,
      validationErrors,
    };

    return {
      statusCode: 400,
      headers: this.getDefaultHeaders(requestId),
      body: JSON.stringify(response),
    };
  }

  static badRequest(message: string, requestId: string): ApiResponse<ApiErrorResponse> {
    return this.error(ERROR_CODES.VALIDATION_FAILED, message, requestId, 400);
  }

  static unauthorized(message: string = 'Authentication required', requestId: string): ApiResponse<ApiErrorResponse> {
    return this.error(ERROR_CODES.UNAUTHORIZED, message, requestId, 401);
  }

  static forbidden(message: string = 'Insufficient permissions to access this resource', requestId: string): ApiResponse<ApiErrorResponse> {
    return this.error(ERROR_CODES.FORBIDDEN, message, requestId, 403);
  }

  static notFound(message: string = 'Resource not found', requestId: string): ApiResponse<ApiErrorResponse> {
    return this.error(ERROR_CODES.RESOURCE_NOT_FOUND, message, requestId, 404);
  }

  static userNotFound(requestId: string): ApiResponse<ApiErrorResponse> {
    return this.error(ERROR_CODES.USER_NOT_FOUND, 'User not found', requestId, 404);
  }

  static deviceNotFound(requestId: string): ApiResponse<ApiErrorResponse> {
    return this.error(ERROR_CODES.DEVICE_NOT_FOUND, 'Device not found', requestId, 404);
  }

  static invitationNotFound(requestId: string): ApiResponse<ApiErrorResponse> {
    return this.error(ERROR_CODES.INVITATION_NOT_FOUND, 'Invitation not found or has expired', requestId, 404);
  }

  static deviceAlreadyExists(requestId: string): ApiResponse<ApiErrorResponse> {
    return this.error(ERROR_CODES.DEVICE_ALREADY_EXISTS, 'Device with this serial number already exists', requestId, 409);
  }

  static invitationAlreadyProcessed(requestId: string): ApiResponse<ApiErrorResponse> {
    return this.error(ERROR_CODES.INVITATION_ALREADY_PROCESSED, 'This invitation has already been processed', requestId, 409);
  }

  static serviceUnavailable(message: string = 'API is temporarily unavailable', requestId: string): ApiResponse<ApiErrorResponse> {
    return this.error(ERROR_CODES.SERVICE_UNAVAILABLE, message, requestId, 503);
  }

  static internalError(message: string = 'Internal server error', requestId: string): ApiResponse<ApiErrorResponse> {
    return this.error(ERROR_CODES.INTERNAL_SERVER_ERROR, message, requestId, 500);
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
    return event.requestContext?.requestId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  static getUserId(event: APIGatewayProxyEvent): string | null {
    // This will be populated when Cognito authorizer is added
    return event.requestContext?.authorizer?.claims?.sub || null;
  }

  static getPathParameter(event: APIGatewayProxyEvent, paramName: string): string | null {
    return event.pathParameters?.[paramName] || null;
  }

  static getQueryParameter(event: APIGatewayProxyEvent, paramName: string): string | null {
    return event.queryStringParameters?.[paramName] || null;
  }

  static getHeader(event: APIGatewayProxyEvent, headerName: string): string | null {
    return event.headers?.[headerName] || event.headers?.[headerName.toLowerCase()] || null;
  }

  static getCorrelationId(event: APIGatewayProxyEvent): string | null {
    return this.getHeader(event, 'X-Correlation-ID');
  }

  static getClientVersion(event: APIGatewayProxyEvent): string | null {
    return this.getHeader(event, 'X-Client-Version');
  }

  static logRequest(event: APIGatewayProxyEvent, context: Context): void {
    const requestId = this.getRequestId(event);
    const userId = this.getUserId(event);
    const correlationId = this.getCorrelationId(event);
    const clientVersion = this.getClientVersion(event);
    
    console.log(JSON.stringify({
      requestId,
      correlationId,
      userId,
      clientVersion,
      httpMethod: event.httpMethod,
      resourcePath: event.resource,
      pathParameters: event.pathParameters,
      queryStringParameters: event.queryStringParameters,
      userAgent: event.headers?.['User-Agent'] || event.headers?.['user-agent'],
      sourceIp: event.requestContext?.identity?.sourceIp,
      functionName: context.functionName,
      functionVersion: context.functionVersion,
      timestamp: new Date().toISOString(),
    }));
  }

  static logResponse(response: ApiResponse, requestId: string): void {
    console.log(JSON.stringify({
      requestId,
      statusCode: response.statusCode,
      responseSize: response.body.length,
      timestamp: new Date().toISOString(),
    }));
  }

  static validateRequired(fields: Record<string, any>, requestId: string): ValidationError[] {
    const errors: ValidationError[] = [];

    Object.entries(fields).forEach(([field, value]) => {
      if (value === undefined || value === null || value === '') {
        errors.push({
          field,
          message: `${field} is required`,
        });
      }
    });

    return errors;
  }

  static validateString(
    value: string,
    field: string,
    minLength?: number,
    maxLength?: number,
    pattern?: RegExp
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    if (minLength !== undefined && value.length < minLength) {
      errors.push({
        field,
        message: `${field} must be at least ${minLength} characters`,
      });
    }

    if (maxLength !== undefined && value.length > maxLength) {
      errors.push({
        field,
        message: `${field} must be at most ${maxLength} characters`,
      });
    }

    if (pattern && !pattern.test(value)) {
      errors.push({
        field,
        message: `${field} format is invalid`,
      });
    }

    return errors;
  }

  static validateNumber(
    value: number,
    field: string,
    min?: number,
    max?: number
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    if (min !== undefined && value < min) {
      errors.push({
        field,
        message: `${field} must be at least ${min}`,
      });
    }

    if (max !== undefined && value > max) {
      errors.push({
        field,
        message: `${field} must be at most ${max}`,
      });
    }

    return errors;
  }

  static validateEmail(value: string, field: string): ValidationError[] {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return this.validateString(value, field, 5, 254, emailPattern);
  }

  static noContent(requestId: string): ApiResponse<never> {
    return {
      statusCode: 204,
      headers: this.getDefaultHeaders(requestId),
      body: '',
    };
  }
}

export default ResponseHandler; 