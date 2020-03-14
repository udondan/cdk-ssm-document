import cdk = require('@aws-cdk/core');
export interface DocumentParameter {
    readonly type: string;
    readonly description: string;
    readonly default?: any;
    readonly allowedValues?: string[];
    readonly allowedPattern?: string;
    readonly displayType?: string;
    readonly minItems?: number;
    readonly maxItems?: number;
    readonly minChars?: number;
    readonly maxChars?: number;
}
export interface DocumentMainSteps {
    readonly action: string;
    readonly name: string;
    readonly inputs: {
        [key: string]: any;
    };
    readonly precondition?: {
        [key: string]: any;
    };
}
export interface DocumentContent {
    readonly schemaVersion: string;
    readonly description?: string;
    readonly mainSteps: DocumentMainSteps[];
    readonly parameters?: {
        [key: string]: DocumentParameter;
    };
}
export interface DocumentProps extends cdk.StackProps {
    readonly updateDefaultVersion?: boolean;
    readonly name: string;
    readonly documentType?: string;
    readonly targetType?: string;
    readonly content: string | DocumentContent;
}
export declare class Document extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: DocumentProps);
    private ensureLambda;
    private fixDocumentName;
}
