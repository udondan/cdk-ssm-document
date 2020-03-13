import cfn = require('@aws-cdk/aws-cloudformation');
import iam = require('@aws-cdk/aws-iam');
import lambda = require('@aws-cdk/aws-lambda');
import cdk = require('@aws-cdk/core');
import yaml = require('js-yaml');
import path = require('path');

export interface DocumentProps extends cdk.StackProps {
    readonly updateDefaultVersion?: boolean;
    readonly name: string;
    readonly documentType?: string;
    readonly targetType?: string;
    readonly content: any;
}

const resourceType = 'Custom::SSM-Document';
const ID = `CFN::Resource::${resourceType}`;
const cleanID = ID.replace(/:+/g, '-');
const lambdaTimeout = 3; // minutes

export class Document extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: DocumentProps) {
        super(scope, id);

        const stack = cdk.Stack.of(this).stackName;
        const fn = this.ensureLambda();
        const name = this.fixDocumentName(props.name);

        if (name.length < 3 || name.length > 128) {
            throw Error(`SSM Document name ${name} is invalid. The name must be between 3 and 128 characters.`);
        }

        let content = props.content;
        if (typeof content !== 'string') {
            content = yaml.safeLoad(content.toString());
        }

        const tags = props.tags || {};
        tags.CreatedBy = ID;

        new cfn.CustomResource(this, `SSM-Document-${name}`, {
            provider: cfn.CustomResourceProvider.fromLambda(fn),
            resourceType: resourceType,
            properties: {
                updateDefaultVersion: props.updateDefaultVersion || true,
                name: name,
                content: content,
                documentType: props.documentType || 'Command',
                targetType: props.targetType || '/',
                StackName: stack,
                tags: tags,
            }
        });
    }

    private ensureLambda(): lambda.Function {
        const stack = cdk.Stack.of(this);
        const constructName = 'SSM-Document-Manager-Lambda';
        const existing = stack.node.tryFindChild(constructName);
        if (existing) {
            return existing as lambda.Function;
        }

        const policy = new iam.ManagedPolicy(this, 'SSM-Document-Manager-Policy', {
            managedPolicyName: `${stack.stackName}-${cleanID}`,
            description: `Used by Lambda ${cleanID}, which is a custom CFN resource, managing SSM documents`,
            statements: [
                new iam.PolicyStatement({
                    actions: [
                        'ssm:ListDocuments',
                        'ssm:ListTagsForResource',
                    ],
                    resources: ['*'],
                }),
                new iam.PolicyStatement({
                    actions: [
                        'ssm:CreateDocument',
                        'ssm:AddTagsToResource',
                    ],
                    resources: ['*'],
                    conditions: {
                        StringEquals: {
                            'aws:RequestTag/CreatedBy': ID,
                        }
                    },
                }),
                new iam.PolicyStatement({
                    actions: [
                        'ssm:DeleteDocument',
                        'ssm:DescribeDocument',
                        'ssm:GetDocument',
                        'ssm:ListDocumentVersions',
                        'ssm:ModifyDocumentPermission',
                        'ssm:UpdateDocument',
                        'ssm:UpdateDocumentDefaultVersion',
                        'ssm:AddTagsToResource',
                        'ssm:RemoveTagsFromResource',
                    ],
                    resources: ['*'],
                    conditions: {
                        StringEquals: {
                            'aws:ResourceTag/CreatedBy': ID,
                        }
                    },
                }),
            ],
        });

        const role = new iam.Role(this, 'SSM-Document-Manager-Role', {
            roleName: `${stack.stackName}-${cleanID}`,
            description: `Used by Lambda ${cleanID}, which is a custom CFN resource, managing SSM documents`,
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                policy,
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
            ]
        });

        const fn = new lambda.Function(this, constructName, {
            functionName: `${stack.stackName}-${cleanID}`,
            role: role,
            description: 'Custom CFN resource: Manage SSM Documents',
            runtime: lambda.Runtime.NODEJS_10_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/code.zip')),
            timeout: cdk.Duration.minutes(lambdaTimeout)
        });

        return fn;
    }

    private fixDocumentName(name: string): string {
        return name.replace(/[^a-zA-Z0-9_.-]+/g, '-');
    }
}
