// ==== Database Schema Types (shared across multiple lambdas) ====

// Users Table Types
export interface User {
  PK: string; // USER#{user_id}
  SK: string; // PROFILE
  user_id: string;
  email: string;
  cognito_sub: string;
  full_name: string;
  phone?: string;
  timezone: string;
  created_at: string;
  updated_at: string;
  last_login?: string;
  is_active: boolean;
  push_notifications: boolean;
  preferred_language: string;
  sound_alerts: boolean;
  vibration_alerts: boolean;
}

// Devices Table Types
export interface DeviceMetadata {
  PK: string; // DEVICE#{device_id}
  SK: string; // METADATA
  device_id: string;
  device_instance_id: string; // UUID generated each factory reset cycle
  serial_number: string;
  mac_address: string;
  device_name: string;
  owner_user_id: string;
  firmware_version: string;
  hardware_version: string;
  is_online: boolean;
  last_seen: string;
  wifi_ssid?: string;
  signal_strength: number;
  created_at: string;
  updated_at: string;
  last_reset_at?: string; // Last factory reset timestamp
  is_active: boolean;
  iot_thing_name?: string;
  iot_certificate_arn?: string;
}

export interface DeviceSettings {
  PK: string; // DEVICE#{device_id}
  SK: string; // SETTINGS
  device_id: string;
  sound_enabled: boolean;
  sound_volume: number; // 1-10 scale
  led_brightness: number; // 1-10 scale
  notification_cooldown: number; // seconds
  quiet_hours_enabled: boolean;
  quiet_hours_start: string; // HH:MM format
  quiet_hours_end: string; // HH:MM format
  updated_at: string;
}

// DeviceUsers Table Types (Junction Table)
export interface DeviceUser {
  PK: string; // DEVICE#{device_id}
  SK: string; // USER#{user_id}
  device_id: string;
  user_id: string;
  notifications_permission: boolean;
  settings_permission: boolean;
  notifications_enabled: boolean;
  notification_sound: 'default' | 'silent' | 'custom';
  notification_vibration: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string; // HH:MM format
  quiet_hours_end: string; // HH:MM format
  custom_notification_sound?: string;
  device_nickname?: string;
  invited_by: string;
  invited_at: string;
  accepted_at: string;
  is_active: boolean;
}

// Invitations Table Types
export interface Invitation {
  PK: string; // INVITATION#{invitation_id}
  SK: string; // METADATA
  invitation_id: string;
  device_id: string;
  invited_email: string;
  invited_by: string;
  invitation_token: string;
  expires_at: string;
  created_at: string;
  accepted_at?: string;
  is_accepted: boolean;
  is_expired: boolean;
}

// DeviceStatus Table Types (separate table, not sort key in Devices table)
export interface DeviceStatus {
  PK: string; // DEVICE#{device_id}
  SK: string; // STATUS#{status_type}
  device_id: string;
  status_type: 'CURRENT' | 'HEALTH' | 'CONNECTIVITY';
  timestamp: string;
  signal_strength: number;
  is_online: boolean;
  memory_usage?: number;
  cpu_temperature?: number;
  uptime?: number;
  error_count?: number;
  last_error_message?: string;
  firmware_version?: string;
}

// ==== MQTT Event Types (shared across IoT handlers) ====

// Button Press Event (MQTT)
export interface ButtonPressEvent {
  deviceId: string;
  buttonRfId: string;
  timestamp: string;
  batteryLevel?: number;
}

// ==== Base Response Types (used by response handler) ====

export interface ValidationError {
  field: string;
  message: string;
}

export interface ApiErrorResponse {
  error: string;
  message: string;
  requestId: string;
  validationErrors?: ValidationError[];
}

export interface ApiSuccessResponse<T = any> {
  data?: T;
  requestId: string;
}

// ==== Shared Response Types (used by multiple lambdas) ====

export interface InvitationActionResponse {
  invitationId: string;
  action: 'accepted' | 'declined';
  message: string;
  processedAt: string;
  deviceId: string;
  deviceName: string;
} 