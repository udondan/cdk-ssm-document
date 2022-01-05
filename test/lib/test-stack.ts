import * as cdk from 'aws-cdk-lib';
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
