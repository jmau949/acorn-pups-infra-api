import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

export interface IoTPolicyCleanupProps {
  policyName: string;
  environment: string;
}

export class IoTPolicyCleanup extends Construct {
  constructor(scope: Construct, id: string, props: IoTPolicyCleanupProps) {
    super(scope, id);

    // Lambda function to handle certificate cleanup
    const cleanupFunction = new lambda.Function(this, 'CleanupFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      timeout: cdk.Duration.minutes(5),
      code: lambda.Code.fromInline(`
        const { IoTClient, ListTargetsForPolicyCommand, DetachPolicyCommand, UpdateCertificateCommand, DeleteCertificateCommand } = require('@aws-sdk/client-iot');

        exports.handler = async (event) => {
          console.log('Event:', JSON.stringify(event, null, 2));
          
          const iot = new IoTClient({ region: process.env.AWS_REGION });
          const policyName = event.ResourceProperties.PolicyName;
          
          try {
            if (event.RequestType === 'Delete') {
              console.log(\`Cleaning up certificates attached to policy: \${policyName}\`);
              
              // List all targets (certificates) attached to the policy
              const listResponse = await iot.send(new ListTargetsForPolicyCommand({ policyName }));
              
              if (listResponse.targets && listResponse.targets.length > 0) {
                console.log(\`Found \${listResponse.targets.length} certificates attached to policy\`);
                
                for (const target of listResponse.targets) {
                  try {
                    console.log(\`Processing certificate: \${target}\`);
                    
                    // Detach policy from certificate
                    await iot.send(new DetachPolicyCommand({ 
                      policyName, 
                      target 
                    }));
                    console.log(\`Detached policy from certificate: \${target}\`);
                    
                    // Extract certificate ID from ARN
                    const certId = target.split('/').pop();
                    
                    // Set certificate to inactive
                    await iot.send(new UpdateCertificateCommand({
                      certificateId: certId,
                      newStatus: 'INACTIVE'
                    }));
                    console.log(\`Set certificate to inactive: \${certId}\`);
                    
                    // Delete certificate
                    await iot.send(new DeleteCertificateCommand({
                      certificateId: certId,
                      forceDelete: true
                    }));
                    console.log(\`Deleted certificate: \${certId}\`);
                    
                  } catch (certError) {
                    console.error(\`Error processing certificate \${target}:\`, certError);
                    // Continue with next certificate instead of failing completely
                  }
                }
              } else {
                console.log('No certificates attached to policy');
              }
            }
            
            return {
              Status: 'SUCCESS',
              PhysicalResourceId: \`iot-policy-cleanup-\${policyName}\`,
              Data: {}
            };
            
          } catch (error) {
            console.error('Error in cleanup function:', error);
            return {
              Status: 'FAILED',
              PhysicalResourceId: \`iot-policy-cleanup-\${policyName}\`,
              Reason: error.message
            };
          }
        };
      `),
      role: new iam.Role(this, 'CleanupRole', {
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        ],
        inlinePolicies: {
          IoTCleanupPolicy: new iam.PolicyDocument({
            statements: [
              new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                  'iot:ListTargetsForPolicy',
                  'iot:DetachPolicy',
                  'iot:UpdateCertificate',
                  'iot:DeleteCertificate',
                  'iot:DescribeCertificate'
                ],
                resources: ['*']
              })
            ]
          })
        }
      })
    });

    // Custom resource that triggers cleanup before stack deletion
    new cr.AwsCustomResource(this, 'PolicyCleanupResource', {
      onDelete: {
        service: 'Lambda',
        action: 'invoke',
        parameters: {
          FunctionName: cleanupFunction.functionName,
          Payload: JSON.stringify({
            RequestType: 'Delete',
            ResourceProperties: {
              PolicyName: props.policyName
            }
          })
        },
        physicalResourceId: cr.PhysicalResourceId.of(`iot-policy-cleanup-${props.policyName}`)
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['lambda:InvokeFunction'],
          resources: [cleanupFunction.functionArn]
        })
      ])
    });

    // Add tags
    cdk.Tags.of(cleanupFunction).add('Project', 'acorn-pups');
    cdk.Tags.of(cleanupFunction).add('Environment', props.environment);
    cdk.Tags.of(cleanupFunction).add('Component', 'IoT-Policy-Cleanup');
  }
} 