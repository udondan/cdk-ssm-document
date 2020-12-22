install:
	@cd .. && npm i

build: install
	@npm run build

deploy: build lambda
	@chmod -R 777 /github/workspace/test
	@cdk deploy --require-approval never

DESTROY: build
	@cdk destroy --force

lambda:
	@../lambda/build
