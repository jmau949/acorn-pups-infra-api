import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { StackProps } from 'aws-cdk-lib';

// IoT Core constants
export const IOT_CLIENT_ID_PATTERN = 'acorn-receiver-*';

export interface BaseStackProps extends StackProps {
  environment: string;
  apiGatewayStageName: string;
  domainPrefix: string;
  logLevel: string;
  throttleRateLimit: number;
  throttleBurstLimit: number;
}

export interface LambdaStackProps extends BaseStackProps {}

export interface ApiGatewayStackProps extends BaseStackProps {
  lambdaFunctions: LambdaFunctions;
}

export interface MonitoringStackProps extends BaseStackProps {
  apiGateway: apigateway.RestApi;
  lambdaFunctions: LambdaFunctions;
}

export interface PipelineStackProps extends StackProps {
  repositoryName: string;
  branch: string;
}

export interface IotPolicyStackProps extends StackProps {
  environment: string;
}

export interface LambdaFunctions {
  // Health and System
  healthCheck: lambda.Function;
  
  // Device Management
  registerDevice: lambda.Function;
  getUserDevices: lambda.Function;
  updateDeviceSettings: lambda.Function;
  updateDeviceStatus: lambda.Function;
  resetDevice: lambda.Function;
  
  // User Management  
  inviteUser: lambda.Function;
  removeUserAccess: lambda.Function;
  getUserInvitations: lambda.Function;
  
  // Invitation Management
  acceptInvitation: lambda.Function;
  declineInvitation: lambda.Function;
  
  // IoT Event Processing
  handleButtonPress: lambda.Function;
  handleDeviceLifecycle: lambda.Function;
  factoryReset: lambda.Function;
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

export interface DeviceRegistrationRequest {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  userId: string;
}

export interface DeviceSettingsRequest {
  buttonSensitivity?: number;
  notificationPreferences?: {
    pushEnabled: boolean;
    emailEnabled: boolean;
  };
}

export interface UserInviteRequest {
  email: string;
  role: 'owner' | 'viewer';
} 