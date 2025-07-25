# Acorn Pups API - Documentation Hub

Welcome to the comprehensive documentation for the Acorn Pups Infrastructure API project! This documentation will help you understand, deploy, monitor, and work with the Acorn Pups API infrastructure.

## 📚 **Documentation Structure**

### **🚀 [DEPLOYMENT.md](./DEPLOYMENT.md)**
**Complete deployment guide covering:**
- Prerequisites and initial setup
- Manual deployment instructions
- Automated CI/CD pipeline setup with GitHub
- Environment configuration (dev/prod)
- Troubleshooting common deployment issues
- Branch-based deployment strategy

**👥 Who should read this:** DevOps engineers, developers setting up the infrastructure, anyone deploying to AWS

### **📊 [MONITORING.md](./MONITORING.md)**
**Comprehensive monitoring and observability guide:**
- CloudWatch dashboards and alarms
- Logging strategy and log analysis
- Performance metrics and KPIs
- Troubleshooting common issues
- Cost monitoring and optimization
- Alert configuration and incident response

**👥 Who should read this:** Site reliability engineers, DevOps teams, developers debugging issues

### **🌐 [API_GATEWAY.md](./API_GATEWAY.md)**
**API Gateway reference and integration guide:**
- Complete API endpoint documentation
- Authentication and authorization (planned)
- CORS configuration
- Rate limiting and error handling
- Testing procedures and examples
- Client integration patterns

**👥 Who should read this:** Frontend developers, mobile app developers, API consumers, QA engineers

### **📋 [api-spec.yaml](./api-spec.yaml)**
**OpenAPI 3.0 specification:**
- Machine-readable API specification
- Complete endpoint definitions
- Request/response schemas
- Can be imported into Postman, Swagger UI, or used for client generation

**👥 Who should use this:** API consumers, automated tooling, documentation generators

### **🔧 [IAM-PERMISSIONS.md](./IAM-PERMISSIONS.md)**
**IoT and permissions reference:**
- IoT device management permissions
- Certificate lifecycle management
- IoT policy configuration and enforcement
- Lambda function role mappings

**👥 Who should read this:** DevOps engineers, security engineers, developers working with IoT device management

---

## 🎯 **Quick Start Paths**

### **For New Developers**
1. **Start here**: [Project README](../README.md) - Project overview and architecture
2. **Setup**: [DEPLOYMENT.md](./DEPLOYMENT.md#initial-setup) - Get your development environment ready
3. **Deploy**: [DEPLOYMENT.md](./DEPLOYMENT.md#manual-deployment) - Deploy to development environment
4. **Test**: [API_GATEWAY.md](./API_GATEWAY.md#testing) - Verify your deployment works
5. **Monitor**: [MONITORING.md](./MONITORING.md#cloudwatch-dashboards) - Check your deployment health

### **For DevOps Engineers**
1. **Infrastructure**: [DEPLOYMENT.md](./DEPLOYMENT.md) - Complete deployment procedures
2. **CI/CD Setup**: [DEPLOYMENT.md](./DEPLOYMENT.md#automated-deployment-setup) - GitHub Actions pipeline
3. **Monitoring**: [MONITORING.md](./MONITORING.md) - Observability and alerting
4. **IoT Security**: [IAM-PERMISSIONS.md](./IAM-PERMISSIONS.md) - IoT policies and device security
5. **Troubleshooting**: [MONITORING.md](./MONITORING.md#troubleshooting) - Common issues and solutions

### **For Frontend/Mobile Developers**
1. **API Reference**: [API_GATEWAY.md](./API_GATEWAY.md#api-endpoints) - Available endpoints
2. **Integration**: [API_GATEWAY.md](./API_GATEWAY.md#integration) - Client integration examples
3. **OpenAPI Spec**: [api-spec.yaml](./api-spec.yaml) - Machine-readable API definition
4. **Testing**: [API_GATEWAY.md](./API_GATEWAY.md#testing) - How to test API endpoints

### **For QA Engineers**
1. **API Testing**: [API_GATEWAY.md](./API_GATEWAY.md#testing) - Manual and automated testing
2. **Error Handling**: [API_GATEWAY.md](./API_GATEWAY.md#error-handling) - Expected error responses
3. **Monitoring**: [MONITORING.md](./MONITORING.md#troubleshooting) - Debugging test failures
4. **Environments**: [DEPLOYMENT.md](./DEPLOYMENT.md#environment-configuration) - Dev vs prod differences

### **For IoT Developers**
1. **Device Management**: [API_GATEWAY.md](./API_GATEWAY.md#device-management) - Device registration and lifecycle
2. **Certificate Management**: [IAM-PERMISSIONS.md](./IAM-PERMISSIONS.md#certificate-management) - Device certificate workflow
3. **IoT Policies**: [IAM-PERMISSIONS.md](./IAM-PERMISSIONS.md#iot-policies) - Device security and permissions
4. **MQTT Topics**: [IAM-PERMISSIONS.md](./IAM-PERMISSIONS.md#mqtt-topics) - Device communication patterns

---

## 🏗️ **Architecture Overview**

```
Acorn Pups Infrastructure API
├── 🌐 API Gateway (REST API)
│   ├── CORS Configuration
│   ├── Rate Limiting
│   ├── Request Validation
│   └── Authentication (Cognito - planned)
│
├── ⚡ Lambda Functions (Node.js v22)
│   ├── Device Management
│   ├── User Management
│   ├── IoT Certificate Lifecycle
│   ├── Health Check
│   └── Shared Response Handler Layer
│
├── 🔐 IoT Security & Device Management
│   ├── Device Policies (ESP32 Receivers)
│   ├── Certificate Generation & Cleanup
│   ├── IoT Rule Execution Role
│   └── MQTT Topic Security
│
├── 📊 CloudWatch Monitoring
│   ├── Dashboards & Metrics
│   ├── Alarms & Notifications
│   └── Log Aggregation
│
└── 🚀 CI/CD Pipeline (CodePipeline)
    ├── GitHub Integration
    ├── Automated Testing
    └── Branch-based Deployment
```

### **IoT Infrastructure Integration**

This API repository manages the complete device lifecycle:

- **Device Registration**: Creates AWS IoT certificates, Things, and attaches policies
- **Device Security**: Manages IoT policies that enforce device-scoped permissions
- **Certificate Cleanup**: Handles device reset and certificate revocation
- **IoT Rules Integration**: Provides execution role for IoT rules (managed in IoT repository)

**Related Repositories:**
- `acorn-pups-infra-iot`: IoT rules, thing types, and monitoring
- `acorn-pups-infra-db`: Device and user data storage
- `acorn-pups-infra-cognito`: User authentication

---

## 🎨 **Resource Tagging Strategy**

All AWS resources are tagged with:
- **Project**: "Acorn Pups"
- **Environment**: "dev" | "prod"
- **Component**: "Lambda Functions" | "API Gateway" | "IoT Policies" | "Monitoring" | "CI/CD Pipeline"

This enables:
- Cost tracking by project and environment
- Resource organization and filtering
- Automated compliance and governance

---

## 🔧 **Technology Stack**

### **Infrastructure as Code**
- **AWS CDK** (TypeScript) - Infrastructure definition
- **CloudFormation** - Deployment orchestration

### **Runtime**
- **Node.js v22** - Modern JavaScript runtime
- **TypeScript 5.0** - Type-safe development
- **esbuild** - Fast bundling and minification

### **AWS Services**
- **API Gateway** - REST API hosting
- **Lambda** - Serverless compute
- **IoT Core** - Device connectivity and security
- **CloudWatch** - Monitoring and logging
- **CodePipeline** - CI/CD automation
- **CodeBuild** - Build and test automation
- **S3** - Artifact storage
- **SNS** - Alarm notifications

### **Development Tools**
- **Jest** - Testing framework
- **PowerShell** - Deployment scripts
- **GitHub Actions** - Source control integration

---

## 🎯 **Development Workflow**

### **Feature Development**
```bash
# 1. Create feature branch
git checkout -b feature/new-endpoint

# 2. Develop and test locally
npm run build
npm run test

# 3. Deploy to development
npm run deploy:dev

# 4. Test deployment
./scripts/test-endpoints.ps1 -Environment dev

# 5. Create PR to develop branch
# 6. Merge → Automatic deployment to dev environment
```

### **Production Release**
```bash
# 1. Create release PR: develop → master
# 2. Review and approve
# 3. Merge → Automatic deployment to production
# 4. Monitor deployment in CloudWatch
```

### **IoT Infrastructure Deployment Order**

When deploying the complete Acorn Pups system:

1. **Database** (`acorn-pups-infra-db`) - Core data tables
2. **Cognito** (`acorn-pups-infra-cognito`) - User authentication
3. **API** (`acorn-pups-infra-api`) - Lambda functions and **IoT policies** (this repository)
4. **IoT** (`acorn-pups-infra-iot`) - IoT rules and monitoring

This order ensures proper dependency resolution and allows for clean deployment/destruction cycles.

---

## 📞 **Support & Resources**

### **Internal Documentation**
- [Project README](../README.md) - Main project overview
- [Infrastructure Improvements](../INFRASTRUCTURE_IMPROVEMENTS.md) - Recent improvements log

### **AWS Documentation**
- [AWS CDK Developer Guide](https://docs.aws.amazon.com/cdk/)
- [API Gateway Developer Guide](https://docs.aws.amazon.com/apigateway/)
- [Lambda Developer Guide](https://docs.aws.amazon.com/lambda/)
- [IoT Core Developer Guide](https://docs.aws.amazon.com/iot/)
- [CloudWatch User Guide](https://docs.aws.amazon.com/cloudwatch/)

### **Community Resources**
- [AWS CDK Examples](https://github.com/aws-samples/aws-cdk-examples)
- [Serverless Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [IoT Core Best Practices](https://docs.aws.amazon.com/iot/latest/developerguide/iot-best-practices.html)

---

## 🔄 **Documentation Updates**

This documentation is maintained alongside the codebase. When making infrastructure changes:

1. **Update relevant documentation** in this folder
2. **Test all examples** in your documentation updates
3. **Include documentation updates** in your pull requests
4. **Review for accuracy** during code review process

### **Documentation Standards**
- Use clear, actionable instructions
- Include code examples for complex procedures
- Provide both PowerShell and equivalent bash commands where applicable
- Link between related documentation sections
- Keep quick reference sections updated

---

## 💡 **Contributing**

Found an issue with the documentation or have suggestions for improvement?

1. **Create an issue** describing the problem or enhancement
2. **Submit a pull request** with your improvements
3. **Test your changes** by following your own documentation
4. **Update related sections** that might be affected by your changes

Remember: Good documentation is code! Treat it with the same care and attention as your infrastructure code.

---

**Happy coding! 🚀**

For questions about the Acorn Pups Infrastructure API, please refer to the appropriate documentation section above or reach out to the development team. 