clean:
	@rm -rf ../node_modules ../package-lock.json
	@rm -rf node_modules package-lock.json

install: clean
	@cd .. && npm i
	@npm i

build: install
	@npm run build

deploy: build lambda
	@cdk deploy --require-approval never

DESTROY: build
	@cdk destroy --force

lambda:
	@../lambda/build
