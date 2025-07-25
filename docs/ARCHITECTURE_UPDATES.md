# Architecture Updates - Echo/Nest Reset Security Implementation

## Overview

This document summarizes the major architectural changes implemented to enhance security and user experience in the Acorn Pups system. The updates follow industry-standard patterns from Amazon Echo and Google Nest devices.

## Key Changes

### 1. Echo/Nest Reset Security Pattern

**Problem Solved**: Prevent remote device takeover attacks where malicious users could register devices they don't physically own.

**Implementation**:
- Added `device_instance_id` field (UUID) to Devices table
- New UUID generated each factory reset cycle
- Registration requires proof of physical reset for ownership transfer
- Automatic cleanup of old certificates and user associations

**Benefits**:
- Physical access required for ownership transfer
- Prevents remote takeover attempts
- Industry-standard security model
- Automatic cleanup reduces manual intervention

### 2. Cognito Post-Confirmation User Creation

**Problem Solved**: Simplify user registration and ensure email verification before device registration.

**Implementation**:
- New `cognito-post-confirmation` Lambda function
- Automatic user profile creation after email verification
- Separated user creation from device registration concerns
- Default user preferences and timezone settings

**Benefits**:
- Simplified user experience
- Guaranteed email verification
- Reduced device registration complexity
- Reliable user profile existence

### 3. Removed MQTT Reset Complexity

**Problem Solved**: Simplify reset architecture and eliminate potential race conditions.

**Implementation**:
- Removed `factory-reset` and `reset-device` Lambda functions
- Eliminated MQTT reset topics
- All reset handling via HTTP registration API
- Single cleanup path through device registration

**Benefits**:
- Simplified architecture
- Reduced potential failure points
- Consistent reset behavior
- Easier troubleshooting

## Updated Lambda Functions

### New Functions
- `cognito-post-confirmation`: Automatic user creation after email verification (lives in cognito repo)

### Updated Functions
- `register-device`: Enhanced with Echo/Nest reset security pattern
- `get-user-devices`: Returns new `device_instance_id` and `last_reset_at` fields
- `update-device-settings`: Added proper authorization and validation
- `handle-button-press`: Implemented real-time notification processing

### Removed Functions
- `factory-reset`: Replaced by enhanced registration flow
- `reset-device`: Functionality moved to registration API

## Database Schema Changes

### New Fields
- `Devices.device_instance_id`: UUID for reset security validation
- `Devices.last_reset_at`: Timestamp of last factory reset
- Enhanced validation and error handling types

### Updated Access Patterns
- Reset security validation in device registration
- User lookup by cognito_sub for device registration
- Ownership transfer logic with automatic cleanup

## Security Enhancements

### Device Registration Security
- Instance ID validation prevents unauthorized registration
- Physical reset proof required for ownership transfer
- Automatic certificate revocation on ownership transfer
- User association cleanup on device reset

### User Authentication
- Cognito integration with JWT token validation
- Email verification required before user profile creation
- Proper authorization checks for all device operations

## API Changes

### Request/Response Updates
- `POST /devices/register`: New required fields (`deviceInstanceId`, `deviceState`)
- Device responses include `deviceInstanceId` and `lastResetAt`
- Enhanced error responses with reset instructions
- Improved validation error messages

### New Error Codes
- `409 Conflict`: Device registration without valid reset proof
- Enhanced error messages with user-friendly instructions
- Reset instruction guidance for device conflicts

## Migration Impact

### Existing Devices
- Existing devices continue to work without changes
- Next factory reset will generate new instance ID
- Gradual migration to enhanced security model

### Development Workflow
- Updated event examples in `docs/events/`
- Removed references to obsolete functions
- Updated IAM permission documentation

## Monitoring and Observability

### Enhanced Logging
- Reset security validation events
- Ownership transfer logging
- User creation success/failure tracking
- Device registration conflict detection

### Metrics to Monitor
- Device registration success/failure rates
- Reset security validation events
- User creation completion rates
- Certificate cleanup success rates

## Testing Considerations

### New Test Scenarios
- Device registration with reset security
- Ownership transfer validation
- User creation via Cognito triggers
- Reset security conflict handling

### Updated Test Cases
- Device registration event payloads
- API response schemas
- Error handling scenarios

## Best Practices

### Device Reset Flow
1. Physical reset button press generates new instance ID
2. Device enters BLE setup mode
3. Mobile app connects and configures WiFi
4. Device calls registration API with reset proof
5. Backend validates reset and transfers ownership
6. Old certificates revoked, new certificates issued

### User Registration Flow
1. User signs up through mobile app
2. Cognito handles email verification
3. Post-confirmation trigger creates user profile
4. User can immediately register devices
5. Device registration focuses only on device concerns

## Future Considerations

### Potential Enhancements
- Certificate rotation scheduling
- Advanced device analytics
- Multi-factor reset validation
- Enhanced user permission models

### Architecture Evolution
- Service mesh integration potential
- Event-driven architecture expansion
- Real-time device status streaming
- Advanced monitoring and alerting

---

This implementation brings the Acorn Pups system in line with industry security standards while simplifying the user experience and improving system reliability. 