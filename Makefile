MAKEFLAGS += --no-builtin-rules
.SUFFIXES:
NM := node_modules/.bin
.PHONY: build clean test

build: _build_dts _build_js dist/package.json dist/LICENSE dist/README.md

_build_dts: node_modules/.yarn-integrity
	$(NM)/tsc --emitDeclarationOnly

_build_js: node_modules/.yarn-integrity
	$(NM)/babel src --out-dir dist --extensions ".ts" --source-maps inline

node_modules/.yarn-integrity: yarn.lock
	@yarn install --frozen-lockfile --production=false --check-files
	touch $@

yarn.lock: package.json
	@yarn check --integrity
	touch $@

clean:
	rm -rf node_modules dist yarn-error.log

dist:
	mkdir -p $@

dist/LICENSE: LICENSE | dist
	cp $< $@

dist/README.md: README.md | dist
	cp $< $@

dist/package.json: package.json | dist
	jq 'del(.private, .devDependencies, .scripts, .eslintConfig, .babel)' $< > $@

#test: node_modules/.yarn-integrity
#	$(NM)/mocha --require @babel/register --watch --watch-extensions ts "src/**/*.spec.ts"

test: _build_js
	$(NM)/mocha "dist/**/*.spec.js"

dev: node_modules/.yarn-integrity
	$(NM)/babel-node --extensions ".ts" tests/test.ts

publish: build
	cd dist && npm publish
