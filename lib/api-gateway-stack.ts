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
          'X-Correlation-ID',
          'X-Client-Version',
        ],
        exposeHeaders: [
          'X-Request-ID',
          'X-API-Version',
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

    // Lambda integration options with request ID and new headers
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
            'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,X-Requested-With,X-Correlation-ID,X-Client-Version'",
            'method.response.header.Access-Control-Expose-Headers': "'X-Request-ID,X-API-Version'",
            'method.response.header.X-Request-ID': 'context.requestId',
            'method.response.header.X-API-Version': "'1.0.0'",
          },
        },
        {
          statusCode: '400',
          selectionPattern: '4\\d{2}',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
            'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,X-Requested-With,X-Correlation-ID,X-Client-Version'",
            'method.response.header.Access-Control-Expose-Headers': "'X-Request-ID,X-API-Version'",
            'method.response.header.X-Request-ID': 'context.requestId',
            'method.response.header.X-API-Version': "'1.0.0'",
          },
        },
        {
          statusCode: '500',
          selectionPattern: '5\\d{2}',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
            'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,X-Requested-With,X-Correlation-ID,X-Client-Version'",
            'method.response.header.Access-Control-Expose-Headers': "'X-Request-ID,X-API-Version'",
            'method.response.header.X-Request-ID': 'context.requestId',
            'method.response.header.X-API-Version': "'1.0.0'",
          },
        },
      ],
    };

    // Method response template with CORS headers and new headers
    const methodResponses: apigateway.MethodResponse[] = [
      {
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.Access-Control-Expose-Headers': true,
          'method.response.header.X-Request-ID': true,
          'method.response.header.X-API-Version': true,
        },
      },
      {
        statusCode: '201',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.Access-Control-Expose-Headers': true,
          'method.response.header.X-Request-ID': true,
          'method.response.header.X-API-Version': true,
        },
      },
      {
        statusCode: '204',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.Access-Control-Expose-Headers': true,
          'method.response.header.X-Request-ID': true,
          'method.response.header.X-API-Version': true,
        },
      },
      {
        statusCode: '400',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.Access-Control-Expose-Headers': true,
          'method.response.header.X-Request-ID': true,
          'method.response.header.X-API-Version': true,
        },
      },
      {
        statusCode: '401',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.Access-Control-Expose-Headers': true,
          'method.response.header.X-Request-ID': true,
          'method.response.header.X-API-Version': true,
        },
      },
      {
        statusCode: '403',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.Access-Control-Expose-Headers': true,
          'method.response.header.X-Request-ID': true,
          'method.response.header.X-API-Version': true,
        },
      },
      {
        statusCode: '404',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.Access-Control-Expose-Headers': true,
          'method.response.header.X-Request-ID': true,
          'method.response.header.X-API-Version': true,
        },
      },
      {
        statusCode: '409',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.Access-Control-Expose-Headers': true,
          'method.response.header.X-Request-ID': true,
          'method.response.header.X-API-Version': true,
        },
      },
      {
        statusCode: '500',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.Access-Control-Expose-Headers': true,
          'method.response.header.X-Request-ID': true,
          'method.response.header.X-API-Version': true,
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

    // ==== VERSIONED ROUTE DEFINITIONS (v1) ====

    // Create v1 root resource
    const v1Resource = this.api.root.addResource('v1');

    // Health endpoint (no auth required) - /v1/health
    const healthResource = v1Resource.addResource('health');
    healthResource.addMethod('GET', 
      new apigateway.LambdaIntegration(props.lambdaFunctions.healthCheck, lambdaIntegrationOptions),
      {
        methodResponses,
        requestValidator,
      }
    );

    // Device management routes - /v1/devices
    const devicesResource = v1Resource.addResource('devices');
    
    // POST /v1/devices/register
    const registerResource = devicesResource.addResource('register');
    registerResource.addMethod('POST',
      new apigateway.LambdaIntegration(props.lambdaFunctions.registerDevice, lambdaIntegrationOptions),
      {
        methodResponses,
        requestValidator,
        // TODO: Add Cognito authorizer
      }
    );

    // Device-specific routes - /v1/devices/{deviceId}
    const deviceResource = devicesResource.addResource('{deviceId}');
    
    // PUT /v1/devices/{deviceId}/settings
    const settingsResource = deviceResource.addResource('settings');
    settingsResource.addMethod('PUT',
      new apigateway.LambdaIntegration(props.lambdaFunctions.updateDeviceSettings, lambdaIntegrationOptions),
      {
        methodResponses,
        requestValidator,
        // TODO: Add Cognito authorizer
      }
    );

    // POST /v1/devices/{deviceId}/reset
    const resetResource = deviceResource.addResource('reset');
    resetResource.addMethod('POST',
      new apigateway.LambdaIntegration(props.lambdaFunctions.resetDevice, lambdaIntegrationOptions),
      {
        methodResponses,
        requestValidator,
        // TODO: Add Cognito authorizer
      }
    );

    // POST /v1/devices/{deviceId}/invite
    const inviteResource = deviceResource.addResource('invite');
    inviteResource.addMethod('POST',
      new apigateway.LambdaIntegration(props.lambdaFunctions.inviteUser, lambdaIntegrationOptions),
      {
        methodResponses,
        requestValidator,
        // TODO: Add Cognito authorizer
      }
    );

    // DELETE /v1/devices/{deviceId}/users/{userId}
    const deviceUsersResource = deviceResource.addResource('users');
    const deviceUserResource = deviceUsersResource.addResource('{userId}');
    deviceUserResource.addMethod('DELETE',
      new apigateway.LambdaIntegration(props.lambdaFunctions.removeUserAccess, lambdaIntegrationOptions),
      {
        methodResponses,
        requestValidator,
        // TODO: Add Cognito authorizer
      }
    );

    // User management routes - /v1/users
    const usersResource = v1Resource.addResource('users');
    
    // GET /v1/users/{userId}/devices
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

    // GET /v1/users/{userId}/invitations
    const userInvitationsResource = userResource.addResource('invitations');
    userInvitationsResource.addMethod('GET',
      new apigateway.LambdaIntegration(props.lambdaFunctions.getUserInvitations, lambdaIntegrationOptions),
      {
        methodResponses,
        requestValidator,
        // TODO: Add Cognito authorizer
      }
    );

    // Invitation management routes - /v1/invitations
    const invitationsResource = v1Resource.addResource('invitations');
    
    // POST /v1/invitations/{invitationId}/accept
    const invitationResource = invitationsResource.addResource('{invitationId}');
    const acceptResource = invitationResource.addResource('accept');
    acceptResource.addMethod('POST',
      new apigateway.LambdaIntegration(props.lambdaFunctions.acceptInvitation, lambdaIntegrationOptions),
      {
        methodResponses,
        requestValidator,
        // TODO: Add Cognito authorizer
      }
    );

    // POST /v1/invitations/{invitationId}/decline
    const declineResource = invitationResource.addResource('decline');
    declineResource.addMethod('POST',
      new apigateway.LambdaIntegration(props.lambdaFunctions.declineInvitation, lambdaIntegrationOptions),
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
        'Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,X-Requested-With,X-Correlation-ID,X-Client-Version'",
        'Access-Control-Expose-Headers': "'X-Request-ID,X-API-Version'",
        'X-Request-ID': "'$context.requestId'",
        'X-API-Version': "'1.0.0'",
      },
      templates: {
        'application/json': JSON.stringify({
          error: 'unauthorized',
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
        'Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,X-Requested-With,X-Correlation-ID,X-Client-Version'",
        'Access-Control-Expose-Headers': "'X-Request-ID,X-API-Version'",
        'X-Request-ID': "'$context.requestId'",
        'X-API-Version': "'1.0.0'",
      },
      templates: {
        'application/json': JSON.stringify({
          error: 'forbidden',
          message: 'Insufficient permissions to access this resource',
          requestId: '$context.requestId',
        }),
      },
    });

    // Bad request response
    new apigateway.GatewayResponse(this, 'BadRequestResponse', {
      restApi: this.api,
      type: apigateway.ResponseType.BAD_REQUEST_BODY,
      statusCode: '400',
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,X-Requested-With,X-Correlation-ID,X-Client-Version'",
        'Access-Control-Expose-Headers': "'X-Request-ID,X-API-Version'",
        'X-Request-ID': "'$context.requestId'",
        'X-API-Version': "'1.0.0'",
      },
      templates: {
        'application/json': JSON.stringify({
          error: 'validation_failed',
          message: 'Request validation failed',
          requestId: '$context.requestId',
        }),
      },
    });

    // Default 4XX response
    new apigateway.GatewayResponse(this, 'Default4XXResponse', {
      restApi: this.api,
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,X-Requested-With,X-Correlation-ID,X-Client-Version'",
        'Access-Control-Expose-Headers': "'X-Request-ID,X-API-Version'",
        'X-Request-ID': "'$context.requestId'",
        'X-API-Version': "'1.0.0'",
      },
    });

    // Default 5XX response
    new apigateway.GatewayResponse(this, 'Default5XXResponse', {
      restApi: this.api,
      type: apigateway.ResponseType.DEFAULT_5XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,X-Requested-With,X-Correlation-ID,X-Client-Version'",
        'Access-Control-Expose-Headers': "'X-Request-ID,X-API-Version'",
        'X-Request-ID': "'$context.requestId'",
        'X-API-Version': "'1.0.0'",
      },
    });
  }
} 