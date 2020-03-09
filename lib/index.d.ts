import cdk = require('@aws-cdk/core');
export interface Props extends cdk.StackProps {
    readonly createdBy: string;
    readonly costReference: string;
}
export declare class Provider extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: Props);
}
