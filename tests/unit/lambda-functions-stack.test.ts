import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { LambdaFunctionsStack } from '../../lib/lambda-functions-stack';

describe('LambdaFunctionsStack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new LambdaFunctionsStack(app, 'TestLambdaStack', {
      environment: 'test',
      apiGatewayStageName: 'test',
      domainPrefix: 'api-test',
      logLevel: 'DEBUG',
      throttleRateLimit: 100,
      throttleBurstLimit: 200,
    });
    template = Template.fromStack(stack);
  });

  test('creates all required Lambda functions', () => {
    // Health check function
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'acorn-pups-test-health-check',
      Runtime: 'nodejs18.x',
      Handler: 'index.handler',
    });

    // Device management functions
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'acorn-pups-test-register-device',
    });

    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'acorn-pups-test-get-user-devices',
    });

    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'acorn-pups-test-update-device-settings',
    });

    // User management functions
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'acorn-pups-test-invite-user',
    });
  });

  test('creates shared Lambda layer', () => {
    template.hasResourceProperties('AWS::Lambda::LayerVersion', {
      Description: 'Shared utilities and response handlers',
      CompatibleRuntimes: ['nodejs18.x'],
    });
  });

  test('creates IAM role with proper permissions', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'acorn-pups-test-lambda-role',
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: 'lambda.amazonaws.com',
            },
            Action: 'sts:AssumeRole',
          },
        ],
      },
    });

    // Check for Parameter Store permissions
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Effect: 'Allow',
            Action: [
              'ssm:GetParameter',
              'ssm:GetParameters',
              'ssm:GetParametersByPath',
            ],
          },
        ],
      },
    });
  });

  test('sets correct environment variables', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: {
          ENVIRONMENT: 'test',
          LOG_LEVEL: 'DEBUG',
        },
      },
    });
  });

  test('configures log retention', () => {
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      RetentionInDays: 7,
    });
  });

  test('creates outputs for function ARNs', () => {
    const outputs = template.findOutputs('*FunctionArn');
    expect(Object.keys(outputs)).toContain('healthCheckFunctionArn');
    expect(Object.keys(outputs)).toContain('registerDeviceFunctionArn');
  });
}); 