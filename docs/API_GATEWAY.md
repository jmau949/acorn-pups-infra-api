# Acorn Pups API - API Gateway Guide

## 📋 **Table of Contents**
- [API Overview](#api-overview)
- [API Endpoints](#api-endpoints)
- [Authentication](#authentication)
- [CORS Configuration](#cors-configuration)
- [Rate Limiting](#rate-limiting)
- [Error Handling](#error-handling)
- [Testing](#testing)
- [Integration](#integration)

---

## 🌐 **API Overview**

### **Base URLs:**
- **Development**: `https://{api-id}.execute-api.{region}.amazonaws.com/dev`
- **Production**: `https://{api-id}.execute-api.{region}.amazonaws.com/prod`

### **API Gateway Configuration:**
- **Type**: REST API
- **Authorization**: Cognito User Pool (planned)
- **CORS**: Enabled for mobile app origins
- **Rate Limiting**: Environment-specific throttling
- **Request Validation**: JSON Schema validation
- **Logging**: CloudWatch integration

---

## 📚 **API Endpoints**

### **Health & System**

#### **GET /health**
```http
GET /health
```
**Description**: Health check endpoint (no authentication required)

**Response 200**:
```json
{
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "environment": "dev",
    "version": "1.0.0"
  },
  "requestId": "abc-123-def-456"
}
```

### **Device Management**

#### **POST /devices/register**
```http
POST /devices/register
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body**:
```json
{
  "deviceName": "Living Room Button",
  "deviceType": "acorn-button",
  "location": "Living Room"
}
```

**Response 201**:
```json
{
  "data": {
    "deviceId": "device_abc123",
    "deviceName": "Living Room Button",
    "status": "registered",
    "createdAt": "2024-01-15T10:30:00.000Z"
  },
  "requestId": "abc-123-def-456"
}
```

#### **GET /users/{userId}/devices**
```http
GET /users/{userId}/devices
Authorization: Bearer {token}
```

**Response 200**:
```json
{
  "data": {
    "devices": [
      {
        "deviceId": "device_abc123",
        "deviceName": "Living Room Button",
        "status": "online",
        "lastSeen": "2024-01-15T10:25:00.000Z"
      }
    ],
    "total": 1
  },
  "requestId": "abc-123-def-456"
}
```

#### **PUT /devices/{deviceId}/settings**
```http
PUT /devices/{deviceId}/settings
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body**:
```json
{
  "name": "Updated Button Name",
  "location": "Kitchen",
  "notificationSettings": {
    "enabled": true,
    "frequency": "immediate"
  }
}
```

#### **DELETE /devices/{deviceId}**
```http
DELETE /devices/{deviceId}
Authorization: Bearer {token}
```

**Response 204**: No content

### **Device Status & History**

#### **GET /devices/{deviceId}/status**
```http
GET /devices/{deviceId}/status
Authorization: Bearer {token}
```

**Response 200**:
```json
{
  "data": {
    "deviceId": "device_abc123",
    "status": "online",
    "batteryLevel": 85,
    "lastSeen": "2024-01-15T10:25:00.000Z",
    "connectivity": "wifi"
  },
  "requestId": "abc-123-def-456"
}
```

#### **GET /devices/{deviceId}/history**
```http
GET /devices/{deviceId}/history?limit=50&offset=0
Authorization: Bearer {token}
```

**Response 200**:
```json
{
  "data": {
    "events": [
      {
        "eventId": "event_123",
        "timestamp": "2024-01-15T10:20:00.000Z",
        "type": "button_press",
        "duration": 250
      }
    ],
    "pagination": {
      "limit": 50,
      "offset": 0,
      "total": 1
    }
  },
  "requestId": "abc-123-def-456"
}
```

### **User Management**

#### **POST /devices/{deviceId}/invite**
```http
POST /devices/{deviceId}/invite
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body**:
```json
{
  "email": "user@example.com",
  "permissions": ["view", "control"]
}
```

#### **GET /devices/{deviceId}/users**
```http
GET /devices/{deviceId}/users
Authorization: Bearer {token}
```

#### **DELETE /devices/{deviceId}/users/{userId}**
```http
DELETE /devices/{deviceId}/users/{userId}
Authorization: Bearer {token}
```

#### **PUT /users/{userId}/preferences**
```http
PUT /users/{userId}/preferences
Authorization: Bearer {token}
Content-Type: application/json
```

---

## 🔐 **Authentication**

### **Current State**
```
⚠️ Authentication is prepared but not yet implemented
🔧 TODO: Integrate with Cognito User Pool
```

### **Planned Implementation**
- **Type**: Cognito User Pool with JWT tokens
- **Header**: `Authorization: Bearer {jwt-token}`
- **Scope**: All endpoints except `/health`

### **Authentication Flow** (When Implemented)
1. **User Login**: Client authenticates with Cognito
2. **Token Receipt**: Client receives JWT access token
3. **API Requests**: Include token in Authorization header
4. **Token Validation**: API Gateway validates token with Cognito

### **Current Development**
All protected endpoints currently return mock responses for development purposes.

---

## 🌍 **CORS Configuration**

### **Enabled Origins**
- `*` (Development - will be restricted in production)
- Mobile app origins (when configured)

### **Allowed Methods**
- `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`

### **Allowed Headers**
- `Content-Type`
- `Authorization` 
- `X-Requested-With`
- `X-Request-ID`

### **Exposed Headers**
- `X-Request-ID`
- `Access-Control-Allow-Origin`

### **Preflight Handling**
- OPTIONS requests handled automatically
- Preflight cache: 86400 seconds (24 hours)

---

## 🚦 **Rate Limiting**

### **Environment-Specific Limits**

#### **Development Environment**
- **Rate Limit**: 100 requests/second
- **Burst Limit**: 200 requests
- **Daily Quota**: 10,000 requests

#### **Production Environment**  
- **Rate Limit**: 1,000 requests/second
- **Burst Limit**: 2,000 requests
- **Daily Quota**: 100,000 requests

### **Rate Limit Headers**
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642234800
```

### **Rate Limit Exceeded Response**
```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
  "error": "TooManyRequests",
  "message": "Rate limit exceeded",
  "requestId": "abc-123-def-456",
  "retryAfter": 60
}
```

---

## ❌ **Error Handling**

### **Standardized Error Format**
```json
{
  "error": "ErrorCode",
  "message": "Human-readable error message",
  "requestId": "abc-123-def-456",
  "details": {
    "field": "fieldName",
    "code": "validation_error"
  }
}
```

### **HTTP Status Codes**
- **200**: Success
- **201**: Created
- **204**: No Content
- **400**: Bad Request
- **401**: Unauthorized
- **403**: Forbidden
- **404**: Not Found
- **409**: Conflict
- **429**: Too Many Requests
- **500**: Internal Server Error

### **Common Error Responses**

#### **401 Unauthorized**
```json
{
  "error": "Unauthorized",
  "message": "Authentication required",
  "requestId": "abc-123-def-456"
}
```

#### **404 Not Found**
```json
{
  "error": "NotFound",
  "message": "Device not found",
  "requestId": "abc-123-def-456"
}
```

#### **400 Bad Request**
```json
{
  "error": "ValidationError",
  "message": "Invalid request data",
  "requestId": "abc-123-def-456",
  "details": {
    "field": "deviceName",
    "code": "required"
  }
}
```

---

## 🧪 **Testing**

### **Health Check Test**
```powershell
# Test health endpoint
curl -X GET https://your-api-url.execute-api.region.amazonaws.com/dev/health

# Expected response
HTTP/1.1 200 OK
{
  "data": {
    "status": "healthy",
    "timestamp": "...",
    "environment": "dev"
  }
}
```

### **Using PowerShell Script**
```powershell
# Run comprehensive endpoint tests
.\scripts\test-endpoints.ps1 -Environment dev -BaseUrl "https://your-api-url"
```

### **Manual Testing Examples**

#### **Test Device Registration**
```powershell
$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer mock-token-for-dev"
}

$body = @{
    deviceName = "Test Button"
    deviceType = "acorn-button"
    location = "Test Location"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://your-api/dev/devices/register" -Method POST -Headers $headers -Body $body
```

#### **Test CORS**
```javascript
// Browser console test
fetch('https://your-api-url/dev/health', {
  method: 'GET',
  headers: {
    'Origin': 'https://your-app-domain.com'
  }
}).then(response => {
  console.log('CORS headers:', response.headers);
});
```

### **Postman Collection**
Located in `/docs/postman/` directory:
- `acorn-pups-api.postman_collection.json`
- `acorn-pups-environments.postman_environment.json`

---

## 🔗 **Integration**

### **Request ID Tracking**
Every request includes a unique `requestId` for tracing:
```
X-Request-ID: abc-123-def-456
```

### **Mobile App Integration**
```javascript
// React Native example
const apiClient = {
  baseURL: 'https://your-api-url.execute-api.region.amazonaws.com/prod',
  
  async makeRequest(endpoint, options = {}) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getAuthToken()}`,
        ...options.headers
      },
      ...options
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'API request failed');
    }
    
    return data;
  }
};

// Usage
const devices = await apiClient.makeRequest('/users/user123/devices');
```

### **Backend Service Integration**
```typescript
// Other microservices can integrate via:
const acornPupsApi = new AcornPupsApiClient({
  baseUrl: process.env.ACORN_PUPS_API_URL,
  apiKey: process.env.ACORN_PUPS_API_KEY
});

const deviceStatus = await acornPupsApi.getDeviceStatus('device123');
```

### **Webhook Integration** (Planned)
Future webhook support for real-time notifications:
```json
{
  "eventType": "device.button_pressed",
  "deviceId": "device_abc123",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": {
    "duration": 250,
    "location": "Living Room"
  }
}
```

---

## 📝 **OpenAPI Specification**

### **Swagger Documentation**
Full API specification available at:
- **File**: `/docs/api-spec.yaml`
- **Format**: OpenAPI 3.0
- **Online Viewer**: Import into Swagger Editor

### **Generating Client SDKs**
```powershell
# Generate TypeScript client
npx @openapitools/openapi-generator-cli generate \
  -i docs/api-spec.yaml \
  -g typescript-fetch \
  -o generated/typescript-client

# Generate Python client
npx @openapitools/openapi-generator-cli generate \
  -i docs/api-spec.yaml \
  -g python \
  -o generated/python-client
```

---

## 🎯 **Quick Reference**

### **Common Commands**
```powershell
# Get API Gateway URL after deployment
aws cloudformation describe-stacks \
  --stack-name AcornPups-dev-ApiGateway \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text

# Test health endpoint
curl $(aws cloudformation describe-stacks --stack-name AcornPups-dev-ApiGateway --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text)/health

# Monitor API Gateway logs
aws logs tail /aws/apigateway/acorn-pups-dev --follow
```

### **Environment Variables**
Set these in your client applications:
```
ACORN_PUPS_API_URL=https://your-api-url.execute-api.region.amazonaws.com
ACORN_PUPS_API_STAGE=dev|prod
```

For deployment information, see [DEPLOYMENT.md](./DEPLOYMENT.md)
For monitoring details, see [MONITORING.md](./MONITORING.md) 