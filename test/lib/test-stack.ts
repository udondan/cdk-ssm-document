import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as statement from 'cdk-iam-floyd';
import { Construct } from 'constructs';
import fs = require('fs');
import path = require('path');

import { Document } from '../../lib';

export class TestStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    let file = path.join(
      __dirname,
      '../documents/command/hello-world-yaml.yml'
    );
    const docA = new Document(this, 'SSM-Document-HelloWorld-Yaml', {
      name: `${this.stackName}-HelloWorld-from-yaml-file`,
      content: fs.readFileSync(file).toString(),
    });

    file = path.join(__dirname, '../documents/command/hello-world-json.json');
    const docB = new Document(this, 'SSM-Document-HelloWorld-Json', {
      name: `${this.stackName}-HelloWorld-from-json-file`,
      content: fs.readFileSync(file).toString(),
    });

    file = path.join(
      __dirname,
      '../documents/automation/automation-document.yml'
    );
    const docC = new Document(this, `SSM-Document-Automation`, {
      documentType: 'Automation',
      name: 'Test-Automation',
      content: fs.readFileSync(file).toString(),
    });

    const docD = new Document(this, 'SSM-Document-HelloWorld-Inline', {
      name: `${this.stackName}-HelloWorld-from-inline`,
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

    /**
     * Distributor example.
     *
     * Requires a bucket to hold install/update/uninstall scripts.
     */
    const bucketName = `${cdk.Stack.of(this).account}-cdk-ssm-document-storage`;
    const bucket = new s3.Bucket(this, 'DistributorPackages', {
      bucketName: bucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: s3.BucketEncryption.KMS_MANAGED,
      // Makes for easy destroy and rerun of this stack over and over.
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    const packageDeploy = new s3deploy.BucketDeployment(
      this,
      'distribution-packages',
      {
        sources: [s3deploy.Source.asset('../test/documents/distributor')],
        destinationBucket: bucket,
      }
    );

    let attachments: { [key: string]: any } = {};
    // flip this condition to simulate an update
    if (true) {
      file = path.join(__dirname, '../documents/distributor/v1/manifest.json');
      attachments = {
        versionName: '1.0-Custom-Name',
        attachments: [{ key: 'SourceUrl', values: [`s3://${bucketName}/v1`] }],
      };
    } else {
      file = path.join(__dirname, '../documents/distributor/v2/manifest.json');
      attachments = {
        versionName: '2.0-Better-Than_Sliced_Bread',
        attachments: [{ key: 'SourceUrl', values: [`s3://${bucketName}/v2`] }],
      };
    }

    const docE = new Document(this, `SSM-Distribution-Package`, {
      documentType: 'Package',
      name: 'Test-Distribution-Package',
      content: fs.readFileSync(file).toString(),
      ...attachments,
    });

    /**
     * The owner/creator of the document must have read access to the
     * s3 files that make up a distribution. Since that is the lambda in this
     * case we must give it `GetObject` permissions before they will can become `Active`.
     */
    docE.lambda.role?.addToPrincipalPolicy(
      new statement.S3()
        .allow()
        .toGetObject()
        .onBucket(bucket.bucketName)
        .onObject(bucket.bucketName, '*')
    );

    docE.node.addDependency(docD);
    docE.node.addDependency(packageDeploy);
    docD.node.addDependency(docC);
    docC.node.addDependency(docB);
    docB.node.addDependency(docA);

    const dir = path.join(__dirname, '../documents/command');
    const files = fs.readdirSync(dir);

    var last: Document | undefined = undefined;
    for (const i in files) {
      const name = files[i];
      const shortName = name.split('.').slice(0, -1).join('.'); // removes file extension
      const file = `${dir}/${name}`;

      const doc = new Document(this, `SSM-Document-Loop-${shortName}`, {
        name: `${this.stackName}-${shortName}`,
        content: fs.readFileSync(file).toString(),
      });
      if (typeof last !== 'undefined') {
        last.node.addDependency(doc);
      }
      last = doc;
    }
  }
}
