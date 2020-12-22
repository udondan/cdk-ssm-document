install:
	@cd .. && npm i
	@chmod -R 777 /github/workspace/test

build: install
	@npm run build

deploy: build lambda
	@cdk deploy --require-approval never

DESTROY: build
	@cdk destroy --force

lambda:
	@../lambda/build
