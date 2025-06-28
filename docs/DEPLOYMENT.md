# Acorn Pups API - Deployment Guide

## 📋 **Table of Contents**
- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Manual Deployment](#manual-deployment)
- [Automated Deployment Setup](#automated-deployment-setup)
- [Environment Configuration](#environment-configuration)
- [Troubleshooting](#troubleshooting)
- [Deployment Checklist](#deployment-checklist)

---

## 🔧 **Prerequisites**

### **Required Tools:**
- **Node.js v22+** (enforced by project)
- **AWS CLI v2** (latest version)
- **AWS CDK CLI** (will be installed globally)
- **Git** (for repository management)
- **PowerShell** (Windows) or Bash (Linux/Mac)

### **AWS Requirements:**
- **AWS Account** with appropriate permissions
- **AWS CLI configured** with credentials
- **GitHub Personal Access Token** (for automated deployments)

### **Permissions Required:**
- IAM (create roles, policies)
- Lambda (create functions, layers)
- API Gateway (create APIs, stages)
- CloudWatch (create dashboards, alarms)
- S3 (create buckets)
- CodePipeline & CodeBuild (for CI/CD)

---

## 🚀 **Initial Setup**

### **1. Clone and Install Dependencies**
```powershell
# Clone the repository
git clone https://github.com/your-username/acorn-pups-infrastructure-api.git
cd acorn-pups-infrastructure-api

# Verify Node.js version (must be v22+)
node --version

# Install dependencies
npm install

# Install AWS CDK globally
npm install -g aws-cdk

# Verify installation
cdk --version
```

### **2. Configure AWS CLI**
```powershell
# Configure AWS credentials
aws configure

# Verify configuration
aws sts get-caller-identity
```

### **3. Bootstrap CDK (One-time setup per AWS account/region)**
```powershell
# Bootstrap for your target region
cdk bootstrap aws://YOUR-ACCOUNT-ID/us-west-2

# Example:
# cdk bootstrap aws://123456789012/us-east-1
```

### **4. Build and Validate**
```powershell
# Build TypeScript
npm run build

# Synthesize CloudFormation templates
npm run synth

# Run tests (optional)
npm test
```

---

## 🛠️ **Manual Deployment**

### **Development Environment**
```powershell
# Deploy all stacks to development
npm run deploy:dev

# Deploy specific stack
cdk deploy acorn-pups-dev-lambda --context environment=dev
cdk deploy acorn-pups-dev-apigateway --context environment=dev
cdk deploy acorn-pups-dev-monitoring --context environment=dev
```

### **Production Environment**
```powershell
# Deploy all stacks to production
npm run deploy:prod

# Deploy with approval (recommended for production)
cdk deploy --all --context environment=prod --require-approval broadening
```

### **Deployment Output**
After successful deployment, you'll see outputs like:
```
Outputs:
acorn-pups-dev-apigateway.ApiUrl = https://abc123def.execute-api.us-east-1.amazonaws.com/dev/
acorn-pups-dev-monitoring.DashboardUrl = https://console.aws.amazon.com/cloudwatch/...
```

### **Destroy/Cleanup**
```powershell
# Destroy development environment
npm run destroy:dev

# Destroy production environment
npm run destroy:prod
```

---

## 🤖 **Automated Deployment Setup**

### **1. GitHub Repository Setup**

#### **Create GitHub Secrets:**
Go to your GitHub repository → Settings → Secrets and variables → Actions

Create the following secrets:
```
AWS_ACCESS_KEY_ID: Your AWS access key
AWS_SECRET_ACCESS_KEY: Your AWS secret key
AWS_REGION: us-east-1 (or your preferred region)
```

#### **Update Repository References:**
In `lib/pipeline-stack.ts`, update:
```typescript
// Line 32 & 156: Replace with your GitHub username
owner: 'your-github-username',

// Line 33 & 157: Replace with your repository name  
repo: 'acorn-pups-infrastructure-api',
```

### **2. GitHub Token Setup**

#### **Create Personal Access Token:**
1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with scopes:
   - `repo` (Full control of private repositories)
   - `admin:repo_hook` (Read and write repository hooks)

#### **Store Token in AWS Secrets Manager:**
```powershell
# Create secret in AWS Secrets Manager
aws secretsmanager create-secret \
    --name github-token \
    --description "GitHub Personal Access Token for CodePipeline" \
    --secret-string "your-github-token-here"
```

### **3. Deploy CI/CD Pipeline**

#### **Deploy Pipeline Stack:**
```powershell
# Deploy pipeline for develop branch (dev environment)
cdk deploy acorn-pups-pipeline-dev --context branch=develop

# Deploy pipeline for master branch (prod environment)  
cdk deploy acorn-pups-pipeline-prod --context branch=master
```

### **4. Branch-Based Deployment Strategy**

#### **Development Workflow:**
```powershell
# Create feature branch
git checkout -b feature/new-endpoint

# Make changes, commit, and push
git add .
git commit -m "Add new endpoint"
git push origin feature/new-endpoint

# Create PR to develop branch
# Merge to develop → Triggers automatic deployment to DEV environment
```

#### **Production Workflow:**
```powershell
# Create release PR from develop to master
git checkout master
git pull origin master
git checkout develop
git pull origin develop

# Create PR: develop → master
# Merge to master → Triggers automatic deployment to PROD environment
```

### **5. Pipeline Verification**

#### **Check Pipeline Status:**
- AWS Console → CodePipeline → `acorn-pups-api-pipeline`
- Monitor build logs in CodeBuild
- Verify deployments in CloudFormation

#### **Pipeline Stages:**
1. **Source**: Triggered by GitHub webhook
2. **Build**: 
   - Install dependencies
   - Run tests
   - Build TypeScript
   - Deploy CDK stacks

---

## ⚙️ **Environment Configuration**

### **Development Environment (dev)**
- **Rate Limiting**: 100 requests/second
- **Log Level**: DEBUG
- **Alarm Thresholds**: Relaxed (10% error rate)
- **Domain Prefix**: `api-dev`

### **Production Environment (prod)**
- **Rate Limiting**: 1000 requests/second  
- **Log Level**: INFO
- **Alarm Thresholds**: Strict (5% error rate)
- **Domain Prefix**: `api`

### **Environment Variables**
Set in Lambda functions automatically:
```typescript
ENVIRONMENT: 'dev' | 'prod'
REGION: AWS deployment region
LOG_LEVEL: 'DEBUG' | 'INFO'
```

### **Resource Naming Convention**
```
Format: acorn-pups-{environment}-{resource-type}
Examples:
- acorn-pups-dev-health-check (Lambda)
- acorn-pups-prod-api (API Gateway)
- acorn-pups-dev-lambda-role (IAM Role)
```

---

## 🔍 **Troubleshooting**

### **Common Issues:**

#### **1. CDK Bootstrap Required**
```
Error: Need to bootstrap in region us-east-1
Solution: Run cdk bootstrap aws://ACCOUNT-ID/REGION
```

#### **2. Insufficient Permissions**
```
Error: User is not authorized to perform: iam:CreateRole
Solution: Ensure your AWS user has AdministratorAccess or required permissions
```

#### **3. GitHub Token Issues**
```
Error: Could not find GitHub token in Secrets Manager
Solution: 
1. Verify secret exists: aws secretsmanager describe-secret --secret-id github-token
2. Ensure token has correct permissions
3. Update pipeline stack if needed
```

#### **4. Node Version Mismatch**
```
Error: Unsupported engine
Solution: 
1. Install Node.js v22+
2. Use nvm: nvm use (if .nvmrc exists)
3. Verify: node --version
```

#### **5. Lambda Build Failures**
```
Error: Cannot resolve module
Solution:
1. Check individual Lambda package.json files
2. Verify import paths in Lambda functions
3. Run npm install in lambda directories if needed
```

### **Debug Commands:**
```powershell
# View CDK diff before deployment
npm run diff:dev
npm run diff:prod

# Verbose CDK output
cdk deploy --verbose

# Check CloudFormation stack status
aws cloudformation describe-stacks --stack-name acorn-pups-dev-lambda

# View CodeBuild logs
aws logs get-log-events --log-group-name /aws/codebuild/acorn-pups-api-build
```

---

## ✅ **Deployment Checklist**

### **Pre-Deployment:**
- [ ] Node.js v22+ installed
- [ ] AWS CLI configured with correct credentials
- [ ] CDK bootstrapped in target region
- [ ] GitHub repository updated with correct references
- [ ] GitHub token stored in AWS Secrets Manager
- [ ] `npm run build` successful
- [ ] `npm run synth` successful

### **Manual Deployment:**
- [ ] Deploy to dev first: `npm run deploy:dev`
- [ ] Test API endpoints
- [ ] Check CloudWatch dashboards
- [ ] Deploy to prod: `npm run deploy:prod`
- [ ] Verify production functionality

### **Automated Deployment:**
- [ ] Pipeline stacks deployed for both branches
- [ ] GitHub webhooks configured
- [ ] Test deployment via develop branch merge
- [ ] Verify CI/CD pipeline execution
- [ ] Test production deployment via master branch merge

### **Post-Deployment:**
- [ ] API Gateway URL accessible
- [ ] Health check endpoint responding
- [ ] CloudWatch dashboards populated
- [ ] Alarms configured correctly
- [ ] Resource tags applied (Project: "Acorn Pups")

---

## 🎯 **Quick Start Commands**

### **First-Time Setup:**
```powershell
# Complete setup from scratch
npm install
npm run build
cdk bootstrap
npm run deploy:dev
```

### **Daily Development:**
```powershell
# Build and deploy changes
npm run build
npm run deploy:dev
```

### **Production Release:**
```powershell
# Deploy to production
npm run build
npm run deploy:prod
```

### **Emergency Rollback:**
```powershell
# Destroy and redeploy if needed
npm run destroy:dev
npm run deploy:dev
```

---

## 📞 **Support**

### **Useful Resources:**
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [AWS Lambda Developer Guide](https://docs.aws.amazon.com/lambda/)
- [API Gateway Documentation](https://docs.aws.amazon.com/apigateway/)

### **Monitoring & Logs:**
- **CloudWatch Dashboards**: Check monitoring README
- **API Gateway Logs**: `/aws/apigateway/acorn-pups-{env}`
- **Lambda Logs**: `/aws/lambda/acorn-pups-{env}-{function-name}`

For detailed monitoring information, see [MONITORING.md](./MONITORING.md)
For API Gateway specifics, see [API_GATEWAY.md](./API_GATEWAY.md) 