import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { ApiGatewayStackProps } from './types';
import { ParameterStoreHelper } from './parameter-store-helper';

export class ApiGatewayStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
    super(scope, id, props);

    // Add project tags to all resources in this stack
    cdk.Tags.of(this).add('Project', 'acorn-pups');
    cdk.Tags.of(this).add('Environment', props.environment);
    cdk.Tags.of(this).add('Component', 'api-gateway');

    // CloudWatch Log Group for API Gateway
    const logGroup = new logs.LogGroup(this, 'apigatewayLogs', {
      logGroupName: `/aws/apigateway/acorn-pups-${props.environment}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create REST API
    this.api = new apigateway.RestApi(this, 'acorn-pups-api', {
      restApiName: `acorn-pups-${props.environment}-api`,
      description: `Acorn Pups API Gateway for ${props.environment} environment`,
      
      // CORS configuration for mobile app
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS, // TODO: Restrict to mobile app domains in production
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
          'X-Amz-User-Agent',
          'X-Requested-With',
        ],
        exposeHeaders: [
          'X-Request-ID',
          'X-Amz-Request-Id',
        ],
        allowCredentials: true,
        maxAge: cdk.Duration.hours(1),
      },

      // Deployment configuration
      deploy: true,
      deployOptions: {
        stageName: props.apiGatewayStageName,
        accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
          caller: false,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
        }),
        throttlingRateLimit: props.throttleRateLimit,
        throttlingBurstLimit: props.throttleBurstLimit,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: props.environment === 'dev',
        metricsEnabled: true,
      },

      // Binary media types
      binaryMediaTypes: ['image/*', 'application/octet-stream'],

      // Minimum compression size  
      minCompressionSize: cdk.Size.bytes(1024),
    });

    // Configure gateway responses for standardized error handling
    this.configureGatewayResponses();

    // Request validator for body validation
    const requestValidator = new apigateway.RequestValidator(this, 'RequestValidator', {
      restApi: this.api,
      requestValidatorName: 'request-validator',
      validateRequestBody: true,
      validateRequestParameters: true,
    });

    // Lambda integration options with request ID
    const lambdaIntegrationOptions: apigateway.LambdaIntegrationOptions = {
      requestTemplates: {
        'application/json': JSON.stringify({
          httpMethod: '$context.httpMethod',
          resourcePath: '$context.resourcePath',
          requestId: '$context.requestId',
          body: '$util.escapeJavaScript($input.body)',
          headers: '$util.escapeJavaScript($input.params().header)',
          queryStringParameters: '$util.escapeJavaScript($input.params().querystring)',
          pathParameters: '$util.escapeJavaScript($input.params().path)',
          requestContext: {
            accountId: '$context.accountId',
            apiId: '$context.apiId',
            stage: '$context.stage',
            requestTime: '$context.requestTime',
            requestTimeEpoch: '$context.requestTimeEpoch',
            identity: {
              sourceIp: '$context.identity.sourceIp',
              userAgent: '$context.identity.userAgent',
            },
          },
        }),
      },
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
            'method.response.header.Access-Control-Allow-Headers': "'*'",
            'method.response.header.X-Request-ID': 'context.requestId',
          },
        },
        {
          statusCode: '400',
          selectionPattern: '4\\d{2}',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
            'method.response.header.Access-Control-Allow-Headers': "'*'",
            'method.response.header.X-Request-ID': 'context.requestId',
          },
        },
        {
          statusCode: '500',
          selectionPattern: '5\\d{2}',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
            'method.response.header.Access-Control-Allow-Headers': "'*'",
            'method.response.header.X-Request-ID': 'context.requestId',
          },
        },
      ],
    };

    // Method response template with CORS headers
    const methodResponses: apigateway.MethodResponse[] = [
      {
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.X-Request-ID': true,
        },
      },
      {
        statusCode: '400',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.X-Request-ID': true,
        },
      },
      {
        statusCode: '500',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.X-Request-ID': true,
        },
      },
    ];

    // Create usage plan for rate limiting
    const usagePlan = new apigateway.UsagePlan(this, 'UsagePlan', {
      name: `acorn-pups-${props.environment}-usage-plan`,
      apiStages: [
        {
          api: this.api,
          stage: this.api.deploymentStage,
        },
      ],
      throttle: {
        rateLimit: props.throttleRateLimit,
        burstLimit: props.throttleBurstLimit,
      },
      quota: {
        limit: props.environment === 'prod' ? 100000 : 10000,
        period: apigateway.Period.DAY,
      },
    });

    // ==== ROUTE DEFINITIONS ====

    // Health endpoint (no auth required)
    const healthResource = this.api.root.addResource('health');
    healthResource.addMethod('GET', 
      new apigateway.LambdaIntegration(props.lambdaFunctions.healthCheck, lambdaIntegrationOptions),
      {
        methodResponses,
        requestValidator,
      }
    );

    // Device management routes
    const devicesResource = this.api.root.addResource('devices');
    
    // POST /devices/register
    const registerResource = devicesResource.addResource('register');
    registerResource.addMethod('POST',
      new apigateway.LambdaIntegration(props.lambdaFunctions.registerDevice, lambdaIntegrationOptions),
      {
        methodResponses,
        requestValidator,
        // TODO: Add Cognito authorizer
      }
    );

    // DELETE /devices/{deviceId}
    const deviceResource = devicesResource.addResource('{deviceId}');
    deviceResource.addMethod('DELETE',
      new apigateway.LambdaIntegration(props.lambdaFunctions.deleteDevice, lambdaIntegrationOptions),
      {
        methodResponses,
        requestValidator,
        // TODO: Add Cognito authorizer
      }
    );

    // PUT /devices/{deviceId}/settings
    const settingsResource = deviceResource.addResource('settings');
    settingsResource.addMethod('PUT',
      new apigateway.LambdaIntegration(props.lambdaFunctions.updateDeviceSettings, lambdaIntegrationOptions),
      {
        methodResponses,
        requestValidator,
        // TODO: Add Cognito authorizer
      }
    );

    // GET /devices/{deviceId}/status
    const statusResource = deviceResource.addResource('status');
    statusResource.addMethod('GET',
      new apigateway.LambdaIntegration(props.lambdaFunctions.getDeviceStatus, lambdaIntegrationOptions),
      {
        methodResponses,
        requestValidator,
        // TODO: Add Cognito authorizer
      }
    );

    // GET /devices/{deviceId}/history
    const historyResource = deviceResource.addResource('history');
    historyResource.addMethod('GET',
      new apigateway.LambdaIntegration(props.lambdaFunctions.getDeviceHistory, lambdaIntegrationOptions),
      {
        methodResponses,
        requestValidator,
        // TODO: Add Cognito authorizer
      }
    );

    // User management routes
    const usersResource = this.api.root.addResource('users');
    
    // GET /users/{userId}/devices
    const userResource = usersResource.addResource('{userId}');
    const userDevicesResource = userResource.addResource('devices');
    userDevicesResource.addMethod('GET',
      new apigateway.LambdaIntegration(props.lambdaFunctions.getUserDevices, lambdaIntegrationOptions),
      {
        methodResponses,
        requestValidator,
        // TODO: Add Cognito authorizer
      }
    );

    // PUT /users/{userId}/preferences  
    const preferencesResource = userResource.addResource('preferences');
    preferencesResource.addMethod('PUT',
      new apigateway.LambdaIntegration(props.lambdaFunctions.updateUserPreferences, lambdaIntegrationOptions),
      {
        methodResponses,
        requestValidator,
        // TODO: Add Cognito authorizer
      }
    );

    // Device user management routes
    // POST /devices/{deviceId}/invite
    const inviteResource = deviceResource.addResource('invite');
    inviteResource.addMethod('POST',
      new apigateway.LambdaIntegration(props.lambdaFunctions.inviteUser, lambdaIntegrationOptions),
      {
        methodResponses,
        requestValidator,
        // TODO: Add Cognito authorizer
      }
    );

    // GET /devices/{deviceId}/users
    const deviceUsersResource = deviceResource.addResource('users');
    deviceUsersResource.addMethod('GET',
      new apigateway.LambdaIntegration(props.lambdaFunctions.getDeviceUsers, lambdaIntegrationOptions),
      {
        methodResponses,
        requestValidator,
        // TODO: Add Cognito authorizer
      }
    );

    // DELETE /devices/{deviceId}/users/{userId}
    const deviceUserResource = deviceUsersResource.addResource('{userId}');
    deviceUserResource.addMethod('DELETE',
      new apigateway.LambdaIntegration(props.lambdaFunctions.removeUser, lambdaIntegrationOptions),
      {
        methodResponses,
        requestValidator,
        // TODO: Add Cognito authorizer
      }
    );

    // Initialize Parameter Store helper
    const parameterHelper = new ParameterStoreHelper(this, {
      environment: props.environment,
      stackName: 'api-gateway',
    });

    // Create outputs with corresponding Parameter Store parameters
    parameterHelper.createMultipleOutputsWithParameters([
      {
        outputId: 'ApiUrl',
        value: this.api.url,
        description: 'API Gateway URL',
        exportName: `acorn-pups-${props.environment}-api-url`,
      },
      {
        outputId: 'ApiId',
        value: this.api.restApiId,
        description: 'API Gateway ID',
        exportName: `acorn-pups-${props.environment}-api-id`,
      },
      {
        outputId: 'UsagePlanId',
        value: usagePlan.usagePlanId,
        description: 'Usage Plan ID for API keys',
        exportName: `acorn-pups-${props.environment}-usage-plan-id`,
      },
      {
        outputId: 'ApiName',
        value: this.api.restApiName,
        description: 'API Gateway name',
        exportName: `acorn-pups-${props.environment}-api-name`,
      },
      {
        outputId: 'ApiStage',
        value: props.apiGatewayStageName,
        description: 'API Gateway deployment stage',
        exportName: `acorn-pups-${props.environment}-api-stage`,
      },
    ]);
  }

  private configureGatewayResponses() {
    // Unauthorized response
    new apigateway.GatewayResponse(this, 'UnauthorizedResponse', {
      restApi: this.api,
      type: apigateway.ResponseType.UNAUTHORIZED,
      statusCode: '401',
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'*'",
      },
      templates: {
        'application/json': JSON.stringify({
          error: 'Unauthorized',
          message: 'Authentication required',
          requestId: '$context.requestId',
        }),
      },
    });

    // Access denied response
    new apigateway.GatewayResponse(this, 'AccessDeniedResponse', {
      restApi: this.api,
      type: apigateway.ResponseType.ACCESS_DENIED,
      statusCode: '403',
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'*'",
      },
      templates: {
        'application/json': JSON.stringify({
          error: 'AccessDenied',
          message: 'Insufficient permissions',
          requestId: '$context.requestId',
        }),
      },
    });

    // Default 4XX response
    new apigateway.GatewayResponse(this, 'Default4XXResponse', {
      restApi: this.api,
      type: apigateway.ResponseType.DEFAULT_4XX,
      statusCode: '400',
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'*'",
      },
      templates: {
        'application/json': JSON.stringify({
          error: 'BadRequest',
          message: 'Invalid request',
          requestId: '$context.requestId',
        }),
      },
    });

    // Default 5XX response
    new apigateway.GatewayResponse(this, 'Default5XXResponse', {
      restApi: this.api,
      type: apigateway.ResponseType.DEFAULT_5XX,
      statusCode: '500',
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'*'",
      },
      templates: {
        'application/json': JSON.stringify({
          error: 'InternalServerError',
          message: 'An internal error occurred',
          requestId: '$context.requestId',
        }),
      },
    });
  }
} 