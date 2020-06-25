import cfn = require('@aws-cdk/aws-cloudformation');
import iam = require('@aws-cdk/aws-iam');
import lambda = require('@aws-cdk/aws-lambda');
import cdk = require('@aws-cdk/core');
import * as statement from 'iam-floyd';
import yaml = require('js-yaml');
import path = require('path');

/**
 * An SSM document parameter
 */
export interface DocumentParameter {
  /**
   *  Allowed values include the following: String, StringList, Boolean, Integer, MapList, and StringMap. To view examples of each type, see https://docs.aws.amazon.com/systems-manager/latest/userguide/ssm-plugins.html#top-level-properties-type
   */
  readonly type: string;

  /**
   * A description of the parameter
   */
  readonly description: string;

  /**
   * The default value of the parameter or a reference to a parameter in Parameter Store
   */
  readonly default?: any;

  /**
   * Allowed values for the parameter
   */
  readonly allowedValues?: string[];

  /**
   * The regular expression the parameter must match
   */
  readonly allowedPattern?: string;

  /**
   *  Used to display either a textfield or a textarea in the AWS console. textfield is a single-line text box. textarea is a multi-line text area
   */
  readonly displayType?: string;

  /**
   * The minimum number of items allowed
   */
  readonly minItems?: number;

  /**
   * The maximum number of items allowed
   */
  readonly maxItems?: number;

  /**
   * The minimum number of parameter characters allowed
   */
  readonly minChars?: number;

  /**
   * The maximum number of parameter characters allowed
   */
  readonly maxChars?: number;
}

/**
 * Steps include one or more actions, an optional precondition, a unique name of the action, and inputs (parameters) for those actions.
 *
 * For more information about documents, including information about creating documents and the differences between schema versions, see https://docs.aws.amazon.com/systems-manager/latest/userguide/ssm-plugins.html
 */
export interface DocumentMainStep {
  [key: string]: any;
}

/**
 * The content of the SSM document. The syntax of your document is defined by the schema version used to create it.
 *
 * This module only supports schema version 2.2
 *
 * For details see https://docs.aws.amazon.com/systems-manager/latest/userguide/sysman-doc-syntax.html
 */
export interface DocumentContent {
  /**
   * The schema version to use. Currently only version 2.2 is supported
   */
  readonly schemaVersion: string;

  /**
   * Information you provide to describe the purpose of the document
   */
  readonly description?: string;

  /**
   * An object that can include multiple steps (plugins). Steps include one or more actions, an optional precondition, a unique name of the action, and inputs (parameters) for those actions.
   *
   * For more information about documents, including information about creating documents and the differences between schema versions, see https://docs.aws.amazon.com/systems-manager/latest/userguide/ssm-plugins.html
   */
  readonly mainSteps: DocumentMainStep[];

  /**
   * The parameters the document accepts
   */
  readonly parameters?: {
    [key: string]: DocumentParameter;
  };
}

/**
 * Definition of the SSM document
 */
export interface DocumentProps extends cdk.StackProps {
  /**
   * Defines if the default version should be updated to the latest version on document updates
   *
   * @default true
   */
  readonly updateDefaultVersion?: boolean;

  /**
   * Name of the document
   *
   * The name must be between 3 and 128 characters. Valid characters are a-z, A-Z, 0-9, and _, -, and . only
   */
  readonly name: string;

  /**
   * Document type based on the service that you want to use
   *
   * @default Command
   */
  readonly documentType?: string;

  /**
   * Types of resources the document can run on. For example, `/AWS::EC2::Instance` or `/` for all resource types
   *
   * @default /
   */
  readonly targetType?: string;

  /**
   * Content of the SSM document. Can be passed as string or as object
   */
  readonly content: string | DocumentContent;
}

const resourceType = 'Custom::SSM-Document';
const ID = `CFN::Resource::${resourceType}`;
const cleanID = ID.replace(/:+/g, '-');
const lambdaTimeout = 3; // minutes

/**
 * An SSM document
 */
export class Document extends cdk.Construct implements cdk.ITaggable {
  /**
   * Name of the document
   */
  public readonly name: string = '';

  /**
   * Resource tags
   */
  public readonly tags: cdk.TagManager;

  /**
   * Defines a new SSM document
   */
  constructor(scope: cdk.Construct, id: string, props: DocumentProps) {
    super(scope, id);

    this.tags = new cdk.TagManager(cdk.TagType.MAP, 'Custom::SSM-Document');
    this.tags.setTag('CreatedBy', ID);

    const stack = cdk.Stack.of(this).stackName;
    const fn = this.ensureLambda();
    const name = this.fixDocumentName(props.name);

    if (name.length < 3 || name.length > 128) {
      this.node.addError(
        `SSM Document name ${name} is invalid. The name must be between 3 and 128 characters.`
      );
      return;
    }

    let content = props.content;

    if (typeof content === 'string') {
      content = yaml.safeLoad(content) as DocumentContent;
    }

    const document = new cfn.CustomResource(this, `SSM-Document-${name}`, {
      provider: cfn.CustomResourceProvider.fromLambda(fn),
      resourceType: resourceType,
      properties: {
        updateDefaultVersion: props.updateDefaultVersion || true,
        name: name,
        content: content,
        documentType: props.documentType || 'Command',
        targetType: props.targetType || '/',
        StackName: stack,
        tags: cdk.Lazy.anyValue({
          produce: () => this.tags.renderTags(),
        }),
      },
    });

    this.name = document.getAttString('Name');
  }

  private ensureLambda(): lambda.Function {
    const stack = cdk.Stack.of(this);
    const constructName = 'SSM-Document-Manager-Lambda';
    const existing = stack.node.tryFindChild(constructName);
    if (existing) {
      return existing as lambda.Function;
    }

    const policy = new iam.ManagedPolicy(stack, 'SSM-Document-Manager-Policy', {
      managedPolicyName: `${stack.stackName}-${cleanID}`,
      description: `Used by Lambda ${cleanID}, which is a custom CFN resource, managing SSM documents`,
      statements: [
        new statement.Ssm().allow().listDocuments().listTagsForResource(),
        new statement.Ssm()
          .allow()
          .createDocument()
          .addTagsToResource()
          .ifRequestTag('CreatedBy', ID),
        new statement.Ssm()
          .allow()
          .deleteDocument()
          .describeDocument()
          .getDocument()
          .listDocumentVersions()
          .modifyDocumentPermission()
          .updateDocument()
          .updateDocumentDefaultVersion()
          .addTagsToResource()
          .removeTagsFromResource()
          .ifResourceTag('CreatedBy', ID),
      ],
    });

    const role = new iam.Role(stack, 'SSM-Document-Manager-Role', {
      roleName: `${stack.stackName}-${cleanID}`,
      description: `Used by Lambda ${cleanID}, which is a custom CFN resource, managing SSM documents`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        policy,
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole'
        ),
      ],
    });

    const fn = new lambda.Function(stack, constructName, {
      functionName: `${stack.stackName}-${cleanID}`,
      role: role,
      description: 'Custom CFN resource: Manage SSM Documents',
      runtime: lambda.Runtime.NODEJS_10_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/code.zip')),
      timeout: cdk.Duration.minutes(lambdaTimeout),
    });

    return fn;
  }

  private fixDocumentName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_.-]+/g, '-');
  }
}
