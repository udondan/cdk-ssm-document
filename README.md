# CDK SSM Document

[![Source](https://img.shields.io/badge/Source-GitHub-blue?logo=github)][source]
[![Test](https://github.com/udondan/cdk-ssm-document/workflows/Test/badge.svg)](https://github.com/udondan/cdk-ssm-document/actions?query=workflow%3ATest)
[![GitHub](https://img.shields.io/github/license/udondan/cdk-ssm-document)][license]
[![Docs](https://img.shields.io/badge/Construct%20Hub-cdk--ssm--document-orange)][docs]

[![npm package](https://img.shields.io/npm/v/cdk-ssm-document?color=brightgreen)][npm]
[![PyPI package](https://img.shields.io/pypi/v/cdk-ssm-document?color=brightgreen)][PyPI]

![Downloads](https://img.shields.io/badge/-DOWNLOADS:-brightgreen?color=gray)
[![npm](https://img.shields.io/npm/dt/cdk-ssm-document?label=npm&color=blueviolet)][npm]
[![PyPI](https://img.shields.io/pypi/dm/cdk-ssm-document?label=pypi&color=blueviolet)][PyPI]

[AWS CDK] L3 construct for managing SSM Documents.

CloudFormation's support for SSM Documents [currently is lacking updating functionality](https://github.com/aws-cloudformation/aws-cloudformation-coverage-roadmap/issues/339). Instead of updating a document, CFN will replace it. The old document is destroyed and a new one is created with a different name. This is problematic because:

- When names potentially change, you cannot directly reference a document
- Old versions are permanently lost

This construct provides document support in a way you'd expect it:

- Changes on documents will cerate new versions
- Versions cannot be deleted

## Installation

This package has peer dependencies, which need to be installed along in the expected version.

For TypeScript/NodeJS, add these to your `dependencies` in `package.json`. For Python, add these to your `requirements.txt`:

- cdk-ssm-document
- aws-cdk-lib (^2.0.0)
- constructs (^10.0.0)

## CDK compatibility

- Version 3.x is compatible with the CDK v2.
- Version 2.x is compatible with the CDK v1. There won't be regular updates for this.

## Usage

### Creating a document from a YAML or JSON file

```typescript
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Document } from 'cdk-ssm-document';
import fs = require('fs');
import path = require('path');

export class TestStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
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
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Document } from 'cdk-ssm-document';
import fs = require('fs');
import path = require('path');

export class TestStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
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
              runCommand: ['echo "{{text}}"'],
            },
            precondition: {
              StringEquals: ['platformType', 'Linux'],
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
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
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

### Creating a distributor package

```typescript
import { aws_iam, aws_s3, aws_s3_deployment, Stack, StackProps } from 'aws-cdk-lib';
import { Document } from 'cdk-ssm-document';
import { Construct } from 'constructs';
import fs = require('fs');
import path = require('path');

export class TestStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const bucketName = `${Stack.of(this).account}-cdk-ssm-document-storage`;
    const bucket = new aws_s3.Bucket(this, 'DistributorPackages', {
      bucketName: bucketName,
    });
    const packageDeploy = new aws_s3_deployment.BucketDeployment(
      this,
      'distribution-packages',
      {
        sources: [aws_s3_deployment.Source.asset('../location/to/distributor/packages')],
        destinationBucket: bucket,
      }
    );

    const file = path.join(
      __dirname,
      '../location/to/distributor/packages/v1/manifest.json'
    );
    const doc = new Document(this, `SSM-Distribution-Package`, {
      documentType: 'Package',
      name: 'Test-Distribution-Package',
      content: fs.readFileSync(file).toString(),
      versionName: '1.0-Custom-Name',
      attachments: [{ key: 'SourceUrl', values: [`s3://${bucketName}/v1`] }],
    });

    /**
     * The owner/creator of the document must have read access to the
     * s3 files that make up a distribution. Since that is the lambda in this
     * case we must give it `GetObject` permissions before they will can become `Active`.
     *
     * If access is not granted to the role that created the document you may see
     * an error like the following :
     *
     * ```
     * Permanent download error: Source URL 's3://cdk-ssm-document-storage/v1/package.zip' reported:
     * Access Denied (Service: Amazon S3; Status Code: 403;
     * Error Code: AccessDenied; Request  *ID:DES1XEHZTJ9R; S3 Extended Request ID:
     * A+u8sTGQ6bZpAwl2eXDLq4KTkoeYyQR2XEV+I=; Proxy: null)
     * ```
     */
    doc.lambda.role?.addToPrincipalPolicy(
      new aws_iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [`${bucket.arnForObjects('*')}`],
      })
    );
    doc.node.addDependency(packageDeploy);
  }
}

```

## Deploying many documents in a single stack

When you want to create multiple documents in the same stack, you will quickly exceed the SSM API rate limit. One ugly but working solution for this is to ensure that only a single document is created/updated at a time by adding resource dependencies. When document C depends on document B and B depends on document A, the documents will be created/updated in that order.

```typescript
const docA = new Document(this, 'doc-A', {...})
const docB = new Document(this, 'doc-B', {...})
const docC = new Document(this, 'doc-C', {...})

docC.node.addDependency(docB);
docB.node.addDependency(docA);
```

When looping through a directory of documents it could look like this:

```typescript
var last: Document | undefined = undefined;
for (const i in files) {
  const doc = new Document(this, `SSM-Document-${shortName}`, {...});
  if (typeof last !== 'undefined') {
    last.node.addDependency(doc);
  }
  last = doc;
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
                   aws:RequestTag/CreatedByCfnCustomResource: CFN::Resource::Custom::SSM-Document
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
                   aws:ResourceTag/CreatedByCfnCustomResource: CFN::Resource::Custom::SSM-Document

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
           CreatedByCfnCustomResource: CFN::Resource::Custom::SSM-Document # required, see above policy conditions
   ```

   [AWS CDK]: https://aws.amazon.com/cdk/
   [custom resource]: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/template-custom-resources.html
   [npm]: https://www.npmjs.com/package/cdk-ssm-document
   [PyPI]: https://pypi.org/project/cdk-ssm-document/
   [docs]: https://constructs.dev/packages/cdk-ssm-document
   [source]: https://github.com/udondan/cdk-ssm-document
   [license]: https://github.com/udondan/cdk-ssm-document/blob/master/LICENSE
