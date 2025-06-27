# Acorn Pups API Endpoint Testing Script
# Usage: .\scripts\test-endpoints.ps1 -Environment dev|prod [-Verbose]

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("dev", "prod")]
    [string]$Environment,
    
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

Write-Host "🧪 Testing Acorn Pups API Endpoints" -ForegroundColor Green
Write-Host "Environment: $Environment" -ForegroundColor Cyan

# Get API Gateway URL from CloudFormation
try {
    $stackName = "AcornPups-$Environment-ApiGateway"
    $apiUrl = aws cloudformation describe-stacks --stack-name $stackName --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text
    
    if (-not $apiUrl) {
        Write-Error "❌ Could not retrieve API URL from CloudFormation stack: $stackName"
        exit 1
    }
    
    Write-Host "API Base URL: $apiUrl" -ForegroundColor Cyan
} catch {
    Write-Error "❌ Failed to get API URL: $($_.Exception.Message)"
    exit 1
}

# Test results tracking
$testResults = @()

function Test-Endpoint {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body = $null,
        [hashtable]$Headers = @{},
        [int[]]$ExpectedStatusCodes = @(200)
    )
    
    $url = $apiUrl.TrimEnd('/') + '/' + $Path.TrimStart('/')
    $testName = "$Method $Path"
    
    Write-Host ""
    Write-Host "Testing: $testName" -ForegroundColor Yellow
    Write-Host "URL: $url" -ForegroundColor Gray
    
    try {
        $requestParams = @{
            Uri = $url
            Method = $Method
            Headers = $Headers
        }
        
        if ($Body -and ($Method -eq "POST" -or $Method -eq "PUT")) {
            $requestParams.Body = ($Body | ConvertTo-Json -Depth 10)
            $requestParams.ContentType = "application/json"
        }
        
        if ($Verbose) {
            Write-Host "Request: $($requestParams | ConvertTo-Json -Depth 2)" -ForegroundColor Gray
        }
        
        $response = Invoke-WebRequest @requestParams -UseBasicParsing
        $statusCode = [int]$response.StatusCode
        $content = $response.Content | ConvertFrom-Json -ErrorAction SilentlyContinue
        
        $success = $statusCode -in $ExpectedStatusCodes
        
        if ($success) {
            Write-Host "✅ $testName - Status: $statusCode" -ForegroundColor Green
        } else {
            Write-Host "❌ $testName - Status: $statusCode (Expected: $($ExpectedStatusCodes -join ', '))" -ForegroundColor Red
        }
        
        if ($Verbose -and $content) {
            Write-Host "Response: $($content | ConvertTo-Json -Depth 2)" -ForegroundColor Gray
        }
        
        $script:testResults += @{
            Test = $testName
            Success = $success
            StatusCode = $statusCode
            Expected = $ExpectedStatusCodes
            Response = $content
        }
        
    } catch {
        $statusCode = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
        $success = $statusCode -in $ExpectedStatusCodes
        
        if ($success) {
            Write-Host "✅ $testName - Status: $statusCode (Expected error)" -ForegroundColor Green
        } else {
            Write-Host "❌ $testName - Error: $($_.Exception.Message)" -ForegroundColor Red
        }
        
        $script:testResults += @{
            Test = $testName
            Success = $success
            StatusCode = $statusCode
            Expected = $ExpectedStatusCodes
            Error = $_.Exception.Message
        }
    }
}

Write-Host ""
Write-Host "🏥 Testing Health Endpoint (No Auth Required)" -ForegroundColor Magenta
Test-Endpoint -Method "GET" -Path "health"

Write-Host ""
Write-Host "📱 Testing Device Management Endpoints" -ForegroundColor Magenta

# Test device registration (should fail without auth)
Test-Endpoint -Method "POST" -Path "devices/register" -Body @{
    deviceId = "test-device-001"
    deviceName = "Test Button"
    deviceType = "acorn-button-v1"
    userId = "test-user-001"
} -ExpectedStatusCodes @(401, 403)

# Test get user devices (should fail without auth)
Test-Endpoint -Method "GET" -Path "users/test-user-001/devices" -ExpectedStatusCodes @(401, 403)

# Test update device settings (should fail without auth)
Test-Endpoint -Method "PUT" -Path "devices/test-device-001/settings" -Body @{
    buttonSensitivity = 5
    notificationPreferences = @{
        pushEnabled = $true
        emailEnabled = $false
    }
} -ExpectedStatusCodes @(401, 403)

# Test delete device (should fail without auth)
Test-Endpoint -Method "DELETE" -Path "devices/test-device-001" -ExpectedStatusCodes @(401, 403)

# Test device status (should fail without auth)
Test-Endpoint -Method "GET" -Path "devices/test-device-001/status" -ExpectedStatusCodes @(401, 403)

# Test device history (should fail without auth)
Test-Endpoint -Method "GET" -Path "devices/test-device-001/history" -ExpectedStatusCodes @(401, 403)

Write-Host ""
Write-Host "👥 Testing User Management Endpoints" -ForegroundColor Magenta

# Test invite user (should fail without auth)
Test-Endpoint -Method "POST" -Path "devices/test-device-001/invite" -Body @{
    email = "test@example.com"
    role = "viewer"
} -ExpectedStatusCodes @(401, 403)

# Test get device users (should fail without auth)
Test-Endpoint -Method "GET" -Path "devices/test-device-001/users" -ExpectedStatusCodes @(401, 403)

# Test remove user (should fail without auth)
Test-Endpoint -Method "DELETE" -Path "devices/test-device-001/users/test-user-002" -ExpectedStatusCodes @(401, 403)

# Test update user preferences (should fail without auth)
Test-Endpoint -Method "PUT" -Path "users/test-user-001/preferences" -Body @{
    notifications = @{
        pushEnabled = $true
        emailEnabled = $true
    }
} -ExpectedStatusCodes @(401, 403)

Write-Host ""
Write-Host "🔍 Testing Invalid Endpoints" -ForegroundColor Magenta

# Test non-existent endpoint
Test-Endpoint -Method "GET" -Path "nonexistent" -ExpectedStatusCodes @(404)

# Test invalid method
Test-Endpoint -Method "PATCH" -Path "health" -ExpectedStatusCodes @(405, 404)

# Summary
Write-Host ""
Write-Host "📊 Test Results Summary" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green

$totalTests = $testResults.Count
$passedTests = ($testResults | Where-Object { $_.Success }).Count
$failedTests = $totalTests - $passedTests

Write-Host "Total Tests: $totalTests" -ForegroundColor Cyan
Write-Host "Passed: $passedTests" -ForegroundColor Green
Write-Host "Failed: $failedTests" -ForegroundColor Red

if ($failedTests -gt 0) {
    Write-Host ""
    Write-Host "❌ Failed Tests:" -ForegroundColor Red
    $testResults | Where-Object { -not $_.Success } | ForEach-Object {
        Write-Host "  - $($_.Test) (Status: $($_.StatusCode), Expected: $($_.Expected -join ', '))" -ForegroundColor Red
        if ($_.Error) {
            Write-Host "    Error: $($_.Error)" -ForegroundColor Red
        }
    }
}

Write-Host ""
if ($failedTests -eq 0) {
    Write-Host "🎉 All tests passed! The API is working correctly." -ForegroundColor Green
} else {
    Write-Host "⚠️  Some tests failed. Please review the results above." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📝 Notes:" -ForegroundColor Yellow
Write-Host "- Most endpoints should return 401/403 since authentication is not yet implemented" -ForegroundColor White
Write-Host "- Health endpoint should return 200 and show API status" -ForegroundColor White
Write-Host "- This validates that API Gateway routing is working correctly" -ForegroundColor White

exit $failedTests 