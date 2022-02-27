from aws_cdk import (
    # Duration,
    Stack,
    # aws_sqs as sqs,
)
from constructs import Construct

from cdk_ssm_document import (
    Document,
    DocumentContent,
    DocumentMainStep,
    DocumentParameter,
)


class TestPythonStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        Document(
            self,
            "SSM-Test-Python-Automation",
            name="Test-Python-Automation",
            document_type="Automation",
            content=DocumentContent(
                schema_version="0.3",
                assume_role="{{AutomationAssumeRole}}",
                description="Creates an automation doc using inline python",
                parameters={
                    "InstallType": DocumentParameter(
                        default="In-place update",
                        description="(Optional) Determines the way you want to install this package. Default is to add new or do an inplace update.",
                        type="String",
                        allowed_values=[
                            "In-place update",
                            "Uninstall and reinstall",
                        ],
                    ),
                    "AutomationAssumeRole": DocumentParameter(
                        default="",
                        description="(Optional) The ARN of the role to run Automations on your behalf.",
                        type="String",
                    ),
                    "InstanceId": DocumentParameter(
                        description="InstanceId to run the Automation",
                        type="String",
                    ),
                },
                main_steps=[
                    DocumentMainStep(
                        name="getEc2State",
                        max_attempts=2,
                        action="aws:executeAwsApi",
                        on_failure="Abort",
                        inputs={
                            "Service": "ec2",
                            "Api": "DescribeInstances",
                            "InstanceIds": ["{{InstanceId}}"],
                        },
                        outputs=[
                            {
                                "Name": "state",
                                "Selector": "$.Reservations[0].Instances[0].State.Name",
                                "Type": "String",
                            }
                        ],
                    )
                ],
            ),
        )
