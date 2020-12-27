SHELL := /bin/bash
VERSION := $(shell cat VERSION)

DOCKER_IMAGE := udondan/jsii-publish
DOCKER_TAG := 0.12.0
DOCKER_WORKDIR := /workdir

PWD := $(shell dirname $(realpath $(firstword $(MAKEFILE_LIST))))

build:
	@npm run build

package: build
	@npm run package




install: clean
	@npm i
	@cd test && npm i

test: build
	@lambda/build
	@cd test && npm run build && cdk deploy

clean:
	@rm -rf node_modules package-lock.json test/node_modules test/package-lock.json


tag:
	@git tag -a "v$(VERSION)" -m 'Creates tag "v$(VERSION)"'
	@git push --tags

untag:
	@git push --delete origin "v$(VERSION)"
	@git tag --delete "v$(VERSION)"

release: tag

re-release: untag tag
