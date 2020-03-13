"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cfn = require("@aws-cdk/aws-cloudformation");
const iam = require("@aws-cdk/aws-iam");
const lambda = require("@aws-cdk/aws-lambda");
const cdk = require("@aws-cdk/core");
const yaml = require("js-yaml");
const path = require("path");
const resourceType = 'Custom::SSM-Document';
const ID = `CFN::Resource::${resourceType}`;
const cleanID = ID.replace(/:+/g, '-');
const lambdaTimeout = 3; // minutes
class Document extends cdk.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        const stack = cdk.Stack.of(this).stackName;
        const fn = this.ensureLambda();
        const name = this.fixDocumentName(props.name);
        if (name.length < 3 || name.length > 128) {
            throw Error(`SSM Document name ${name} is invalid. The name must be between 3 and 128 characters.`);
        }
        let content = props.content;
        if (typeof content !== 'string') {
            content = yaml.safeLoad(content.toString());
        }
        new cfn.CustomResource(this, `SSMDoc-${name}`, {
            provider: cfn.CustomResourceProvider.fromLambda(fn),
            resourceType: resourceType,
            properties: {
                updateDefaultVersion: props.updateDefaultVersion || true,
                name: name,
                content: content,
                documentType: props.documentType || 'Command',
                targetType: props.targetType || '/',
                StackName: stack,
                tags: props.tags || {},
            }
        });
    }
    ensureLambda() {
        const stack = cdk.Stack.of(this);
        const constructName = 'SSM-Document-Manager';
        const existing = stack.node.tryFindChild(constructName);
        if (existing) {
            return existing;
        }
        const policy = new iam.ManagedPolicy(this, 'Policy', {
            managedPolicyName: `${stack.stackName}-${cleanID}`,
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
            ],
        });
        const role = new iam.Role(this, 'Role', {
            roleName: `${stack.stackName}-${cleanID}`,
            description: `Used by Lambda ${cleanID}, which is a custom CFN resource, managing SSM documents`,
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                policy,
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
            ]
        });
        const fn = new lambda.Function(this, constructName, {
            functionName: `${stack.stackName}-${cleanID}`,
            role: role,
            description: 'Custom CFN resource: Manage SSM Documents',
            runtime: lambda.Runtime.NODEJS_10_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/code.zip')),
            timeout: cdk.Duration.minutes(lambdaTimeout)
        });
        return fn;
    }
    fixDocumentName(name) {
        return name.replace(/[^a-zA-Z0-9_.-]+/g, '-');
    }
}
exports.Document = Document;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLG1EQUFvRDtBQUNwRCx3Q0FBeUM7QUFDekMsOENBQStDO0FBQy9DLHFDQUFzQztBQUN0QyxnQ0FBaUM7QUFDakMsNkJBQThCO0FBVzlCLE1BQU0sWUFBWSxHQUFHLHNCQUFzQixDQUFDO0FBQzVDLE1BQU0sRUFBRSxHQUFHLGtCQUFrQixZQUFZLEVBQUUsQ0FBQztBQUM1QyxNQUFNLE9BQU8sR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQztBQUN2QyxNQUFNLGFBQWEsR0FBRyxDQUFDLENBQUMsQ0FBQyxVQUFVO0FBRW5DLE1BQWEsUUFBUyxTQUFRLEdBQUcsQ0FBQyxTQUFTO0lBQ3ZDLFlBQVksS0FBb0IsRUFBRSxFQUFVLEVBQUUsS0FBb0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFDM0MsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQy9CLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRTlDLElBQUksSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksSUFBSSxDQUFDLE1BQU0sR0FBRyxHQUFHLEVBQUU7WUFDdEMsTUFBTSxLQUFLLENBQUMscUJBQXFCLElBQUksNkRBQTZELENBQUMsQ0FBQztTQUN2RztRQUVELElBQUksT0FBTyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUM7UUFDNUIsSUFBSSxPQUFPLE9BQU8sS0FBSyxRQUFRLEVBQUU7WUFDN0IsT0FBTyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsT0FB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SUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUU7WUFDaEQsWUFBWSxFQUFFLEdBQUcsS0FBSyxDQUFDLFNBQVMsSUFBSSxPQUFPLEVBQUU7WUFDN0MsSUFBSSxFQUFFLElBQUk7WUFDVixXQUFXLEVBQUUsMkNBQTJDO1lBQ3hELE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsT0FBTyxFQUFFLGVBQWU7WUFDeEIsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLG9CQUFvQixDQUFDLENBQUM7WUFDdkUsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQztTQUMvQyxDQUFDLENBQUM7UUFFSCxPQUFPLEVBQUUsQ0FBQztJQUNkLENBQUM7SUFFTyxlQUFlLENBQUMsSUFBWTtRQUNoQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsbUJBQW1CLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDbEQsQ0FBQztDQUNKO0FBL0dELDRCQStHQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBjZm4gPSByZXF1aXJlKCdAYXdzLWNkay9hd3MtY2xvdWRmb3JtYXRpb24nKTtcbmltcG9ydCBpYW0gPSByZXF1aXJlKCdAYXdzLWNkay9hd3MtaWFtJyk7XG5pbXBvcnQgbGFtYmRhID0gcmVxdWlyZSgnQGF3cy1jZGsvYXdzLWxhbWJkYScpO1xuaW1wb3J0IGNkayA9IHJlcXVpcmUoJ0Bhd3MtY2RrL2NvcmUnKTtcbmltcG9ydCB5YW1sID0gcmVxdWlyZSgnanMteWFtbCcpO1xuaW1wb3J0IHBhdGggPSByZXF1aXJlKCdwYXRoJyk7XG5cbi8vaW1wb3J0IGZzID0gcmVxdWlyZSgnZnMnKTtcbmV4cG9ydCBpbnRlcmZhY2UgRG9jdW1lbnRQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgICByZWFkb25seSB1cGRhdGVEZWZhdWx0VmVyc2lvbj86IGJvb2xlYW47XG4gICAgcmVhZG9ubHkgbmFtZTogc3RyaW5nO1xuICAgIHJlYWRvbmx5IGRvY3VtZW50VHlwZT86IHN0cmluZztcbiAgICByZWFkb25seSB0YXJnZXRUeXBlPzogc3RyaW5nO1xuICAgIHJlYWRvbmx5IGNvbnRlbnQ6IGFueTtcbn1cblxuY29uc3QgcmVzb3VyY2VUeXBlID0gJ0N1c3RvbTo6U1NNLURvY3VtZW50JztcbmNvbnN0IElEID0gYENGTjo6UmVzb3VyY2U6OiR7cmVzb3VyY2VUeXBlfWA7XG5jb25zdCBjbGVhbklEID0gSUQucmVwbGFjZSgvOisvZywgJy0nKTtcbmNvbnN0IGxhbWJkYVRpbWVvdXQgPSAzOyAvLyBtaW51dGVzXG5cbmV4cG9ydCBjbGFzcyBEb2N1bWVudCBleHRlbmRzIGNkay5Db25zdHJ1Y3Qge1xuICAgIGNvbnN0cnVjdG9yKHNjb3BlOiBjZGsuQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogRG9jdW1lbnRQcm9wcykge1xuICAgICAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgICAgIGNvbnN0IHN0YWNrID0gY2RrLlN0YWNrLm9mKHRoaXMpLnN0YWNrTmFtZTtcbiAgICAgICAgY29uc3QgZm4gPSB0aGlzLmVuc3VyZUxhbWJkYSgpO1xuICAgICAgICBjb25zdCBuYW1lID0gdGhpcy5maXhEb2N1bWVudE5hbWUocHJvcHMubmFtZSk7XG5cbiAgICAgICAgaWYgKG5hbWUubGVuZ3RoIDwgMyB8fCBuYW1lLmxlbmd0aCA+IDEyOCkge1xuICAgICAgICAgICAgdGhyb3cgRXJyb3IoYFNTTSBEb2N1bWVudCBuYW1lICR7bmFtZX0gaXMgaW52YWxpZC4gVGhlIG5hbWUgbXVzdCBiZSBiZXR3ZWVuIDMgYW5kIDEyOCBjaGFyYWN0ZXJzLmApO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGNvbnRlbnQgPSBwcm9wcy5jb250ZW50O1xuICAgICAgICBpZiAodHlwZW9mIGNvbnRlbnQgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBjb250ZW50ID0geWFtbC5zYWZlTG9hZChjb250ZW50LnRvU3RyaW5nKCkpO1xuICAgICAgICB9XG5cbiAgICAgICAgbmV3IGNmbi5DdXN0b21SZXNvdXJjZSh0aGlzLCBgU1NNRG9jLSR7bmFtZX1gLCB7XG4gICAgICAgICAgICBwcm92aWRlcjogY2ZuLkN1c3RvbVJlc291cmNlUHJvdmlkZXIuZnJvbUxhbWJkYShmbiksXG4gICAgICAgICAgICByZXNvdXJjZVR5cGU6IHJlc291cmNlVHlwZSxcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICB1cGRhdGVEZWZhdWx0VmVyc2lvbjogcHJvcHMudXBkYXRlRGVmYXVsdFZlcnNpb24gfHwgdHJ1ZSxcbiAgICAgICAgICAgICAgICBuYW1lOiBuYW1lLFxuICAgICAgICAgICAgICAgIGNvbnRlbnQ6IGNvbnRlbnQsXG4gICAgICAgICAgICAgICAgZG9jdW1lbnRUeXBlOiBwcm9wcy5kb2N1bWVudFR5cGUgfHwgJ0NvbW1hbmQnLFxuICAgICAgICAgICAgICAgIHRhcmdldFR5cGU6IHByb3BzLnRhcmdldFR5cGUgfHwgJy8nLFxuICAgICAgICAgICAgICAgIFN0YWNrTmFtZTogc3RhY2ssXG4gICAgICAgICAgICAgICAgdGFnczogcHJvcHMudGFncyB8fCB7fSxcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBlbnN1cmVMYW1iZGEoKTogbGFtYmRhLkZ1bmN0aW9uIHtcbiAgICAgICAgY29uc3Qgc3RhY2sgPSBjZGsuU3RhY2sub2YodGhpcyk7XG4gICAgICAgIGNvbnN0IGNvbnN0cnVjdE5hbWUgPSAnU1NNLURvY3VtZW50LU1hbmFnZXInO1xuICAgICAgICBjb25zdCBleGlzdGluZyA9IHN0YWNrLm5vZGUudHJ5RmluZENoaWxkKGNvbnN0cnVjdE5hbWUpO1xuICAgICAgICBpZiAoZXhpc3RpbmcpIHtcbiAgICAgICAgICAgIHJldHVybiBleGlzdGluZyBhcyBsYW1iZGEuRnVuY3Rpb247XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwb2xpY3kgPSBuZXcgaWFtLk1hbmFnZWRQb2xpY3kodGhpcywgJ1BvbGljeScsIHtcbiAgICAgICAgICAgIG1hbmFnZWRQb2xpY3lOYW1lOiBgJHtzdGFjay5zdGFja05hbWV9LSR7Y2xlYW5JRH1gLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBVc2VkIGJ5IExhbWJkYSAke2NsZWFuSUR9LCB3aGljaCBpcyBhIGN1c3RvbSBDRk4gcmVzb3VyY2UsIG1hbmFnaW5nIFNTTSBkb2N1bWVudHNgLFxuICAgICAgICAgICAgc3RhdGVtZW50czogW1xuICAgICAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgICAgICAgICAgJ3NzbTpMaXN0RG9jdW1lbnRzJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICdzc206TGlzdFRhZ3NGb3JSZXNvdXJjZScsXG4gICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAnc3NtOkNyZWF0ZURvY3VtZW50JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICdzc206QWRkVGFnc1RvUmVzb3VyY2UnLFxuICAgICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgICAgICAgICAgICAgICAgICBjb25kaXRpb25zOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBTdHJpbmdFcXVhbHM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnYXdzOlJlcXVlc3RUYWcvQ3JlYXRlZEJ5JzogSUQsXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAnc3NtOkRlbGV0ZURvY3VtZW50JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICdzc206RGVzY3JpYmVEb2N1bWVudCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAnc3NtOkdldERvY3VtZW50JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICdzc206TGlzdERvY3VtZW50VmVyc2lvbnMnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ3NzbTpNb2RpZnlEb2N1bWVudFBlcm1pc3Npb24nLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ3NzbTpVcGRhdGVEb2N1bWVudCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAnc3NtOlVwZGF0ZURvY3VtZW50RGVmYXVsdFZlcnNpb24nLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ3NzbTpBZGRUYWdzVG9SZXNvdXJjZScsXG4gICAgICAgICAgICAgICAgICAgICAgICAnc3NtOlJlbW92ZVRhZ3NGcm9tUmVzb3VyY2UnLFxuICAgICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgICAgICAgICAgICAgICAgICBjb25kaXRpb25zOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBTdHJpbmdFcXVhbHM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnYXdzOlJlc291cmNlVGFnL0NyZWF0ZWRCeSc6IElELFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3Qgcm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnUm9sZScsIHtcbiAgICAgICAgICAgIHJvbGVOYW1lOiBgJHtzdGFjay5zdGFja05hbWV9LSR7Y2xlYW5JRH1gLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBVc2VkIGJ5IExhbWJkYSAke2NsZWFuSUR9LCB3aGljaCBpcyBhIGN1c3RvbSBDRk4gcmVzb3VyY2UsIG1hbmFnaW5nIFNTTSBkb2N1bWVudHNgLFxuICAgICAgICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXG4gICAgICAgICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgICAgICAgICBwb2xpY3ksXG4gICAgICAgICAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdzZXJ2aWNlLXJvbGUvQVdTTGFtYmRhQmFzaWNFeGVjdXRpb25Sb2xlJyksXG4gICAgICAgICAgICBdXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGZuID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBjb25zdHJ1Y3ROYW1lLCB7XG4gICAgICAgICAgICBmdW5jdGlvbk5hbWU6IGAke3N0YWNrLnN0YWNrTmFtZX0tJHtjbGVhbklEfWAsXG4gICAgICAgICAgICByb2xlOiByb2xlLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICdDdXN0b20gQ0ZOIHJlc291cmNlOiBNYW5hZ2UgU1NNIERvY3VtZW50cycsXG4gICAgICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMTBfWCxcbiAgICAgICAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vbGFtYmRhL2NvZGUuemlwJykpLFxuICAgICAgICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMobGFtYmRhVGltZW91dClcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIGZuO1xuICAgIH1cblxuICAgIHByaXZhdGUgZml4RG9jdW1lbnROYW1lKG5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgICAgIHJldHVybiBuYW1lLnJlcGxhY2UoL1teYS16QS1aMC05Xy4tXSsvZywgJy0nKTtcbiAgICB9XG59XG4iXX0=