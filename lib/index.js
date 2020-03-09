"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cfn = require("@aws-cdk/aws-cloudformation");
const iam = require("@aws-cdk/aws-iam");
const lambda = require("@aws-cdk/aws-lambda");
const cdk = require("@aws-cdk/core");
const fs = require("fs");
const yaml = require("js-yaml");
const path = require("path");
const resourceType = 'Custom::SSM-Document';
const ID = `CFN::Resource::${resourceType}`;
const cleanID = ID.replace(/:+/g, '-');
class Provider extends cdk.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        cdk.Tag.add(this, 'CreatedBy', props.createdBy);
        cdk.Tag.add(this, 'CostReference', props.costReference);
        cdk.Tag.add(this, 'Project', 'Stacks');
        const policy = new iam.ManagedPolicy(this, 'Policy', {
            managedPolicyName: cleanID,
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
            ]
        });
        const role = new iam.Role(this, 'Role', {
            roleName: cleanID,
            description: `Used by Lambda ${cleanID}, which is a custom CFN resource, managing SSM documents`,
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                policy,
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
            ]
        });
        const fn = new lambda.SingletonFunction(this, 'SSM-Document-Manager', {
            functionName: cleanID,
            uuid: ID,
            role: role,
            description: 'Custom CFN resource: Manage SSM Documents',
            runtime: lambda.Runtime.NODEJS_10_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/cfn-ssm-document')),
            timeout: cdk.Duration.minutes(10)
        });
        const dir = './ssm';
        const files = fs.readdirSync(dir);
        for (const i in files) {
            const name = files[i];
            const shortName = name.split('.').slice(0, -1).join('.');
            const file = `${dir}/${name}`;
            const fileContents = fs.readFileSync(file);
            new cfn.CustomResource(this, `SSMDoc-${shortName}`, {
                provider: cfn.CustomResourceProvider.fromLambda(fn),
                resourceType: resourceType,
                properties: {
                    updateDefaultVersion: true,
                    name: shortName,
                    content: yaml.safeLoad(fileContents.toString()),
                    documentType: 'Command',
                    targetType: '/',
                    //                    StackName: this.stackName,
                    tags: {
                        CreatedBy: ID,
                        a: 'b',
                        c: 'd',
                        e: 'f',
                        g: 'h',
                        i: 'j',
                        k: 'l',
                        YES: 'bam',
                        x: 2,
                    },
                }
            });
        }
    }
}
exports.Provider = Provider;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLG1EQUFvRDtBQUNwRCx3Q0FBeUM7QUFDekMsOENBQStDO0FBQy9DLHFDQUFzQztBQUN0Qyx5QkFBMEI7QUFDMUIsZ0NBQWlDO0FBQ2pDLDZCQUE4QjtBQU85QixNQUFNLFlBQVksR0FBRyxzQkFBc0IsQ0FBQztBQUM1QyxNQUFNLEVBQUUsR0FBRyxrQkFBa0IsWUFBWSxFQUFFLENBQUM7QUFDNUMsTUFBTSxPQUFPLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFFdkMsTUFBYSxRQUFTLFNBQVEsR0FBRyxDQUFDLFNBQVM7SUFDdkMsWUFBWSxLQUFvQixFQUFFLEVBQVUsRUFBRSxLQUFZO1FBQ3RELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRSxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDaEQsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRSxLQUFLLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDeEQsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUV2QyxNQUFNLE1BQU0sR0FBRyxJQUFJLEdBQUcsQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRTtZQUNqRCxpQkFBaUIsRUFBRSxPQUFPO1lBQzFCLFdBQVcsRUFBRSxrQkFBa0IsT0FBTywwREFBMEQ7WUFDaEcsVUFBVSxFQUFFO2dCQUNSLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztvQkFDcEIsT0FBTyxFQUFFO3dCQUNMLG1CQUFtQjt3QkFDbkIseUJBQXlCO3FCQUM1QjtvQkFD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Q2YsT0FBTyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLFFBQVEsRUFBRSxDQUFDO29CQUMvQyxZQUFZLEVBQUUsU0FBUztvQkFDdkIsVUFBVSxFQUFFLEdBQUc7b0JBQ2YsZ0RBQWdEO29CQUNoRCxJQUFJLEVBQUU7d0JBQ0YsU0FBUyxFQUFFLEVBQUU7d0JBQ2IsQ0FBQyxFQUFFLEdBQUc7d0JBQ04sQ0FBQyxFQUFFLEdBQUc7d0JBQ04sQ0FBQyxFQUFFLEdBQUc7d0JBQ04sQ0FBQyxFQUFFLEdBQUc7d0JBQ04sQ0FBQyxFQUFFLEdBQUc7d0JBQ04sQ0FBQyxFQUFFLEdBQUc7d0JBQ04sR0FBRyxFQUFFLEtBQUs7d0JBQ1YsQ0FBQyxFQUFFLENBQUM7cUJBQ1A7aUJBQ0o7YUFDSixDQUFDLENBQUM7U0FDTjtJQUNMLENBQUM7Q0FDSjtBQTNHRCw0QkEyR0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgY2ZuID0gcmVxdWlyZSgnQGF3cy1jZGsvYXdzLWNsb3VkZm9ybWF0aW9uJyk7XG5pbXBvcnQgaWFtID0gcmVxdWlyZSgnQGF3cy1jZGsvYXdzLWlhbScpO1xuaW1wb3J0IGxhbWJkYSA9IHJlcXVpcmUoJ0Bhd3MtY2RrL2F3cy1sYW1iZGEnKTtcbmltcG9ydCBjZGsgPSByZXF1aXJlKCdAYXdzLWNkay9jb3JlJyk7XG5pbXBvcnQgZnMgPSByZXF1aXJlKCdmcycpO1xuaW1wb3J0IHlhbWwgPSByZXF1aXJlKCdqcy15YW1sJyk7XG5pbXBvcnQgcGF0aCA9IHJlcXVpcmUoJ3BhdGgnKTtcblxuZXhwb3J0IGludGVyZmFjZSBQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgICByZWFkb25seSBjcmVhdGVkQnk6IHN0cmluZztcbiAgICByZWFkb25seSBjb3N0UmVmZXJlbmNlOiBzdHJpbmc7XG59XG5cbmNvbnN0IHJlc291cmNlVHlwZSA9ICdDdXN0b206OlNTTS1Eb2N1bWVudCc7XG5jb25zdCBJRCA9IGBDRk46OlJlc291cmNlOjoke3Jlc291cmNlVHlwZX1gO1xuY29uc3QgY2xlYW5JRCA9IElELnJlcGxhY2UoLzorL2csICctJyk7XG5cbmV4cG9ydCBjbGFzcyBQcm92aWRlciBleHRlbmRzIGNkay5Db25zdHJ1Y3Qge1xuICAgIGNvbnN0cnVjdG9yKHNjb3BlOiBjZGsuQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogUHJvcHMpIHtcbiAgICAgICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgICAgICBjZGsuVGFnLmFkZCh0aGlzLCAnQ3JlYXRlZEJ5JywgcHJvcHMuY3JlYXRlZEJ5KTtcbiAgICAgICAgY2RrLlRhZy5hZGQodGhpcywgJ0Nvc3RSZWZlcmVuY2UnLCBwcm9wcy5jb3N0UmVmZXJlbmNlKTtcbiAgICAgICAgY2RrLlRhZy5hZGQodGhpcywgJ1Byb2plY3QnLCAnU3RhY2tzJyk7XG5cbiAgICAgICAgY29uc3QgcG9saWN5ID0gbmV3IGlhbS5NYW5hZ2VkUG9saWN5KHRoaXMsICdQb2xpY3knLCB7XG4gICAgICAgICAgICBtYW5hZ2VkUG9saWN5TmFtZTogY2xlYW5JRCxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgVXNlZCBieSBMYW1iZGEgJHtjbGVhbklEfSwgd2hpY2ggaXMgYSBjdXN0b20gQ0ZOIHJlc291cmNlLCBtYW5hZ2luZyBTU00gZG9jdW1lbnRzYCxcbiAgICAgICAgICAgIHN0YXRlbWVudHM6IFtcbiAgICAgICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICdzc206TGlzdERvY3VtZW50cycsXG4gICAgICAgICAgICAgICAgICAgICAgICAnc3NtOkxpc3RUYWdzRm9yUmVzb3VyY2UnLFxuICAgICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgICAgICAgICAgJ3NzbTpDcmVhdGVEb2N1bWVudCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAnc3NtOkFkZFRhZ3NUb1Jlc291cmNlJyxcbiAgICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICAgICAgICAgICAgICAgICAgY29uZGl0aW9uczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgU3RyaW5nRXF1YWxzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2F3czpSZXF1ZXN0VGFnL0NyZWF0ZWRCeSc6IElELFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgICAgICAgICAgJ3NzbTpEZWxldGVEb2N1bWVudCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAnc3NtOkRlc2NyaWJlRG9jdW1lbnQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ3NzbTpHZXREb2N1bWVudCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAnc3NtOkxpc3REb2N1bWVudFZlcnNpb25zJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICdzc206TW9kaWZ5RG9jdW1lbnRQZXJtaXNzaW9uJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICdzc206VXBkYXRlRG9jdW1lbnQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ3NzbTpVcGRhdGVEb2N1bWVudERlZmF1bHRWZXJzaW9uJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICdzc206QWRkVGFnc1RvUmVzb3VyY2UnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ3NzbTpSZW1vdmVUYWdzRnJvbVJlc291cmNlJyxcbiAgICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICAgICAgICAgICAgICAgICAgY29uZGl0aW9uczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgU3RyaW5nRXF1YWxzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2F3czpSZXNvdXJjZVRhZy9DcmVhdGVkQnknOiBJRCxcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIF1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3Qgcm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnUm9sZScsIHtcbiAgICAgICAgICAgIHJvbGVOYW1lOiBjbGVhbklELFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBVc2VkIGJ5IExhbWJkYSAke2NsZWFuSUR9LCB3aGljaCBpcyBhIGN1c3RvbSBDRk4gcmVzb3VyY2UsIG1hbmFnaW5nIFNTTSBkb2N1bWVudHNgLFxuICAgICAgICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXG4gICAgICAgICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgICAgICAgICBwb2xpY3ksXG4gICAgICAgICAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdzZXJ2aWNlLXJvbGUvQVdTTGFtYmRhQmFzaWNFeGVjdXRpb25Sb2xlJyksXG4gICAgICAgICAgICBdXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGZuID0gbmV3IGxhbWJkYS5TaW5nbGV0b25GdW5jdGlvbih0aGlzLCAnU1NNLURvY3VtZW50LU1hbmFnZXInLCB7XG4gICAgICAgICAgICBmdW5jdGlvbk5hbWU6IGNsZWFuSUQsXG4gICAgICAgICAgICB1dWlkOiBJRCxcbiAgICAgICAgICAgIHJvbGU6IHJvbGUsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0N1c3RvbSBDRk4gcmVzb3VyY2U6IE1hbmFnZSBTU00gRG9jdW1lbnRzJyxcbiAgICAgICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xMF9YLFxuICAgICAgICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi9sYW1iZGEvY2ZuLXNzbS1kb2N1bWVudCcpKSxcbiAgICAgICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDEwKVxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBkaXIgPSAnLi9zc20nO1xuICAgICAgICBjb25zdCBmaWxlcyA9IGZzLnJlYWRkaXJTeW5jKGRpcik7XG4gICAgICAgIGZvciAoY29uc3QgaSBpbiBmaWxlcykge1xuICAgICAgICAgICAgY29uc3QgbmFtZSA9IGZpbGVzW2ldO1xuICAgICAgICAgICAgY29uc3Qgc2hvcnROYW1lID0gbmFtZS5zcGxpdCgnLicpLnNsaWNlKDAsIC0xKS5qb2luKCcuJyk7XG4gICAgICAgICAgICBjb25zdCBmaWxlID0gYCR7ZGlyfS8ke25hbWV9YDtcbiAgICAgICAgICAgIGNvbnN0IGZpbGVDb250ZW50cyA9IGZzLnJlYWRGaWxlU3luYyhmaWxlKTtcblxuICAgICAgICAgICAgbmV3IGNmbi5DdXN0b21SZXNvdXJjZSh0aGlzLCBgU1NNRG9jLSR7c2hvcnROYW1lfWAsIHtcbiAgICAgICAgICAgICAgICBwcm92aWRlcjogY2ZuLkN1c3RvbVJlc291cmNlUHJvdmlkZXIuZnJvbUxhbWJkYShmbiksXG4gICAgICAgICAgICAgICAgcmVzb3VyY2VUeXBlOiByZXNvdXJjZVR5cGUsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB1cGRhdGVEZWZhdWx0VmVyc2lvbjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogc2hvcnROYW1lLFxuICAgICAgICAgICAgICAgICAgICBjb250ZW50OiB5YW1sLnNhZmVMb2FkKGZpbGVDb250ZW50cy50b1N0cmluZygpKSxcbiAgICAgICAgICAgICAgICAgICAgZG9jdW1lbnRUeXBlOiAnQ29tbWFuZCcsXG4gICAgICAgICAgICAgICAgICAgIHRhcmdldFR5cGU6ICcvJyxcbiAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgICAgICAgICAgICAgIFN0YWNrTmFtZTogdGhpcy5zdGFja05hbWUsXG4gICAgICAgICAgICAgICAgICAgIHRhZ3M6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIENyZWF0ZWRCeTogSUQsXG4gICAgICAgICAgICAgICAgICAgICAgICBhOiAnYicsXG4gICAgICAgICAgICAgICAgICAgICAgICBjOiAnZCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBlOiAnZicsXG4gICAgICAgICAgICAgICAgICAgICAgICBnOiAnaCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBpOiAnaicsXG4gICAgICAgICAgICAgICAgICAgICAgICBrOiAnbCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBZRVM6ICdiYW0nLFxuICAgICAgICAgICAgICAgICAgICAgICAgeDogMixcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiJdfQ==