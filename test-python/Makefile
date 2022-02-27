clean:
	@rm -rf ../node_modules ../package-lock.json
	@rm -rf node_modules package-lock.json

install: clean
	@echo Installing dependencies...
	@cd .. && npm i
	@pip install -r requirements.txt

build: install lambda
	@echo Building application...
	@cd .. && npm run package
	@pip install ../dist/python/cdk-ssm-document-0.0.0.tar.gz

deploy: build
	@echo Deploying application...
	@AWS_REGION=us-east-1 npx cdk -- deploy --require-approval never

diff: build
	@echo Running diff...
	@AWS_REGION=us-east-1 npx cdk -- diff

DESTROY: build
	@echo Destroying application...
	@AWS_REGION=us-east-1 npx cdk -- destroy --force

lambda:
	@echo Building Lambda...
	@../lambda/build
