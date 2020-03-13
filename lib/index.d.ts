import cdk = require('@aws-cdk/core');
export interface DocumentProps extends cdk.StackProps {
    readonly updateDefaultVersion?: boolean;
    readonly name: string;
    readonly documentType?: string;
    readonly targetType?: string;
    readonly content: any;
}
export declare class Document extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: DocumentProps);
    private ensureLambda;
    private fixDocumentName;
}
