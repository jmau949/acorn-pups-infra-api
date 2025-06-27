import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { ApiGatewayStack } from '../../lib/api-gateway-stack';
import { LambdaFunctionsStack } from '../../lib/lambda-functions-stack';

describe('ApiGatewayStack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    
    // Create Lambda stack first
    const lambdaStack = new LambdaFunctionsStack(app, 'TestLambdaStack', {
      environment: 'test',
      apiGatewayStageName: 'test',
      domainPrefix: 'api-test',
      logLevel: 'DEBUG',
      throttleRateLimit: 100,
      throttleBurstLimit: 200,
    });

    // Create API Gateway stack
    const apiStack = new ApiGatewayStack(app, 'TestApiStack', {
      environment: 'test',
      apiGatewayStageName: 'test',
      domainPrefix: 'api-test',
      logLevel: 'DEBUG',
      throttleRateLimit: 100,
      throttleBurstLimit: 200,
      lambdaFunctions: lambdaStack.functions,
    });

    template = Template.fromStack(apiStack);
  });

  test('creates REST API with correct configuration', () => {
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Name: 'acorn-pups-test-api',
      Description: 'Acorn Pups API Gateway for test environment',
      MinimumCompressionSize: 1024,
    });
  });

  test('creates deployment with correct stage configuration', () => {
    template.hasResourceProperties('AWS::ApiGateway::Deployment', {
      StageName: 'test',
    });

    template.hasResourceProperties('AWS::ApiGateway::Stage', {
      StageName: 'test',
      ThrottleSettings: {
        RateLimit: 100,
        BurstLimit: 200,
      },
      TracingConfig: {
        TracingEnabled: true,
      },
      MethodSettings: [
        {
          ResourcePath: '/*',
          HttpMethod: '*',
          LoggingLevel: 'INFO',
          DataTrace: true,
          MetricsEnabled: true,
        },
      ],
    });
  });

  test('creates health endpoint', () => {
    template.hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: 'health',
    });

    template.hasResourceProperties('AWS::ApiGateway::Method', {
      HttpMethod: 'GET',
      AuthorizationType: 'NONE', // Health endpoint should not require auth
    });
  });

  test('creates device management endpoints', () => {
    // Check for devices resource
    template.hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: 'devices',
    });

    // Check for register endpoint
    template.hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: 'register',
    });

    // Check for device ID parameter
    template.hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: '{deviceId}',
    });

    // Check for settings endpoint
    template.hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: 'settings',
    });
  });

  test('creates user management endpoints', () => {
    // Check for users resource
    template.hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: 'users',
    });

    // Check for user ID parameter
    template.hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: '{userId}',
    });

    // Check for preferences endpoint
    template.hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: 'preferences',
    });
  });

  test('creates usage plan for rate limiting', () => {
    template.hasResourceProperties('AWS::ApiGateway::UsagePlan', {
      UsagePlanName: 'acorn-pups-test-usage-plan',
      Throttle: {
        RateLimit: 100,
        BurstLimit: 200,
      },
      Quota: {
        Limit: 10000,
        Period: 'DAY',
      },
    });
  });

  test('creates request validator', () => {
    template.hasResourceProperties('AWS::ApiGateway::RequestValidator', {
      Name: 'request-validator',
      ValidateRequestBody: true,
      ValidateRequestParameters: true,
    });
  });

  test('configures CORS properly', () => {
    // Check that OPTIONS methods are created for CORS
    template.hasResourceProperties('AWS::ApiGateway::Method', {
      HttpMethod: 'OPTIONS',
    });
  });

  test('creates CloudWatch log group', () => {
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: '/aws/apigateway/acorn-pups-test',
      RetentionInDays: 7,
    });
  });

  test('creates outputs', () => {
    const outputs = template.findOutputs('*');
    expect(Object.keys(outputs)).toContain('ApiUrl');
    expect(Object.keys(outputs)).toContain('ApiId');
    expect(Object.keys(outputs)).toContain('UsagePlanId');
  });
}); 