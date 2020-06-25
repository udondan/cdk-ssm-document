import * as cdk from '@aws-cdk/core';
import fs = require('fs');
import path = require('path');

import { Document } from '../../lib';

export class TestStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    let file = path.join(__dirname, '../documents/hello-world-yaml.yml');
    new Document(this, 'SSM-Document-HelloWorld-Yaml', {
      name: 'HelloWorld-from-yaml-file',
      content: fs.readFileSync(file).toString(),
    });

    file = path.join(__dirname, '../documents/hello-world-json.json');
    new Document(this, 'SSM-Document-HelloWorld-Json', {
      name: 'HelloWorld-from-json-file',
      content: fs.readFileSync(file).toString(),
    });

    new Document(this, 'SSM-Document-HelloWorld-Inline', {
      name: 'HelloWorld-from-inline',
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

    const dir = path.join(__dirname, '../documents');
    const files = fs.readdirSync(dir);

    for (const i in files) {
      const name = files[i];
      const shortName = name.split('.').slice(0, -1).join('.'); // removes file extension
      const file = `${dir}/${name}`;

      new Document(this, `SSM-Document-Loop-${shortName}`, {
        name: shortName,
        content: fs.readFileSync(file).toString(),
      });
    }
  }
}
