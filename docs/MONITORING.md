# Acorn Pups API - Monitoring Guide

## 📋 **Table of Contents**
- [Overview](#overview)
- [CloudWatch Dashboards](#cloudwatch-dashboards)
- [Alarms & Notifications](#alarms--notifications)
- [Logging Strategy](#logging-strategy)
- [Metrics & KPIs](#metrics--kpis)
- [Troubleshooting](#troubleshooting)
- [Performance Optimization](#performance-optimization)
- [Cost Monitoring](#cost-monitoring)

---

## 🔍 **Overview**

The Acorn Pups API includes comprehensive monitoring across all infrastructure components:

### **Monitoring Components:**
- **CloudWatch Dashboards** - Visual metrics and graphs
- **CloudWatch Alarms** - Automated alerting
- **Structured Logging** - Centralized log aggregation
- **Distributed Tracing** - Request correlation
- **Performance Metrics** - Latency and throughput monitoring
- **Error Tracking** - Automated error detection and alerting

### **Monitoring Stack Resources:**
```
AcornPups-{env}-Monitoring:
├── CloudWatch Dashboard
├── SNS Alarm Topic
├── API Gateway Metrics & Alarms
├── Lambda Function Metrics & Alarms
├── CloudWatch Log Insights Queries
└── Custom Metric Dashboards
```

---

## 📊 **CloudWatch Dashboards**

### **Main Dashboard Access**
After deployment, find your dashboard at:
```
https://{region}.console.aws.amazon.com/cloudwatch/home?region={region}#dashboards:name=acorn-pups-{env}-api-dashboard
```

### **Dashboard Sections:**

#### **1. API Gateway Metrics**
- **Request Count**: Total API requests per 5-minute period
- **Error Count**: 4XX and 5XX errors
- **Latency**: Average response time
- **Error Rate**: Percentage of failed requests

#### **2. Lambda Function Groups**

**Device Management Functions:**
- `register-device`, `get-user-devices`, `update-device-settings`, `delete-device`

**Device Status Functions:**
- `get-device-status`, `get-device-history`

**User Management Functions:**
- `invite-user`, `remove-user`, `get-device-users`, `update-user-preferences`

**Health Check Function:**
- `health-check` (isolated monitoring)

#### **3. Widget Configuration**
Each widget shows:
- **Left Y-Axis**: Invocations and Errors
- **Right Y-Axis**: Duration (milliseconds)
- **Time Range**: Configurable (default: 1 hour)

### **Custom Dashboard Creation**
```powershell
# Access dashboard programmatically
aws cloudwatch get-dashboard --dashboard-name acorn-pups-dev-api-dashboard

# Create custom widgets
aws cloudwatch put-dashboard --dashboard-name custom-acorn-pups --dashboard-body file://custom-dashboard.json
```

---

## 🚨 **Alarms & Notifications**

### **Configured Alarms:**

#### **1. High Error Rate Alarm**
```yaml
Name: acorn-pups-{env}-high-error-rate
Metric: API Gateway Error Rate
Threshold: 
  - Development: 10%
  - Production: 5%
Evaluation: 2 consecutive periods of 5 minutes
Action: SNS notification (production only)
```

#### **2. High Latency Alarm**
```yaml
Name: acorn-pups-{env}-high-latency
Metric: API Gateway Average Latency
Threshold:
  - Development: 5000ms
  - Production: 2000ms  
Evaluation: 2 out of 3 periods of 5 minutes
Action: SNS notification (production only)
```

#### **3. Lambda Function Group Alarms**
```yaml
Name: acorn-pups-{env}-{function-group}-errors
Metric: Sum of all function errors in group
Threshold: 10 errors in 5 minutes
Evaluation: 2 consecutive periods
Action: SNS notification (production only)
```

### **SNS Topic Configuration**
```
Topic: acorn-pups-{env}-alarms
Description: Acorn Pups {env} Alarms
```

#### **Subscribe to Alerts:**
```powershell
# Subscribe email to alarm topic
aws sns subscribe \
    --topic-arn arn:aws:sns:{region}:{account}:acorn-pups-prod-alarms \
    --protocol email \
    --notification-endpoint your-email@domain.com

# Subscribe SMS (optional)
aws sns subscribe \
    --topic-arn arn:aws:sns:{region}:{account}:acorn-pups-prod-alarms \
    --protocol sms \
    --notification-endpoint +1234567890
```

### **Alarm States:**
- **OK**: Metric within normal range
- **ALARM**: Threshold breached
- **INSUFFICIENT_DATA**: Not enough data points

### **Managing Alarms:**
```powershell
# List all alarms
aws cloudwatch describe-alarms --alarm-name-prefix acorn-pups

# Disable alarm temporarily
aws cloudwatch disable-alarm-actions --alarm-names acorn-pups-prod-high-error-rate

# Re-enable alarm
aws cloudwatch enable-alarm-actions --alarm-names acorn-pups-prod-high-error-rate
```

---

## 📝 **Logging Strategy**

### **Log Group Structure:**
```
API Gateway Logs:
└── /aws/apigateway/acorn-pups-{env}

Lambda Function Logs:
├── /aws/lambda/acorn-pups-{env}-health-check
├── /aws/lambda/acorn-pups-{env}-register-device
├── /aws/lambda/acorn-pups-{env}-get-user-devices
└── ... (all other functions)

CodeBuild Logs:
└── /aws/codebuild/acorn-pups-api-build
```

### **Log Retention:**
- **Development**: 7 days
- **Production**: 30 days (configurable)

### **Structured Logging Format:**
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "abc-123-def-456",
  "level": "INFO",
  "function": "register-device",
  "message": "Device registration successful",
  "userId": "user123",
  "deviceId": "device456",
  "environment": "prod"
}
```

### **Log Insights Queries**

#### **Error Pattern Detection:**
```sql
fields @timestamp, @message
| filter @message like /ERROR/ or @message like /Error/ or @message like /error/
| sort @timestamp desc
| limit 100
```

#### **Performance Analysis:**
```sql
fields @timestamp, @requestId, @duration, @billedDuration, @maxMemoryUsed
| filter @type = "REPORT"
| sort @duration desc
| limit 25
```

#### **Request Correlation:**
```sql
fields @timestamp, @requestId, @message
| filter @requestId = "your-request-id-here"
| sort @timestamp asc
```

### **Accessing Logs:**
```powershell
# Stream logs in real-time
aws logs tail /aws/lambda/acorn-pups-dev-health-check --follow

# Get specific time range
aws logs filter-log-events \
    --log-group-name /aws/lambda/acorn-pups-dev-health-check \
    --start-time 1642234200000 \
    --end-time 1642237800000

# Search for specific patterns
aws logs filter-log-events \
    --log-group-name /aws/apigateway/acorn-pups-dev \
    --filter-pattern "ERROR"
```

---

## 📈 **Metrics & KPIs**

### **API Gateway Metrics:**

#### **Request Metrics:**
- **Count**: Total number of requests
- **4XXError**: Client-side errors
- **5XXError**: Server-side errors
- **Latency**: End-to-end request latency
- **IntegrationLatency**: Backend integration latency

#### **Custom Dimensions:**
- **ApiName**: `acorn-pups-{env}-api`
- **Stage**: `{env}`
- **Method**: `GET`, `POST`, `PUT`, `DELETE`
- **Resource**: `/health`, `/devices/{deviceId}`, etc.

### **Lambda Metrics:**

#### **Standard Metrics:**
- **Invocations**: Number of function executions
- **Errors**: Number of failed executions
- **Duration**: Execution time (milliseconds)
- **Throttles**: Number of throttled invocations
- **ConcurrentExecutions**: Number of concurrent executions

#### **Custom Metrics:**
```typescript
// In Lambda function code
const cloudwatch = new CloudWatchClient({});

await cloudwatch.send(new PutMetricDataCommand({
  Namespace: 'AcornPups/API',
  MetricData: [{
    MetricName: 'DeviceRegistrationSuccess',
    Value: 1,
    Unit: 'Count',
    Dimensions: [{
      Name: 'Environment',
      Value: process.env.ENVIRONMENT
    }]
  }]
}));
```

### **Key Performance Indicators (KPIs):**

#### **Availability:**
- **Target**: 99.9% uptime
- **Measurement**: Health check success rate
- **Alert Threshold**: < 99.5%

#### **Performance:**
- **Target**: < 500ms average latency
- **Measurement**: API Gateway latency
- **Alert Threshold**: > 2000ms (prod), > 5000ms (dev)

#### **Error Rate:**
- **Target**: < 1% error rate
- **Measurement**: 4XX + 5XX / Total requests
- **Alert Threshold**: > 5% (prod), > 10% (dev)

#### **Throughput:**
- **Capacity**: 1000 RPS (prod), 100 RPS (dev)
- **Measurement**: Requests per second
- **Monitoring**: Rate limiting effectiveness

---

## 🔧 **Troubleshooting**

### **Common Issues & Solutions:**

#### **1. High Latency**
**Symptoms:**
- Dashboard shows increased latency
- Users report slow responses

**Investigation:**
```powershell
# Check Lambda duration metrics
aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name Duration \
    --dimensions Name=FunctionName,Value=acorn-pups-prod-register-device \
    --start-time 2024-01-15T10:00:00Z \
    --end-time 2024-01-15T11:00:00Z \
    --period 300 \
    --statistics Average,Maximum
```

**Solutions:**
- Increase Lambda memory allocation
- Optimize database queries
- Implement caching
- Review cold start impacts

#### **2. High Error Rate**
**Symptoms:**
- Error rate alarm triggered
- 4XX/5XX errors in dashboard

**Investigation:**
```sql
-- CloudWatch Logs Insights
fields @timestamp, @message, @requestId
| filter @message like /ERROR/
| sort @timestamp desc
| limit 50
```

**Solutions:**
- Check API Gateway request validation
- Review Lambda function logic
- Verify IAM permissions
- Check external service dependencies

#### **3. Function Throttling**
**Symptoms:**
- Throttles metric > 0
- Some requests timing out

**Investigation:**
```powershell
# Check concurrent executions
aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name ConcurrentExecutions \
    --start-time 2024-01-15T10:00:00Z \
    --end-time 2024-01-15T11:00:00Z \
    --period 300 \
    --statistics Maximum
```

**Solutions:**
- Increase reserved concurrency
- Optimize function execution time
- Implement exponential backoff in clients

#### **4. Memory Issues**
**Investigation:**
```sql
-- Check memory usage
fields @timestamp, @maxMemoryUsed, @memorySize
| filter @type = "REPORT"
| sort @timestamp desc
| limit 100
```

**Solutions:**
- Increase Lambda memory allocation
- Optimize memory usage in code
- Check for memory leaks

### **Debug Workflow:**
1. **Check Dashboard** - Identify affected metrics
2. **Review Alarms** - Understand what triggered alerts
3. **Analyze Logs** - Use CloudWatch Logs Insights
4. **Correlate Requests** - Track specific request IDs
5. **Test Endpoints** - Validate fixes with health checks
6. **Monitor Recovery** - Watch metrics return to normal

---

## ⚡ **Performance Optimization**

### **Lambda Optimization:**

#### **Memory & Duration Tuning:**
```typescript
// Optimal memory allocation (test different values)
memorySize: 512, // Start with 512MB, monitor and adjust

// Timeout configuration
timeout: cdk.Duration.seconds(30), // Adjust based on function complexity
```

#### **Cold Start Reduction:**
- Keep functions warm with CloudWatch Events
- Minimize package size with esbuild bundling
- Use ARM64 architecture for better price/performance

### **API Gateway Optimization:**

#### **Caching:**
```typescript
// Enable response caching
cachingEnabled: true,
cacheKeyParameters: ['userId', 'deviceId'],
cacheTtl: cdk.Duration.minutes(5),
```

#### **Request Validation:**
- Enable request validation to reduce Lambda invocations
- Use JSON Schema validation
- Implement proper error responses

### **Monitoring Cost Optimization:**
- Use metric filters instead of streaming logs
- Set appropriate log retention periods
- Archive old logs to S3 for long-term storage

---

## 💰 **Cost Monitoring**

### **AWS Cost & Usage Reports:**
```powershell
# Get cost by service
aws ce get-cost-and-usage \
    --time-period Start=2024-01-01,End=2024-01-31 \
    --granularity MONTHLY \
    --metrics BlendedCost \
    --group-by Type=DIMENSION,Key=SERVICE

# Filter by resource tags
aws ce get-cost-and-usage \
    --time-period Start=2024-01-01,End=2024-01-31 \
    --granularity MONTHLY \
    --metrics BlendedCost \
    --group-by Type=TAG,Key=Project
```

### **Cost Optimization Tips:**
- Monitor Lambda duration vs. memory allocation
- Use ARM64 for 20% cost savings
- Implement proper log retention policies
- Review API Gateway pricing tiers
- Use Reserved Capacity for predictable workloads

### **Budget Alerts:**
```powershell
# Create budget for Acorn Pups project
aws budgets create-budget \
    --account-id 123456789012 \
    --budget file://acorn-pups-budget.json
```

---

## 📱 **Monitoring Best Practices**

### **Daily Monitoring Routine:**
1. Check dashboard for anomalies
2. Review error rate trends
3. Monitor latency patterns
4. Check alarm status
5. Review cost metrics

### **Weekly Review:**
1. Analyze performance trends
2. Review log patterns
3. Optimize based on metrics
4. Update alarm thresholds if needed
5. Check capacity planning

### **Incident Response:**
1. **Acknowledge** - Confirm alert receipt
2. **Assess** - Determine severity and impact
3. **Investigate** - Use logs and metrics to diagnose
4. **Mitigate** - Implement temporary fixes
5. **Resolve** - Implement permanent solution
6. **Document** - Record lessons learned

---

## 🎯 **Quick Reference Commands**

### **Real-time Monitoring:**
```powershell
# Watch logs live
aws logs tail /aws/lambda/acorn-pups-prod-health-check --follow

# Check current alarm status
aws cloudwatch describe-alarms --state-value ALARM

# Get latest metrics
aws cloudwatch get-metric-statistics \
    --namespace AWS/ApiGateway \
    --metric-name Count \
    --dimensions Name=ApiName,Value=acorn-pups-prod-api \
    --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 300 \
    --statistics Sum
```

### **Emergency Commands:**
```powershell
# Disable all alarms temporarily
aws cloudwatch disable-alarm-actions --alarm-names $(aws cloudwatch describe-alarms --query 'MetricAlarms[?starts_with(AlarmName, `acorn-pups-prod`)].AlarmName' --output text)

# Check API health
curl https://your-api-url.execute-api.region.amazonaws.com/prod/health

# Scale Lambda concurrency
aws lambda put-reserved-concurrency-configuration \
    --function-name acorn-pups-prod-register-device \
    --reserved-concurrent-executions 100
```

---

## 📞 **Support & Resources**

### **Monitoring Dashboard URLs:**
- **Development**: `https://console.aws.amazon.com/cloudwatch/home#dashboards:name=acorn-pups-dev-api-dashboard`
- **Production**: `https://console.aws.amazon.com/cloudwatch/home#dashboards:name=acorn-pups-prod-api-dashboard`

### **Useful AWS Documentation:**
- [CloudWatch User Guide](https://docs.aws.amazon.com/cloudwatch/)
- [Lambda Monitoring](https://docs.aws.amazon.com/lambda/latest/dg/monitoring-functions.html)
- [API Gateway Monitoring](https://docs.aws.amazon.com/apigateway/latest/developerguide/monitoring-cloudwatch.html)

### **Log Insights Documentation:**
- [Query Syntax](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax.html)
- [Sample Queries](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_AnalyzeLogData_Examples.html)

For deployment information, see [DEPLOYMENT.md](./DEPLOYMENT.md)
For API Gateway specifics, see [API_GATEWAY.md](./API_GATEWAY.md) 