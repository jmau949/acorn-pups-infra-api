# Acorn Pups API Infrastructure Deployment Script
# Usage: .\scripts\deploy.ps1 -Environment dev|prod [-SkipTests]

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("dev", "prod")]
    [string]$Environment,
    
    [switch]$SkipTests,
    
    [switch]$SkipConfirmation
)

# Set error action preference
$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting Acorn Pups API Infrastructure Deployment" -ForegroundColor Green
Write-Host "Environment: $Environment" -ForegroundColor Cyan

# Validate prerequisites
Write-Host "📋 Checking prerequisites..." -ForegroundColor Yellow

# Check if AWS CLI is installed
try {
    aws --version | Out-Null
    Write-Host "✅ AWS CLI is installed" -ForegroundColor Green
} catch {
    Write-Error "❌ AWS CLI is not installed or not in PATH"
    exit 1
}

# Check if CDK is installed
try {
    cdk --version | Out-Null
    Write-Host "✅ AWS CDK is installed" -ForegroundColor Green
} catch {
    Write-Error "❌ AWS CDK is not installed. Run: npm install -g aws-cdk"
    exit 1
}

# Check if Node.js is installed
try {
    node --version | Out-Null
    Write-Host "✅ Node.js is installed" -ForegroundColor Green
} catch {
    Write-Error "❌ Node.js is not installed"
    exit 1
}

# Check AWS credentials
try {
    aws sts get-caller-identity | Out-Null
    $awsAccount = (aws sts get-caller-identity --query Account --output text)
    $awsRegion = (aws configure get region)
    Write-Host "✅ AWS credentials are configured" -ForegroundColor Green
    Write-Host "Account: $awsAccount, Region: $awsRegion" -ForegroundColor Cyan
} catch {
    Write-Error "❌ AWS credentials are not configured or invalid"
    exit 1
}

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm ci
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Failed to install dependencies"
    exit 1
}
Write-Host "✅ Dependencies installed" -ForegroundColor Green

# Build the project
Write-Host "🔨 Building the project..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Build failed"
    exit 1
}
Write-Host "✅ Project built successfully" -ForegroundColor Green

# Run tests (unless skipped)
if (-not $SkipTests) {
    Write-Host "🧪 Running tests..." -ForegroundColor Yellow
    npm test
    if ($LASTEXITCODE -ne 0) {
        Write-Error "❌ Tests failed"
        exit 1
    }
    Write-Host "✅ All tests passed" -ForegroundColor Green
} else {
    Write-Host "⏭️ Skipping tests" -ForegroundColor Yellow
}

# Synthesize CDK
Write-Host "🏗️ Synthesizing CDK templates..." -ForegroundColor Yellow
cdk synth --context environment=$Environment
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ CDK synthesis failed"
    exit 1
}
Write-Host "✅ CDK synthesis completed" -ForegroundColor Green

# Show deployment plan
Write-Host "📋 Deployment plan:" -ForegroundColor Yellow
cdk diff --context environment=$Environment

# Confirmation for production deployments
if ($Environment -eq "prod" -and -not $SkipConfirmation) {
    Write-Host ""
    Write-Host "⚠️  PRODUCTION DEPLOYMENT WARNING" -ForegroundColor Red
    Write-Host "You are about to deploy to the PRODUCTION environment." -ForegroundColor Red
    Write-Host "This will affect live services and users." -ForegroundColor Red
    Write-Host ""
    
    $confirmation = Read-Host "Are you sure you want to continue? (yes/no)"
    if ($confirmation -ne "yes") {
        Write-Host "❌ Deployment cancelled by user" -ForegroundColor Red
        exit 1
    }
}

# Deploy the stacks
Write-Host "🚀 Deploying infrastructure..." -ForegroundColor Yellow
Write-Host "Environment: $Environment" -ForegroundColor Cyan

$startTime = Get-Date

cdk deploy --all --context environment=$Environment --require-approval never
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Deployment failed"
    exit 1
}

$endTime = Get-Date
$duration = $endTime - $startTime

Write-Host ""
Write-Host "🎉 Deployment completed successfully!" -ForegroundColor Green
Write-Host "Environment: $Environment" -ForegroundColor Cyan
Write-Host "Duration: $($duration.ToString('mm\:ss'))" -ForegroundColor Cyan
Write-Host ""

# Get and display stack outputs
Write-Host "📋 Stack Outputs:" -ForegroundColor Yellow
try {
    $stackPrefix = "AcornPups-$Environment"
    
    # API Gateway URL
    $apiUrl = aws cloudformation describe-stacks --stack-name "$stackPrefix-ApiGateway" --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text
    if ($apiUrl) {
        Write-Host "API Gateway URL: $apiUrl" -ForegroundColor Cyan
    }
    
    # Health check
    Write-Host ""
    Write-Host "🏥 Testing health endpoint..." -ForegroundColor Yellow
    try {
        $healthResponse = Invoke-RestMethod -Uri "$apiUrl/health" -Method GET
        Write-Host "✅ Health check passed" -ForegroundColor Green
        Write-Host "Status: $($healthResponse.data.status)" -ForegroundColor Cyan
        Write-Host "Environment: $($healthResponse.data.environment)" -ForegroundColor Cyan
    } catch {
        Write-Host "⚠️  Health check failed: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "⚠️  Could not retrieve stack outputs: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎯 Next steps:" -ForegroundColor Yellow
Write-Host "1. Test the API endpoints using the provided Postman collection" -ForegroundColor White
Write-Host "2. Set up monitoring alerts if this is production" -ForegroundColor White
Write-Host "3. Configure custom domain if needed" -ForegroundColor White
Write-Host ""
Write-Host "Happy coding! 🎉" -ForegroundColor Green 