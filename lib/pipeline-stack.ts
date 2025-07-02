import * as cdk from 'aws-cdk-lib';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipelineActions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { PipelineStackProps } from './types';
import { ParameterStoreHelper } from './parameter-store-helper';

export class PipelineStack extends cdk.Stack {
  public readonly pipeline: codepipeline.Pipeline;

  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    // Add project tags to all resources in this stack
    cdk.Tags.of(this).add('Project', 'acorn-pups');
    cdk.Tags.of(this).add('Environment', props.branch === 'master' ? 'prod' : 'dev');
    cdk.Tags.of(this).add('Component', 'pipeline');

    // S3 Bucket for pipeline artifacts
    const artifactsBucket = new s3.Bucket(this, 'PipelineArtifacts', {
      bucketName: `acorn-pups-pipeline-artifacts-${this.account}-${this.region}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // CodeBuild project for building and deploying
    const buildProject = new codebuild.Project(this, 'BuildProject', {
      projectName: 'acorn-pups-api-build',
      description: 'Build and deploy Acorn Pups API infrastructure',
      source: codebuild.Source.gitHub({
        owner: 'your-github-username', // TODO: Update with actual GitHub username
        repo: props.repositoryName,
        branchOrRef: props.branch,
        webhookFilters: [
          codebuild.FilterGroup.inEventOf(codebuild.EventAction.PUSH).andBranchIs(props.branch),
        ],
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.SMALL,
        privileged: false,
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': {
              nodejs: '22',
            },
            commands: [
              'echo Installing dependencies...',
              'npm ci',
              'npm install -g aws-cdk',
            ],
          },
          pre_build: {
            commands: [
              'echo Pre-build phase...',
              'npm run build',
              'npm run test',
            ],
          },
          build: {
            commands: [
              'echo Build phase...',
              'echo "Branch: $CODEBUILD_WEBHOOK_HEAD_REF"',
              // Determine environment based on branch
              'if [ "$CODEBUILD_WEBHOOK_HEAD_REF" = "refs/heads/master" ]; then ENV=prod; else ENV=dev; fi',
              'echo "Deploying to environment: $ENV"',
              'npm run synth',
              'cdk deploy --all --context environment=$ENV --require-approval never',
            ],
          },
          post_build: {
            commands: [
              'echo Post-build phase...',
              'echo "Deployment completed for environment: $ENV"',
            ],
          },
        },
        artifacts: {
          files: [
            'cdk.out/**/*',
          ],
        },
        reports: {
          'test-reports': {
            files: [
              'coverage/**/*',
            ],
            'base-directory': 'coverage',
          },
        },
      }),
      cache: codebuild.Cache.local(codebuild.LocalCacheMode.SOURCE),
    });

    // IAM Role for CodeBuild to deploy CDK stacks
    const buildRole = new iam.Role(this, 'BuildRole', {
      roleName: 'acorn-pups-codebuild-role',
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'), // TODO: Reduce permissions for production
      ],
    });

    buildProject.role?.attachInlinePolicy(
      new iam.Policy(this, 'BuildPolicy', {
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
              'logs:CreateLogGroup',
              'logs:CreateLogStream',
              'logs:PutLogEvents',
            ],
            resources: ['*'],
          }),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
              's3:GetObject',
              's3:PutObject',
              's3:DeleteObject',
            ],
            resources: [artifactsBucket.arnForObjects('*')],
          }),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
              's3:ListBucket',
            ],
            resources: [artifactsBucket.bucketArn],
          }),
        ],
      })
    );

    // GitHub webhook for automatic triggering
    const sourceOutput = new codepipeline.Artifact('SourceOutput');
    const buildOutput = new codepipeline.Artifact('BuildOutput');

    // Create the pipeline
    this.pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: 'acorn-pups-api-pipeline',
      artifactBucket: artifactsBucket,
      stages: [
        {
          stageName: 'Source',
          actions: [
            new codepipelineActions.GitHubSourceAction({
              actionName: 'GitHub_Source',
              owner: 'your-github-username', // TODO: Update with actual GitHub username
              repo: props.repositoryName,
              branch: props.branch,
              oauthToken: cdk.SecretValue.secretsManager('github-token'), // TODO: Create GitHub token in Secrets Manager
              output: sourceOutput,
              trigger: codepipelineActions.GitHubTrigger.WEBHOOK,
            }),
          ],
        },
        {
          stageName: 'Build',
          actions: [
            new codepipelineActions.CodeBuildAction({
              actionName: 'Build_and_Deploy',
              project: buildProject,
              input: sourceOutput,
              outputs: [buildOutput],
              environmentVariables: {
                ENVIRONMENT: {
                  value: props.branch === 'master' ? 'prod' : 'dev',
                },
              },
            }),
          ],
        },
      ],
    });

    // Initialize Parameter Store helper
    const parameterHelper = new ParameterStoreHelper(this, {
      environment: props.branch === 'master' ? 'prod' : 'dev',
      stackName: 'pipeline',
    });

    // Create outputs with corresponding Parameter Store parameters
    parameterHelper.createMultipleOutputsWithParameters([
      {
        outputId: 'PipelineName',
        value: this.pipeline.pipelineName,
        description: 'CodePipeline name',
        exportName: 'acorn-pups-pipeline-name',
      },
      {
        outputId: 'PipelineArn',
        value: this.pipeline.pipelineArn,
        description: 'CodePipeline ARN',
        exportName: 'acorn-pups-pipeline-arn',
      },
      {
        outputId: 'BuildProjectName',
        value: buildProject.projectName,
        description: 'CodeBuild project name',
        exportName: 'acorn-pups-build-project-name',
      },
      {
        outputId: 'BuildProjectArn',
        value: buildProject.projectArn,
        description: 'CodeBuild project ARN',
        exportName: 'acorn-pups-build-project-arn',
      },
      {
        outputId: 'ArtifactsBucketName',
        value: artifactsBucket.bucketName,
        description: 'S3 bucket for pipeline artifacts',
        exportName: 'acorn-pups-artifacts-bucket-name',
      },
      {
        outputId: 'ArtifactsBucketArn',
        value: artifactsBucket.bucketArn,
        description: 'S3 bucket ARN for pipeline artifacts',
        exportName: 'acorn-pups-artifacts-bucket-arn',
      },
    ]);
  }
} 