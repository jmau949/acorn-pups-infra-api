# Acorn Pups API Infrastructure

This repository contains the AWS CDK infrastructure for the Acorn Pups API Gateway, Lambda functions, and related services. It provides a complete REST API for managing IoT pet devices, user access, and button press notifications.

## 🏗️ Architecture Overview

The infrastructure is organized into multiple CDK stacks:

- **Lambda Functions Stack**: All AWS Lambda functions with shared utilities
- **API Gateway Stack**: REST API with routing, CORS, authentication, and rate limiting
- **Monitoring Stack**: CloudWatch dashboards, alarms, and log insights
- **Pipeline Stack**: CI/CD pipeline using CodePipeline and CodeBuild

## 📋 Requirements Completion Status

Based on `reqApi.md`, here's the current implementation status:

### ✅ Completed Features

- **Multi-environment deployment** (dev, prod)
- **Environment-specific configuration** 
- **REST API Gateway** with CORS
- **All required API routes** implemented
- **Lambda proxy integration** for all endpoints
- **Environment variables** passed to functions
- **Standardized error/success responses**
- **Rate limiting and throttling**
- **CloudWatch logging and metrics**
- **OpenAPI specification** (`docs/api-spec.yaml`)
- **Health check endpoint**
- **CDK deployment** working
- **PowerShell deployment scripts**
- **Unit and integration tests**

### 🚧 TODO (Future Enhancements)

- **Cognito User Pool integration** (marked with TODO comments)
- **JWT token validation**
- **Custom domain support**
- **DynamoDB tables** (will be in separate device service)
- **IoT Core integration** (will be in separate device service)

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.x or later
- **AWS CLI** configured with appropriate credentials
- **AWS CDK** CLI installed globally: `npm install -g aws-cdk`
- **PowerShell** (for deployment scripts)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/acorn-pups-infra-api.git
   cd acorn-pups-infra-api
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Bootstrap CDK (first time only)**
   ```bash
   cdk bootstrap
   ```

### Development Deployment

Deploy to the development environment:

```powershell
# Using PowerShell script (recommended)
.\scripts\deploy.ps1 -Environment dev

# Or using CDK directly
npm run deploy:dev
```

### Production Deployment

Deploy to the production environment:

```powershell
# Using PowerShell script with confirmation
.\scripts\deploy.ps1 -Environment prod

# Skip confirmation (for CI/CD)
.\scripts\deploy.ps1 -Environment prod -SkipConfirmation
```

## 🧪 Testing

### Unit Tests

Run CDK stack unit tests:

```bash
npm test
```

### Integration Tests

Test deployed API endpoints:

```powershell
# Test development environment
.\scripts\test-endpoints.ps1 -Environment dev

# Test with verbose output
.\scripts\test-endpoints.ps1 -Environment dev -Verbose
```

### API Testing

Use the provided OpenAPI specification with tools like:

- **Postman**: Import `docs/api-spec.yaml`
- **Swagger UI**: Serve the spec file
- **curl**: Manual testing with curl commands

## 📁 Repository Structure

```
acorn-pups-infra-api/
├── lib/                          # CDK stack definitions
│   ├── api-gateway-stack.ts      # API Gateway with all routes
│   ├── lambda-functions-stack.ts # Lambda functions and layers
│   ├── monitoring-stack.ts       # CloudWatch monitoring
│   ├── pipeline-stack.ts         # CI/CD pipeline
│   └── types.ts                  # Shared TypeScript interfaces
├── lambda/                       # Lambda function source code
│   ├── shared/                   # Shared utilities layer
│   │   ├── response-handler.ts   # Standardized responses
│   │   └── package.json
│   ├── health/                   # Health check function
│   ├── register-device/          # Device registration
│   ├── get-user-devices/         # Get user's devices
│   ├── update-device-settings/   # Update device settings
│   └── [other-functions]/        # Additional endpoints
├── docs/                         # Documentation
│   └── api-spec.yaml            # OpenAPI 3.0 specification
├── scripts/                      # PowerShell automation scripts
│   ├── deploy.ps1               # Deployment script
│   └── test-endpoints.ps1       # API testing script
├── tests/                        # Test files
│   ├── unit/                    # CDK unit tests
│   ├── integration/             # API integration tests
│   └── setup.ts                 # Jest setup
├── bin/
│   └── app.ts                   # CDK app entry point
├── package.json                 # Node.js dependencies
├── cdk.json                     # CDK configuration
├── tsconfig.json               # TypeScript configuration
└── jest.config.js              # Jest test configuration
```

## 🛠️ API Endpoints

### System Endpoints
- `GET /health` - Health check (no auth required)

### Device Management
- `POST /devices/register` - Register new device
- `GET /users/{userId}/devices` - Get user's devices
- `PUT /devices/{deviceId}/settings` - Update device settings
- `DELETE /devices/{deviceId}` - Delete device
- `GET /devices/{deviceId}/status` - Get device status
- `GET /devices/{deviceId}/history` - Get button press history

### User Management
- `POST /devices/{deviceId}/invite` - Invite user to device
- `GET /devices/{deviceId}/users` - Get device users
- `DELETE /devices/{deviceId}/users/{userId}` - Remove user access
- `PUT /users/{userId}/preferences` - Update user preferences

See `docs/api-spec.yaml` for complete API documentation.

## ⚙️ Configuration

### Environment Variables

The CDK stacks use environment-specific configuration:

```typescript
const config = {
  dev: {
    apigatewayStageName: 'dev',
    domainPrefix: 'api-dev',
    logLevel: 'DEBUG',
    throttleRateLimit: 100,
    throttleBurstLimit: 200,
  },
  prod: {
    apigatewayStageName: 'prod', 
    domainPrefix: 'api',
    logLevel: 'INFO',
    throttleRateLimit: 1000,
    throttleBurstLimit: 2000,
  }
};
```

### Lambda Function Environment Variables

All Lambda functions receive:

- `ENVIRONMENT` - Deployment environment (dev/prod)
- `REGION` - AWS region
- `LOG_LEVEL` - Logging level

## 📊 Monitoring

### CloudWatch Dashboard

Access the environment-specific dashboard:
- Development: `acorn-pups-dev-api-dashboard`
- Production: `acorn-pups-prod-api-dashboard`

### Key Metrics

- **API Gateway**: Request count, error rate, latency
- **Lambda Functions**: Invocations, errors, duration
- **Custom Alarms**: High error rates, high latency

### Log Insights Queries

Pre-configured queries for troubleshooting:
- Error patterns across API Gateway and Lambda
- Performance analysis
- Request tracing

## 🔧 Development

### Adding New Endpoints

1. **Create Lambda function**:
   ```bash
   mkdir lambda/new-endpoint
   # Add index.ts and package.json
   ```

2. **Add to Lambda stack**:
   ```typescript
   // lib/lambda-functions-stack.ts
   newEndpoint: new lambda.Function(this, 'NewEndpointFunction', {
     // configuration
   }),
   ```

3. **Add to API Gateway stack**:
   ```typescript
   // lib/api-gateway-stack.ts
   const newResource = this.api.root.addResource('new');
   newResource.addMethod('GET', 
     new apigateway.LambdaIntegration(props.lambdaFunctions.newEndpoint)
   );
   ```

4. **Update types**:
   ```typescript
   // lib/types.ts
   export interface LambdaFunctions {
     // ... existing functions
     newEndpoint: lambda.Function;
   }
   ```

5. **Add tests**:
   ```typescript
   // tests/unit/lambda-functions-stack.test.ts
   // tests/integration/api-endpoints.test.ts
   ```

### Local Development

```bash
# Watch mode for TypeScript compilation
npm run watch

# Synthesize CloudFormation templates
npm run synth

# Show differences before deployment
npm run diff:dev
```

## 🚀 CI/CD Pipeline

### Automated Deployment

The repository includes a CodePipeline that:

1. **Triggers** on commits to `develop` (→ dev) or `master` (→ prod)
2. **Builds** the CDK application
3. **Tests** the code
4. **Deploys** to the appropriate environment

### Manual Pipeline Setup

1. **Create GitHub token** in AWS Secrets Manager:
   ```bash
   aws secretsmanager create-secret \
     --name github-token \
     --secret-string "your-github-token"
   ```

2. **Update pipeline configuration**:
   ```typescript
   // lib/pipeline-stack.ts
   // Update GitHub username and repository name
   ```

3. **Deploy pipeline**:
   ```bash
   cdk deploy acorn-pups-pipeline
   ```

## 🔒 Security

### Current Security Measures

- **IAM roles** with minimal permissions
- **API Gateway** rate limiting and throttling
- **Request validation** for all endpoints
- **CORS** configuration for mobile app access
- **CloudWatch logging** for audit trails

### Authentication (Coming Soon)

- **AWS Cognito** User Pool integration
- **JWT token** validation
- **Role-based access** control (owner vs viewer)

## 🐛 Troubleshooting

### Common Issues

1. **CDK Bootstrap Error**:
   ```bash
   cdk bootstrap aws://ACCOUNT-ID/REGION
   ```

2. **Permission Denied**:
   - Ensure AWS credentials have sufficient permissions
   - Check IAM roles and policies

3. **Lambda Layer Import Issues**:
   - Verify shared layer is deployed first
   - Check Lambda function configuration

4. **API Gateway 502 Errors**:
   - Check Lambda function logs in CloudWatch
   - Verify function response format