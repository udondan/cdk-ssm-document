"use strict";
exports.__esModule = true;
exports.handler = void 0;
var aws_cloudformation_custom_resource_1 = require("aws-cloudformation-custom-resource");
var AWS = require("aws-sdk");
var ssm = new AWS.SSM();
var logger = new aws_cloudformation_custom_resource_1.StandardLogger();
var defaultTargetType = '/';
var latestVersion; // stores the latest version on updates
var handler = function (event, context, callback) {
    new aws_cloudformation_custom_resource_1.CustomResource(context, callback)
        .onCreate(Create)
        .onUpdate(Update)
        .onDelete(Delete)
        .handle(event);
};
exports.handler = handler;
function Create(event) {
    logger.info("Attempting to create SSM document " + event.ResourceProperties.Name);
    return new Promise(function (resolve, reject) {
        ssm.createDocument({
            Name: event.ResourceProperties.Name,
            Content: JSON.stringify(event.ResourceProperties.Content),
            DocumentType: event.ResourceProperties.DocumentType,
            TargetType: event.ResourceProperties.TargetType || defaultTargetType,
            Tags: makeTags(event, event.ResourceProperties)
        }, function (err, data) {
            if (err) {
                reject(err);
                return;
            }
            event.addResponseValue('Name', event.ResourceProperties.Name);
            resolve(event);
        });
    });
}
function Update(event) {
    return new Promise(function (resolve, reject) {
        updateDocument(event)
            .then(updateDocumentAddTags)
            .then(updateDocumentRemoveTags)
            .then(updateDocumentDefaultVersion)
            .then(function (data) {
            event.addResponseValue('Name', event.ResourceProperties.Name);
            resolve(data);
        })["catch"](function (err) {
            if (['InvalidResourceId', 'InvalidDocument'].includes(err.code)) {
                logger.warn('It appears like the document has been deleted outside of this stack. Attempting to re-create');
                return resolve(Create(event));
            }
            reject(err);
        });
    });
}
function updateDocument(event) {
    logger.info("Attempting to update SSM document " + event.ResourceProperties.Name);
    return new Promise(function (resolve, reject) {
        if (JSON.stringify(event.ResourceProperties.Content) ==
            JSON.stringify(event.OldResourceProperties.Content) &&
            (event.ResourceProperties.targetType || defaultTargetType) ==
                (event.OldResourceProperties.targetType || defaultTargetType)) {
            logger.info("No changes detected on document " + event.ResourceProperties.Name + " itself");
            return resolve(event);
        }
        ssm.updateDocument({
            Name: event.ResourceProperties.Name,
            Content: JSON.stringify(event.ResourceProperties.Content),
            TargetType: event.ResourceProperties.targetType || defaultTargetType,
            DocumentVersion: '$LATEST'
        }, function (err, data) {
            if (err && err.code == 'DuplicateDocumentContent') {
                // this is expected in case of a rollback after a failed update
                logger.warn("Update failed due to " + err.code + ". Possibly rollback.");
                resolve(event);
            }
            else if (err) {
                reject(err);
            }
            else {
                latestVersion = data.DocumentDescription.LatestVersion;
                resolve(event);
            }
        });
    });
}
function updateDocumentAddTags(event) {
    logger.info("Attempting to update tags for SSM document " + event.ResourceProperties.Name);
    return new Promise(function (resolve, reject) {
        var oldTags = makeTags(event, event.OldResourceProperties);
        var newTags = makeTags(event, event.ResourceProperties);
        if (JSON.stringify(oldTags) == JSON.stringify(newTags)) {
            logger.info("No changes of tags detected for document " + event.ResourceProperties.Name + ". Not attempting any update");
            return resolve(event);
        }
        ssm.addTagsToResource({
            ResourceType: 'Document',
            ResourceId: event.ResourceProperties.Name,
            Tags: newTags
        }, function (err, data) {
            if (err)
                reject(err);
            else
                resolve(event);
        });
    });
}
function updateDocumentRemoveTags(event) {
    logger.info("Attempting to remove some tags for SSM document " + event.ResourceProperties.Name);
    return new Promise(function (resolve, reject) {
        var oldTags = makeTags(event, event.OldResourceProperties);
        var newTags = makeTags(event, event.ResourceProperties);
        var tagsToRemove = getMissingTags(oldTags, newTags);
        if (JSON.stringify(oldTags) == JSON.stringify(newTags) ||
            !tagsToRemove.length) {
            logger.info("No changes of tags detected for document " + event.ResourceProperties.Name + ". Not attempting any update");
            return resolve(event);
        }
        logger.info("Will remove the following tags: " + JSON.stringify(tagsToRemove));
        ssm.removeTagsFromResource({
            ResourceId: event.ResourceProperties.Name,
            ResourceType: 'Document',
            TagKeys: tagsToRemove
        }, function (err, data) {
            if (err)
                reject(err);
            else
                resolve(event);
        });
    });
}
function updateDocumentDefaultVersion(event) {
    logger.info("Attempting to update default version for SSM document " + event.ResourceProperties.Name);
    return new Promise(function (resolve, reject) {
        if (event.ResourceProperties.UpdateDefaultVersion.toLowerCase() !=
            'true') {
            logger.info('Updating of default version has not been requested. Not attempting to update default version');
            return resolve(event);
        }
        if (!latestVersion) {
            logger.info("No new version created. No update required for document " + event.ResourceProperties.Name);
            return resolve(event);
        }
        ssm.updateDocumentDefaultVersion({
            Name: event.ResourceProperties.Name,
            DocumentVersion: latestVersion
        }, function (err, data) {
            if (err)
                reject(err);
            else
                resolve(event);
        });
    });
}
function Delete(event) {
    logger.info("Attempting to delete SSM document " + event.ResourceProperties.Name);
    return new Promise(function (resolve, reject) {
        ssm.deleteDocument({
            Name: event.ResourceProperties.Name
        }, function (err, data) {
            if (err)
                reject(err);
            else
                resolve(event);
        });
    });
}
function makeTags(event, properties) {
    var tags = [
        {
            Key: 'aws-cloudformation:stack-id',
            Value: event.StackId
        },
        {
            Key: 'aws-cloudformation:stack-name',
            Value: properties.StackName
        },
        {
            Key: 'aws-cloudformation:logical-id',
            Value: event.LogicalResourceId
        },
    ];
    if ('Tags' in properties) {
        Object.keys(properties.Tags).forEach(function (key) {
            tags.push({
                Key: key,
                Value: properties.Tags[key]
            });
        });
    }
    return tags;
}
function getMissingTags(oldTags, newTags) {
    var missing = oldTags.filter(missingTags(newTags));
    return missing.map(function (tag) {
        return tag.Key;
    });
}
function missingTags(newTags) {
    return function (currentTag) {
        return (newTags.filter(function (newTag) {
            return newTag.Key == currentTag.Key;
        }).length == 0);
    };
}
