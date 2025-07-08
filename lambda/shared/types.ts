// ==== Base Response Types ====

export interface ValidationError {
  field: string;
  message: string;
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