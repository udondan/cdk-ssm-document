import cfn = require('@aws-cdk/aws-cloudformation');
import iam = require('@aws-cdk/aws-iam');
import lambda = require('@aws-cdk/aws-lambda');
import cdk = require('@aws-cdk/core');
import fs = require('fs');
import yaml = require('js-yaml');
import path = require('path');

export interface Props extends cdk.StackProps {
    readonly createdBy: string;
    readonly costReference: string;
}

const resourceType = 'Custom::SSM-Document';
const ID = `CFN::Resource::${resourceType}`;
const cleanID = ID.replace(/:+/g, '-');

export class Provider extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: Props) {
        super(scope, id);

        cdk.Tag.add(this, 'CreatedBy', props.createdBy);
        cdk.Tag.add(this, 'CostReference', props.costReference);
        cdk.Tag.add(this, 'Project', 'Stacks');

        const policy = new iam.ManagedPolicy(this, 'Policy', {
            managedPolicyName: cleanID,
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
            ]
        });

        const role = new iam.Role(this, 'Role', {
            roleName: cleanID,
            description: `Used by Lambda ${cleanID}, which is a custom CFN resource, managing SSM documents`,
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                policy,
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
            ]
        });

        const fn = new lambda.SingletonFunction(this, 'SSM-Document-Manager', {
            functionName: cleanID,
            uuid: ID,
            role: role,
            description: 'Custom CFN resource: Manage SSM Documents',
            runtime: lambda.Runtime.NODEJS_10_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/cfn-ssm-document')),
            timeout: cdk.Duration.minutes(10)
        });

        const dir = './ssm';
        const files = fs.readdirSync(dir);
        for (const i in files) {
            const name = files[i];
            const shortName = name.split('.').slice(0, -1).join('.');
            const file = `${dir}/${name}`;
            const fileContents = fs.readFileSync(file);

            new cfn.CustomResource(this, `SSMDoc-${shortName}`, {
                provider: cfn.CustomResourceProvider.fromLambda(fn),
                resourceType: resourceType,
                properties: {
                    updateDefaultVersion: true,
                    name: shortName,
                    content: yaml.safeLoad(fileContents.toString()),
                    documentType: 'Command',
                    targetType: '/',
                    //                    StackName: this.stackName,
                    tags: {
                        CreatedBy: ID,
                        a: 'b',
                        c: 'd',
                        e: 'f',
                        g: 'h',
                        i: 'j',
                        k: 'l',
                        YES: 'bam',
                        x: 2,
                    },
                }
            });
        }
    }
}
