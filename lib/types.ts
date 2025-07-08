import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { StackProps } from 'aws-cdk-lib';

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
}

// ==== Base Response Types ====

export interface ApiErrorResponse {
  error: string;
  message: string;
  requestId: string;
}

export interface ApiSuccessResponse<T = any> {
  data: T;
  requestId: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationErrorResponse extends ApiErrorResponse {
  validationErrors: ValidationError[];
}

// ==== Health Check Types ====

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  environment: string;
  version: string;
  region: string;
  checks: {
    api: boolean;
    lambda: boolean;
    dynamodb: boolean;
  };
}

// ==== Device Management Types ====

export interface DeviceRegistrationRequest {
  deviceId: string;
  deviceName: string;
  serialNumber: string;
  macAddress: string;
}

export interface DeviceRegistrationResponse {
  deviceId: string;
  deviceName: string;
  serialNumber: string;
  ownerId: string;
  registeredAt: string;
  status: 'pending' | 'active';
  certificates: {
    deviceCertificate: string;
    privateKey: string;
    iotEndpoint: string;
  };
}

export interface DeviceSettings {
  soundEnabled: boolean;
  soundVolume: number; // 1-10
  ledBrightness: number; // 1-10
  notificationCooldown: number; // 0-300 seconds
  quietHoursEnabled: boolean;
  quietHoursStart?: string; // HH:MM format
  quietHoursEnd?: string; // HH:MM format
}

export interface DeviceSettingsRequest {
  soundEnabled?: boolean;
  soundVolume?: number;
  ledBrightness?: number;
  notificationCooldown?: number;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

export interface DevicePermissions {
  notifications: boolean;
  settings: boolean;
}

export interface Device {
  deviceId: string;
  deviceName: string;
  serialNumber: string;
  isOnline: boolean;
  lastSeen: string;
  registeredAt: string;
  firmwareVersion: string;
  settings: DeviceSettings;
  permissions: DevicePermissions;
}

export interface UserDevicesResponse {
  devices: Device[];
  total: number;
}

export interface DeviceResetResponse {
  deviceId: string;
  message: string;
  resetInitiatedAt: string;
}

// ==== User Management Types ====

export interface UserInviteRequest {
  email: string;
  notificationsPermission?: boolean;
  settingsPermission?: boolean;
}

export interface UserInviteResponse {
  invitationId: string;
  email: string;
  deviceId: string;
  deviceName: string;
  notificationsPermission: boolean;
  settingsPermission: boolean;
  expiresAt: string;
  sentAt: string;
}

export interface Invitation {
  invitationId: string;
  deviceId: string;
  deviceName: string;
  invitedBy: string;
  notificationsPermission: boolean;
  settingsPermission: boolean;
  createdAt: string;
  expiresAt: string;
}

export interface UserInvitationsResponse {
  invitations: Invitation[];
  total: number;
}

export interface InvitationActionResponse {
  invitationId: string;
  action: 'accepted' | 'declined';
  message: string;
  processedAt: string;
  deviceId: string;
  deviceName: string;
}

// ==== Device Status Types ====

export interface DeviceStatusUpdate {
  deviceId: string;
  isOnline: boolean;
  lastSeen: string;
  signalStrength?: number;
  batteryLevel?: number;
  firmwareVersion?: string;
}

// ==== Button Press Types ====

export interface ButtonPressEvent {
  deviceId: string;
  buttonRfId: string;
  timestamp: string;
  batteryLevel?: number;
}

// ==== Validation Constants ====

export const VALIDATION_CONSTRAINTS = {
  DEVICE_NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 50,
    PATTERN: /^[a-zA-Z0-9\s\-_.]+$/,
  },
  DEVICE_ID: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 100,
    PATTERN: /^[a-zA-Z0-9\-_]+$/,
  },
  SERIAL_NUMBER: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 50,
    PATTERN: /^[A-Z0-9]+$/,
  },
  MAC_ADDRESS: {
    PATTERN: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/,
  },
  EMAIL: {
    MIN_LENGTH: 5,
    MAX_LENGTH: 254,
  },
  SOUND_VOLUME: {
    MIN: 1,
    MAX: 10,
  },
  LED_BRIGHTNESS: {
    MIN: 1,
    MAX: 10,
  },
  NOTIFICATION_COOLDOWN: {
    MIN: 0,
    MAX: 300,
  },
  TIME_FORMAT: {
    PATTERN: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
  },
} as const;

// ==== Error Codes ====

export const ERROR_CODES = {
  VALIDATION_FAILED: 'validation_failed',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  USER_NOT_FOUND: 'user_not_found',
  DEVICE_NOT_FOUND: 'device_not_found',
  INVITATION_NOT_FOUND: 'invitation_not_found',
  DEVICE_ALREADY_EXISTS: 'device_already_exists',
  INVITATION_ALREADY_PROCESSED: 'invitation_already_processed',
  RESOURCE_NOT_FOUND: 'resource_not_found',
  SERVICE_UNAVAILABLE: 'service_unavailable',
  INTERNAL_SERVER_ERROR: 'internal_server_error',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES]; 