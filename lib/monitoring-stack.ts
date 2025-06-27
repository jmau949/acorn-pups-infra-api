import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';
import { MonitoringStackProps } from './types';

export class MonitoringStack extends cdk.Stack {
  public readonly dashboard: cloudwatch.Dashboard;
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    // Add project tags to all resources in this stack
    cdk.Tags.of(this).add('Project', 'Acorn Pups');
    cdk.Tags.of(this).add('Environment', props.environment);
    cdk.Tags.of(this).add('Component', 'Monitoring');

    // SNS Topic for alarms
    this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      topicName: `acorn-pups-${props.environment}-alarms`,
      displayName: `Acorn Pups ${props.environment} Alarms`,
    });

    // TODO: Add email subscription for alarms in production
    if (props.environment === 'prod') {
      // this.alarmTopic.addSubscription(
      //   new snsSubscriptions.EmailSubscription('alerts@acornpups.com')
      // );
    }

    // Create CloudWatch Dashboard
    this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `acorn-pups-${props.environment}-api-dashboard`,
    });

    // API Gateway Metrics
    const apiMetrics = this.createApiGatewayMetrics(props);
    const apiWidget = new cloudwatch.GraphWidget({
      title: 'API Gateway Metrics',
      left: [apiMetrics.requestCount, apiMetrics.errorCount],
      right: [apiMetrics.latency],
      width: 12,
      height: 6,
    });

    // Lambda Metrics
    const lambdaWidgets = this.createLambdaMetrics(props);

    // Error Rate Alarm
    const errorRateAlarm = new cloudwatch.Alarm(this, 'HighErrorRateAlarm', {
      alarmName: `acorn-pups-${props.environment}-high-error-rate`,
      alarmDescription: 'High error rate detected in API Gateway',
      metric: apiMetrics.errorRate,
      threshold: props.environment === 'prod' ? 5 : 10, // 5% for prod, 10% for dev
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    errorRateAlarm.addAlarmAction(
      new cloudwatchActions.SnsAction(this.alarmTopic)
    );

    // High Latency Alarm
    const latencyAlarm = new cloudwatch.Alarm(this, 'HighLatencyAlarm', {
      alarmName: `acorn-pups-${props.environment}-high-latency`,
      alarmDescription: 'High latency detected in API Gateway',
      metric: apiMetrics.latency,
      threshold: props.environment === 'prod' ? 2000 : 5000, // 2s for prod, 5s for dev
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    latencyAlarm.addAlarmAction(
      new cloudwatchActions.SnsAction(this.alarmTopic)
    );

    // Add widgets to dashboard
    this.dashboard.addWidgets(
      apiWidget,
      ...lambdaWidgets
    );

    // Create log insights queries for troubleshooting
    this.createLogInsightQueries(props);

    // Outputs
    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
    });

    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value: this.alarmTopic.topicArn,
      description: 'SNS Topic ARN for alarms',
      exportName: `acorn-pups-${props.environment}-alarm-topic-arn`,
    });
  }

  private createApiGatewayMetrics(props: MonitoringStackProps) {
    const apiName = props.apiGateway.restApiName;
    const stage = props.apiGatewayStageName;

    const requestCount = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: 'Count',
      dimensionsMap: {
        ApiName: apiName,
        Stage: stage,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const errorCount = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: '4XXError',
      dimensionsMap: {
        ApiName: apiName,
        Stage: stage,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const serverErrorCount = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: '5XXError',
      dimensionsMap: {
        ApiName: apiName,
        Stage: stage,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const latency = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: 'Latency',
      dimensionsMap: {
        ApiName: apiName,
        Stage: stage,
      },
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    const errorRate = new cloudwatch.MathExpression({
      expression: '(e4xx + e5xx) / requests * 100',
      usingMetrics: {
        requests: requestCount,
        e4xx: errorCount,
        e5xx: serverErrorCount,
      },
      period: cdk.Duration.minutes(5),
    });

    return {
      requestCount,
      errorCount,
      serverErrorCount,
      latency,
      errorRate,
    };
  }

  private createLambdaMetrics(props: MonitoringStackProps) {
    const widgets: cloudwatch.IWidget[] = [];

    // Group functions for better dashboard layout
    const functionGroups = [
      {
        title: 'Device Management Functions',
        functions: [
          props.lambdaFunctions.registerDevice,
          props.lambdaFunctions.getUserDevices,
          props.lambdaFunctions.updateDeviceSettings,
          props.lambdaFunctions.deleteDevice,
        ],
      },
      {
        title: 'Device Status Functions', 
        functions: [
          props.lambdaFunctions.getDeviceStatus,
          props.lambdaFunctions.getDeviceHistory,
        ],
      },
      {
        title: 'User Management Functions',
        functions: [
          props.lambdaFunctions.inviteUser,
          props.lambdaFunctions.removeUser,
          props.lambdaFunctions.getDeviceUsers,
          props.lambdaFunctions.updateUserPreferences,
        ],
      },
    ];

    functionGroups.forEach(group => {
      const invocations = group.functions.map(func => func.metricInvocations());
      const errors = group.functions.map(func => func.metricErrors());
      const duration = group.functions.map(func => func.metricDuration());

      const widget = new cloudwatch.GraphWidget({
        title: group.title,
        left: invocations.concat(errors),
        right: duration,
        width: 12,
        height: 6,
      });

      widgets.push(widget);

      // Create alarms for each function group (simplified to avoid token issues)
      const errorAlarm = new cloudwatch.Alarm(this, `${group.title.replace(/\s/g, '')}ErrorAlarm`, {
        alarmName: `acorn-pups-${props.environment}-${group.title.replace(/\s/g, '').toLowerCase()}-errors`,
        alarmDescription: `High error rate for ${group.title}`,
        metric: new cloudwatch.MathExpression({
          expression: group.functions.map((_, i) => `e${i}`).join(' + '),
          usingMetrics: group.functions.reduce((acc, func, i) => {
            acc[`e${i}`] = func.metricErrors({ period: cdk.Duration.minutes(5) });
            return acc;
          }, {} as { [key: string]: cloudwatch.IMetric }),
          period: cdk.Duration.minutes(5),
        }),
        threshold: 10,
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      if (props.environment === 'prod') {
        errorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));
      }
    });

    // Health check specific widget
    const healthWidget = new cloudwatch.GraphWidget({
      title: 'Health Check Function',
      left: [props.lambdaFunctions.healthCheck.metricInvocations()],
      right: [
        props.lambdaFunctions.healthCheck.metricDuration(),
        props.lambdaFunctions.healthCheck.metricErrors(),
      ],
      width: 12,
      height: 6,
    });

    widgets.push(healthWidget);

    return widgets;
  }

    private createLogInsightQueries(props: MonitoringStackProps) {
    // TODO: Add CloudWatch Insights queries once QueryString type issues are resolved
    // For now, users can create queries manually in the CloudWatch console
    
    // Common error patterns query would be:
    // fields @timestamp, @message
    // filter @message like /ERROR/ or @message like /Error/ or @message like /error/
    // sort @timestamp desc
    // limit 100
    
    // Lambda function errors query would be:
    // fields @timestamp, @requestId, @message
    // filter @type = "REPORT"
    // filter @message like /ERROR/
    // sort @timestamp desc
    // limit 50
    
    // Performance analysis query would be:
    // fields @timestamp, @requestId, @duration, @billedDuration, @maxMemoryUsed
    // filter @type = "REPORT"
    // sort @duration desc
    // limit 25
  }
} 