import { Callback, Context } from 'aws-lambda';
import AWS = require('aws-sdk');
import https = require('https');
import URL = require('url');

const ssm = new AWS.SSM();

const defaultTargetType = '/';
var latestVersion: string; // stores the latest version on updates

interface Event {
    [key: string]: any;
}

export const handler = function (event: Event = {}, context: Context, callback: Callback) {

    if (typeof event.ResponseURL === 'undefined') {
        throw new Error('ResponseURL missing');
    }

    try {
        timeout(event, context, callback);
        console.log('REQUEST RECEIVED:\n' + JSON.stringify(event));

        event.results = [];

        let func: (event: any) => Promise<Event | AWS.AWSError>;

        if (event.RequestType == 'Create') func = Create;
        else if (event.RequestType == 'Update') func = Update;
        else if (event.RequestType == 'Delete') func = Delete;
        else return sendResponse(event, context, 'FAILED', `Unexpected request type: ${event.RequestType}`);

        func(event).then(function (response) {
            console.log(response);
            sendResponse(event, context, 'SUCCESS', `${event.RequestType} completed successfully`);
        }).catch(function (err: AWS.AWSError) {
            console.log(err, err.stack);
            sendResponse(event, context, 'FAILED', err.message || err.code);
        });
    } catch (err) {
        sendResponse(event, context, 'FAILED', (err as Error).message);
    }
};

function Create(event: Event): Promise<Event | AWS.AWSError> {
    console.log(`Attempting to create SSM document ${event.ResourceProperties.Name}`);
    return new Promise(function (resolve, reject) {
        ssm.createDocument({
            Name: event.ResourceProperties.Name,
            Content: JSON.stringify(event.ResourceProperties.Content),
            DocumentType: event.ResourceProperties.DocumentType,
            TargetType: event.ResourceProperties.TargetType || defaultTargetType,
            Tags: makeTags(event, event.ResourceProperties),
        }, function (err: AWS.AWSError, data: AWS.SSM.CreateDocumentResult) {
            event.results.push({ data: data, error: err });
            if (err) reject(err);
            else resolve(data);
        });
    });
}

function Update(event: Event): Promise<Event | AWS.AWSError> {
    return new Promise(function (resolve, reject) {
        updateDocument(event)
            .then(updateDocumentAddTags)
            .then(updateDocumentRemoveTags)
            .then(updateDocumentDefaultVersion)
            .then(function (data) {
                resolve(data);
            })
            .catch(
                function (err: AWS.AWSError) {
                    if (['InvalidResourceId', 'InvalidDocument'].includes(err.code)) {
                        console.log('It appears like the document has been deleted outside of this stack. Attempting to re-create');
                        return resolve(Create(event));
                    }
                    reject(err);
                }
            );
    });
}

function updateDocument(event: Event): Promise<Event | AWS.AWSError> {
    console.log(`Attempting to update SSM document ${event.ResourceProperties.Name}`);
    return new Promise(function (resolve, reject) {
        if (JSON.stringify(event.ResourceProperties.Content) == JSON.stringify(event.OldResourceProperties.Content) &&
            (event.ResourceProperties.targetType || defaultTargetType) == (event.OldResourceProperties.targetType || defaultTargetType)) {
            console.log(`No changes detected on document ${event.ResourceProperties.Name} itself`);
            return resolve(event);
        }
        ssm.updateDocument({
            Name: event.ResourceProperties.Name,
            Content: JSON.stringify(event.ResourceProperties.Content),
            TargetType: event.ResourceProperties.targetType || defaultTargetType,
            DocumentVersion: '$LATEST',
        }, function (err: AWS.AWSError, data: AWS.SSM.UpdateDocumentResult) {
            event.results.push({ data: data, error: err });
            if (err) reject(err);
            else {
                latestVersion = data.DocumentDescription!.LatestVersion!;
                resolve(event);
            };
        });
    });
}


function updateDocumentAddTags(event: Event): Promise<Event | AWS.AWSError> {
    console.log(`Attempting to update tags for SSM document ${event.ResourceProperties.Name}`);
    return new Promise(function (resolve, reject) {
        const oldTags = makeTags(event, event.OldResourceProperties);
        const newTags = makeTags(event, event.ResourceProperties);
        if (JSON.stringify(oldTags) == JSON.stringify(newTags)) {
            console.log(`No changes of tags detected for document ${event.ResourceProperties.Name}. Not attempting any update`);
            return resolve(event);
        }

        ssm.addTagsToResource({
            ResourceType: 'Document',
            ResourceId: event.ResourceProperties.Name,
            Tags: newTags,
        }, function (err: AWS.AWSError, data: AWS.SSM.AddTagsToResourceResult) {
            event.results.push({ data: data, error: err });
            if (err) reject(err);
            else resolve(event);
        });
    });
}

function updateDocumentRemoveTags(event: Event): Promise<Event | AWS.AWSError> {
    console.log(`Attempting to remove some tags for SSM document ${event.ResourceProperties.Name}`);
    return new Promise(function (resolve, reject) {
        const oldTags = makeTags(event, event.OldResourceProperties);
        const newTags = makeTags(event, event.ResourceProperties);
        const tagsToRemove = getMissingTags(oldTags, newTags);
        if (JSON.stringify(oldTags) == JSON.stringify(newTags) || !tagsToRemove.length) {
            console.log(`No changes of tags detected for document ${event.ResourceProperties.Name}. Not attempting any update`);
            return resolve(event);
        }

        console.log(`Will remove the following tags: ${JSON.stringify(tagsToRemove)}`);
        ssm.removeTagsFromResource({
            ResourceId: event.ResourceProperties.Name,
            ResourceType: 'Document',
            TagKeys: tagsToRemove,
        }, function (err: AWS.AWSError, data: AWS.SSM.RemoveTagsFromResourceResult) {
            event.results.push({ data: data, error: err });
            if (err) reject(err);
            else resolve(event);
        });
    });
}

function updateDocumentDefaultVersion(event: Event): Promise<Event | AWS.AWSError> {
    console.log(`Attempting to update default version for SSM document ${event.ResourceProperties.Name}`);
    return new Promise(function (resolve, reject) {
        if ((event.ResourceProperties.UpdateDefaultVersion as string).toLowerCase() != 'true') {
            console.log('Updating of default version has not been requested. Not attempting to update default version');
            return resolve(event);
        }

        if (!latestVersion) {
            console.log(`No new version created. No update required for document ${event.ResourceProperties.Name}`);
            return resolve(event);
        }

        ssm.updateDocumentDefaultVersion({
            Name: event.ResourceProperties.Name,
            DocumentVersion: latestVersion!,
        }, function (err: AWS.AWSError, data: AWS.SSM.UpdateDocumentDefaultVersionResult) {
            event.results.push({ data: data, error: err });
            if (err) reject(err);
            else resolve(event);
        });
    });
}

function Delete(event: any): Promise<Event | AWS.AWSError> {
    console.log(`Attempting to delete SSM document ${event.ResourceProperties.Name}`);
    return new Promise(function (resolve, reject) {
        ssm.deleteDocument({
            Name: event.ResourceProperties.Name,
        }, function (err: AWS.AWSError, data: AWS.SSM.DeleteDocumentResult) {
            event.results.push({ data: data, error: err });
            if (err) reject(err);
            else resolve(event);
        });
    });
}

function timeout(event: Event, context: Context, callback: Callback) {
    const handler = () => {
        console.log('Timeout FAILURE!');
        new Promise(() => sendResponse(event, context, 'FAILED', 'Function timed out'))
            .then(() => callback(new Error('Function timed out')));
    };
    setTimeout(handler, context.getRemainingTimeInMillis() - 1000);
}

function sendResponse(event: Event, context: Context, responseStatus: string, responseData: string) {
    console.log(`Sending response ${responseStatus}:\n${JSON.stringify(responseData)}`);

    var body = JSON.stringify({
        Status: responseStatus,
        Reason: `${responseData} | Full error in CloudWatch ${context.logStreamName}`,
        PhysicalResourceId: event.ResourceProperties.Name,
        StackId: event.StackId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
        Data: {
            Message: responseData,
        },
    });

    console.log(`RESPONSE BODY:\n`, body);

    var url = URL.parse(event.ResponseURL);
    var options = {
        hostname: url.hostname,
        port: 443,
        path: url.path,
        method: 'PUT',
        headers: {
            'content-type': '',
            'content-length': body.length,
        }
    };

    console.log('SENDING RESPONSE...\n');

    var request = https.request(options, function (response: any) {
        console.log('STATUS: ' + response.statusCode);
        console.log('HEADERS: ' + JSON.stringify(response.headers));
        context.done();
    });

    request.on('error', function (error: Error) {
        console.log('sendResponse Error:' + error);
        context.done();
    });

    request.write(body);
    request.end();
}

function makeTags(event: Event, properties: any): AWS.SSM.TagList {
    const tags: AWS.SSM.TagList = [{
        Key: 'aws-cloudformation:stack-id',
        Value: event.StackId,
    }, {
        Key: 'aws-cloudformation:stack-name',
        Value: properties.StackName,
    }, {
        Key: 'aws-cloudformation:logical-id',
        Value: event.LogicalResourceId,
    }];
    if ("Tags" in properties) {
        Object.keys(properties.Tags).forEach(function (key: string) {
            tags.push({
                Key: key,
                Value: properties.Tags[key],
            });
        });
    }
    return tags;
}

function getMissingTags(oldTags: AWS.SSM.TagList, newTags: AWS.SSM.TagList): string[] {
    var missing = oldTags.filter(missingTags(newTags));
    return missing.map(function (tag: AWS.SSM.Tag) {
        return tag.Key;
    });
}

function missingTags(newTags: AWS.SSM.TagList) {
    return (currentTag: AWS.SSM.Tag) => {
        return newTags.filter((newTag: any) => {
            return newTag.Key == currentTag.Key;
        }).length == 0;
    };
}
