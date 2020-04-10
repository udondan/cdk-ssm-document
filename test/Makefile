install:
	@cd .. && npm i

build: install
	@npm run build

deploy: build
	@cdk deploy --require-approval never

DESTROY: build
	@cdk destroy --force
