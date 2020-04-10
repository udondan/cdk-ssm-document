# CDK SSM Document

[![Source](https://img.shields.io/badge/Source-GitHub-blue)][source]
[![Docs](https://img.shields.io/badge/Docs-awscdk.io-orange)][docs]
[![npm version](https://badge.fury.io/js/cdk-ssm-document.svg)][npm]
[![PyPI version](https://badge.fury.io/py/cdk-ssm-document.svg)][PyPI]
[![NuGet version](https://badge.fury.io/nu/CDK.SSM.Document.svg)][NuGet]
[![GitHub](https://img.shields.io/github/license/udondan/cdk-ssm-document)][license]

[AWS CDK] L3 construct for managing SSM Documents.

CloudFormation's support for SSM Documents [currently is lacking updating functionality](https://github.com/aws-cloudformation/aws-cloudformation-coverage-roadmap/issues/339). Instead of updating a document, CFN will replace it. The old document is destroyed and a new one is created with a different name. This is problematic because:

- When names potentially change, you cannot directly reference a document
- Old versions are permanently lost

This construct provides document support in a way you'd expect it:

- Changes on documents will cerate new versions
- Versions cannot be deleted

## Usage

### Creating a document from a YAML or JSON file

```typescript
import cdk = require('@aws-cdk/core');
import { Document } from 'cdk-ssm-document';
import fs = require('fs');
import path = require('path');

export class TestStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props: cdk.StackProps) {
        super(scope, id, props);

        const file = path.join(__dirname, '../documents/hello-world.yml');
        new Document(this, 'SSM-Document-HelloWorld', {
            name: 'HelloWorld',
            content: fs.readFileSync(file).toString(),
        });
    }
}
```

### Creating a document via inline definition

```typescript
import cdk = require('@aws-cdk/core');
import { Document } from 'cdk-ssm-document';
import fs = require('fs');
import path = require('path');

export class TestStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props: cdk.StackProps) {
        super(scope, id, props);

        new Document(this, 'SSM-Document-HelloWorld', {
            name: 'HelloWorld',
            content: {
                schemaVersion: '2.2',
                description: 'Echo Hello World!',
                parameters: {
                    text: {
                        default: 'Hello World!',
                        description: 'Text to echo',
                        type: 'String',
                    },
                },
                mainSteps: [
                    {
                        name: 'echo',
                        action: 'aws:runShellScript',
                        inputs: {
                            runCommand: [
                                'echo "{{text}}"',
                            ],
                        },
                        precondition: {
                            StringEquals: [
                                'platformType',
                                'Linux',
                            ],
                        },
                    },
                ],
            },
        });
    }
}
```

### Deploy all YAML/JSON files from a directory

```typescript
import cdk = require('@aws-cdk/core');
import { Document } from 'cdk-ssm-document';
import fs = require('fs');
import path = require('path');

export class TestStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props: cdk.StackProps) {
        super(scope, id, props);

        const dir = path.join(__dirname, '../documents');
        const files = fs.readdirSync(dir);

        for (const i in files) {
            const name = files[i];
            const shortName = name.split('.').slice(0, -1).join('.'); // removes file extension
            const file = `${dir}/${name}`;

            new Document(this, `SSM-Document-${shortName}`, {
                name: shortName,
                content: fs.readFileSync(file).toString(),
            });
        }
    }
}
```

## Using the Lambda as a custom resource in CloudFormation - without CDK

If you're still not convinced to use the [AWS CDK], you can still use the Lambda as a [custom resource] in your CFN template. Here is how:

1. **Create a zip file for the Lambda:**

   To create a zip from the Lambda source run:

   ```bash
   lambda/build
   ```

   This will generate the file `lambda/code.zip`.

1. **Upload the Lambda function:**

   Upload this zip file to an S3 bucket via cli, Console or however you like.

   Example via cli:

   ```bash
   aws s3 cp lambda/code.zip s3://example-bucket/code.zip
   ```

1. **Deploy a CloudFormation stack utilizing the zip as a custom resource provider:**

   Example CloudFormation template:

   ```yaml
   ---
   AWSTemplateFormatVersion: "2010-09-09"
   Resources:
     SSMDocExecutionRole:
       Type: AWS::IAM::Role
       Properties:
         RoleName: CFN-Resource-Custom-SSM-Document
         AssumeRolePolicyDocument:
           Version: "2012-10-17"
           Statement:
             - Effect: Allow
               Principal:
                 Service: lambda.amazonaws.com
               Action: sts:AssumeRole
         ManagedPolicyArns:
           - arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
           - Ref: SSMDocExecutionPolicy

     SSMDocExecutionPolicy:
       Type: AWS::IAM::ManagedPolicy
       Properties:
         ManagedPolicyName: CFN-Resource-Custom-SSM-Document
         PolicyDocument:
           Version: "2012-10-17"
           Statement:
             - Effect: Allow
               Action:
                 - ssm:ListDocuments
                 - ssm:ListTagsForResource
               Resource: "*"
             - Effect: Allow
               Action:
                 - ssm:CreateDocument
                 - ssm:AddTagsToResource
               Resource: "*"
               Condition:
                 StringEquals:
                   aws:RequestTag/CreatedBy: CFN::Resource::Custom::SSM-Document
             - Effect: Allow
               Action:
                 - ssm:DeleteDocument
                 - ssm:DescribeDocument
                 - ssm:GetDocument
                 - ssm:ListDocumentVersions
                 - ssm:ModifyDocumentPermission
                 - ssm:UpdateDocument
                 - ssm:UpdateDocumentDefaultVersion
                 - ssm:AddTagsToResource
                 - ssm:RemoveTagsFromResource
               Resource: "*"
               Condition:
                 StringEquals:
                   aws:ResourceTag/CreatedBy: CFN::Resource::Custom::SSM-Document

     SSMDocFunction:
       Type: AWS::Lambda::Function
       Properties:
         FunctionName: CFN-Resource-Custom-SSM-Document-Manager
         Code:
           S3Bucket: example-bucket
           S3Key: code.zip
         Handler: index.handler
         Runtime: nodejs10.x
         Timeout: 3
         Role: !GetAtt SSMDocExecutionRole.Arn

     MyDocument:
       Type: Custom::SSM-Document
       Properties:
         Name: MyDocument
         ServiceToken: !GetAtt SSMDocFunction.Arn
         StackName: !Ref AWS::StackName
         UpdateDefaultVersion: true # default: true
         Content:
           schemaVersion: "2.2"
           description: Echo Hello World!
           parameters:
             text:
               type: String
               description: Text to echo
               default: Hello World!
           mainSteps:
             - name: echo
               action: aws:runShellScript
               inputs:
                 runCommand:
                   - echo "{{text}}"
               precondition:
                 StringEquals:
                   - platformType
                   - Linux
         DocumentType: Command # default: Command
         TargetType: / # default: /
         Tags:
           CreatedBy: CFN::Resource::Custom::SSM-Document # required, see above policy conditions
   ```

## Roadmap

- Tagging support in a more standard way

   [AWS CDK]: https://aws.amazon.com/cdk/
   [custom resource]: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/template-custom-resources.html
   [npm]: https://www.npmjs.com/package/cdk-ssm-document
   [PyPI]: https://pypi.org/project/cdk-ssm-document/
   [NuGet]: https://www.nuget.org/packages/CDK.SSM.Document/
   [docs]: https://awscdk.io/packages/cdk-ssm-document@1.0.1
   [source]: https://github.com/udondan/cdk-ssm-document
   [license]: https://github.com/udondan/cdk-ssm-document/blob/master/LICENSE
