import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import ResponseHandler from '../shared/response-handler';

interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  environment: string;
  version: string;
  region: string;
  checks: {
    api: boolean;
    lambda: boolean;
  };
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = ResponseHandler.getRequestId(event);
  
  try {
    ResponseHandler.logRequest(event, context);
    console.log("TESTESTESTT")

    // Basic health checks
    const healthData: HealthCheckResponse = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.ENVIRONMENT || 'unknown',
      version: '1.0.0',
      region: process.env.AWS_REGION || 'unknown',
      checks: {
        api: true, // API Gateway is working if we receive this request
        lambda: true, // Lambda is working if this function executes
      },
    };

    const response = ResponseHandler.success(healthData, requestId);
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  } catch (error) {
    console.error('Health check failed:', error);
    
    const response = ResponseHandler.internalError(
      'Health check failed',
      requestId
    );
    ResponseHandler.logResponse(response, requestId);
    
    return response;
  }
}; 