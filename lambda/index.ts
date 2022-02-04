import { CustomResource, Event, LambdaEvent, StandardLogger } from 'aws-cloudformation-custom-resource';
import { Callback, Context } from 'aws-lambda';
import AWS = require('aws-sdk');

interface DocumentEvent extends LambdaEvent {
  ResourceProperties: {
    Content: {
      parameters?: {
        [key: string]: {
          type: string;
          default?: any;
        };
      };
      mainSteps?: [
        {
          name: string;
          action: string;
          inputs: {
            [key: string]: any;
          };
        }
      ];
    };
  };
}

const ssm = new AWS.SSM();
const logger = new StandardLogger();

const defaultTargetType = '/';
var latestVersion: string; // stores the latest version on updates

export const handler = function (
  event: LambdaEvent = {},
  context: Context,
  callback: Callback
) {
  event = fixBooleanParameters(event as DocumentEvent);
  new CustomResource(event, context, callback, logger)
    .onCreate(Create)
    .onUpdate(Update)
    .onDelete(Delete)
    .handle(event);
};

function Create(event: Event): Promise<Event> {
  logger.info(
    `Attempting to create SSM document ${event.ResourceProperties.Name}`
  );
  return new Promise(function (resolve, reject) {
    ssm.createDocument(
      {
        Name: event.ResourceProperties.Name,
        Content: JSON.stringify(event.ResourceProperties.Content),
        DocumentType: event.ResourceProperties.DocumentType,
        TargetType: event.ResourceProperties.TargetType || defaultTargetType,
        Tags: makeTags(event, event.ResourceProperties),
        Attachments: pascalizeKeys(event.ResourceProperties.Attachments)
      },
      function (err: AWS.AWSError, data: AWS.SSM.CreateDocumentResult) {
        if (err) {
          reject(err);
          return;
        }
        event.addResponseValue('Name', event.ResourceProperties.Name);
        resolve(event);
      }
    );
  });
}

function Update(event: Event): Promise<Event> {
  return new Promise(function (resolve, reject) {
    updateDocument(event)
      .then(updateDocumentAddTags)
      .then(updateDocumentRemoveTags)
      .then(updateDocumentDefaultVersion)
      .then(function (data) {
        event.addResponseValue('Name', event.ResourceProperties.Name);
        resolve(data);
      })
      .catch(function (err: AWS.AWSError) {
        if (['InvalidResourceId', 'InvalidDocument'].includes(err.code)) {
          logger.warn(
            'It appears like the document has been deleted outside of this stack. Attempting to re-create'
          );
          return resolve(Create(event));
        }
        reject(err);
      });
  });
}

function updateDocument(event: Event): Promise<Event> {
  logger.info(
    `Attempting to update SSM document ${event.ResourceProperties.Name}`
  );
  return new Promise(function (resolve, reject) {
    if (
      JSON.stringify(event.ResourceProperties.Content) ==
      JSON.stringify(event.OldResourceProperties.Content) &&
      JSON.stringify(event.ResourceProperties.Attachments) ==
      JSON.stringify(event.OldResourceProperties.Attachments) &&
      (event.ResourceProperties.TargetType || defaultTargetType) ==
      (event.OldResourceProperties.TargetType || defaultTargetType)
    ) {
      logger.info(
        `No changes detected on document ${event.ResourceProperties.Name} itself`
      );
      return resolve(event);
    }
    ssm.updateDocument(
      {
        Name: event.ResourceProperties.Name,
        Content: JSON.stringify(event.ResourceProperties.Content),
        TargetType: event.ResourceProperties.TargetType || defaultTargetType,
        DocumentVersion: '$LATEST',
        Attachments: pascalizeKeys(event.ResourceProperties.Attachments)
      },
      function (err: AWS.AWSError, data: AWS.SSM.UpdateDocumentResult) {
        if (err && err.code == 'DuplicateDocumentContent') {
          // this is expected in case of a rollback after a failed update
          logger.warn(`Update failed due to ${err.code}. Possibly rollback.`);
          resolve(event);
        } else if (err) {
          reject(err);
        } else {
          latestVersion = data.DocumentDescription!.LatestVersion!;
          resolve(event);
        }
      }
    );
  });
}

function updateDocumentAddTags(event: Event): Promise<Event> {
  logger.info(
    `Attempting to update tags for SSM document ${event.ResourceProperties.Name}`
  );
  return new Promise(function (resolve, reject) {
    const oldTags = makeTags(event, event.OldResourceProperties);
    const newTags = makeTags(event, event.ResourceProperties);
    if (JSON.stringify(oldTags) == JSON.stringify(newTags)) {
      logger.info(
        `No changes of tags detected for document ${event.ResourceProperties.Name}. Not attempting any update`
      );
      return resolve(event);
    }

    ssm.addTagsToResource(
      {
        ResourceType: 'Document',
        ResourceId: event.ResourceProperties.Name,
        Tags: newTags,
      },
      function (err: AWS.AWSError, data: AWS.SSM.AddTagsToResourceResult) {
        if (err) reject(err);
        else resolve(event);
      }
    );
  });
}

const pascalizeKeys = (obj): any => {
  const isObject = o => Object.prototype.toString.apply(o) === '[object Object]'
  const isArray = o => Object.prototype.toString.apply(o) === '[object Array]'

  let transformedObj = isArray(obj) ? [] : {}

  for (let key in obj) {
    // replace the following with any transform function
    const transformedKey = toPascalCase(key)

    if (isObject(obj[key]) || isArray(obj[key])) {
      transformedObj[transformedKey] = pascalizeKeys(obj[key])
    } else {
      transformedObj[transformedKey] = obj[key]
    }
  }
  return transformedObj
}

function toPascalCase(string) {
  return `${string}`
    .replace(new RegExp(/[-_]+/, 'g'), ' ')
    .replace(new RegExp(/[^\w\s]/, 'g'), '')
    .replace(
      new RegExp(/\s+(.)(\w*)/, 'g'),
      ($1, $2, $3) => `${$2.toUpperCase() + $3.toLowerCase()}`
    )
    .replace(new RegExp(/\w/), s => s.toUpperCase());
}

function updateDocumentRemoveTags(event: Event): Promise<Event> {
  logger.info(
    `Attempting to remove some tags for SSM document ${event.ResourceProperties.Name}`
  );
  return new Promise(function (resolve, reject) {
    const oldTags = makeTags(event, event.OldResourceProperties);
    const newTags = makeTags(event, event.ResourceProperties);
    const tagsToRemove = getMissingTags(oldTags, newTags);
    if (
      JSON.stringify(oldTags) == JSON.stringify(newTags) ||
      !tagsToRemove.length
    ) {
      logger.info(
        `No changes of tags detected for document ${event.ResourceProperties.Name}. Not attempting any update`
      );
      return resolve(event);
    }

    logger.info(
      `Will remove the following tags: ${JSON.stringify(tagsToRemove)}`
    );
    ssm.removeTagsFromResource(
      {
        ResourceId: event.ResourceProperties.Name,
        ResourceType: 'Document',
        TagKeys: tagsToRemove,
      },
      function (err: AWS.AWSError, data: AWS.SSM.RemoveTagsFromResourceResult) {
        if (err) reject(err);
        else resolve(event);
      }
    );
  });
}

function updateDocumentDefaultVersion(event: Event): Promise<Event> {
  logger.info(
    `Attempting to update default version for SSM document ${event.ResourceProperties.Name}`
  );
  return new Promise(function (resolve, reject) {
    if (
      (event.ResourceProperties.UpdateDefaultVersion as string).toLowerCase() !=
      'true'
    ) {
      logger.info(
        'Updating of default version has not been requested. Not attempting to update default version'
      );
      return resolve(event);
    }

    if (!latestVersion) {
      logger.info(
        `No new version created. No update required for document ${event.ResourceProperties.Name}`
      );
      return resolve(event);
    }

    ssm.updateDocumentDefaultVersion(
      {
        Name: event.ResourceProperties.Name,
        DocumentVersion: latestVersion!,
      },
      function (
        err: AWS.AWSError,
        data: AWS.SSM.UpdateDocumentDefaultVersionResult
      ) {
        if (err) reject(err);
        else resolve(event);
      }
    );
  });
}

function Delete(event: any): Promise<Event> {
  logger.info(
    `Attempting to delete SSM document ${event.ResourceProperties.Name}`
  );
  return new Promise(function (resolve, reject) {
    ssm.deleteDocument(
      {
        Name: event.ResourceProperties.Name,
      },
      function (err: AWS.AWSError, data: AWS.SSM.DeleteDocumentResult) {
        if (err) reject(err);
        else resolve(event);
      }
    );
  });
}

function makeTags(event: Event, properties: any): AWS.SSM.TagList {
  const tags: AWS.SSM.TagList = [
    {
      Key: 'aws-cloudformation:stack-id',
      Value: event.StackId,
    },
    {
      Key: 'aws-cloudformation:stack-name',
      Value: properties.StackName,
    },
    {
      Key: 'aws-cloudformation:logical-id',
      Value: event.LogicalResourceId,
    },
  ];
  if ('Tags' in properties) {
    Object.keys(properties.Tags).forEach(function (key: string) {
      tags.push({
        Key: key,
        Value: properties.Tags[key],
      });
    });
  }
  return tags;
}

function getMissingTags(
  oldTags: AWS.SSM.TagList,
  newTags: AWS.SSM.TagList
): string[] {
  var missing = oldTags.filter(missingTags(newTags));
  return missing.map(function (tag: AWS.SSM.Tag) {
    return tag.Key;
  });
}

function missingTags(newTags: AWS.SSM.TagList) {
  return (currentTag: AWS.SSM.Tag) => {
    return (
      newTags.filter((newTag: any) => {
        return newTag.Key == currentTag.Key;
      }).length == 0
    );
  };
}

/**
 * Loops through all parameters and converts default values to booleans, if the param type is of type Boolean
 * This is required, because somehow AWS or CDK converts booleans to strings in JSON payload, when calling custom resources
 * @param event DocumentEvent
 * @returns DocumentEvent
 */
function fixBooleanParameters(event: DocumentEvent) {
  // fixing Boolean input parameters
  if (typeof event.ResourceProperties.Content.parameters == 'object') {
    for (let [key, param] of Object.entries(
      event.ResourceProperties.Content.parameters
    )) {
      if (param.type == 'Boolean' && 'default' in param) {
        event.ResourceProperties.Content.parameters[key].default =
          param.default == 'true';
      }
    }
  }

  // fixing BooleanEquals in aws:branch https://docs.aws.amazon.com/systems-manager/latest/userguide/automation-action-branch.html
  if (Array.isArray(event.ResourceProperties.Content.mainSteps)) {
    event.ResourceProperties.Content.mainSteps.forEach((step, i) => {
      if (
        step.action == 'aws:branch' &&
        'Choices' in step.inputs &&
        Array.isArray(step.inputs.Choices)
      ) {
        step.inputs.Choices.forEach((choice, j) => {
          if ('BooleanEquals' in choice) {
            event.ResourceProperties.Content.mainSteps[i].inputs.Choices[
              j
            ].BooleanEquals = choice.BooleanEquals == 'true';
          }
        });
      }
    });
  }

  return event;
}
