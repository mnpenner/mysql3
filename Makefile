MAKEFLAGS += --no-builtin-rules
.SUFFIXES:
NM := node_modules/.bin
.PHONY: build clean test

build: node_modules/.yarn-integrity dist/package.json dist/LICENSE dist/README.md
	$(NM)/tsc --build

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

test: node_modules/.yarn-integrity
	$(NM)/mocha -r ts-node/register src/**/*.spec.ts

dev: node_modules/.yarn-integrity
	$(NM)/ts-node tests/test

publish: build
	cd dist && npm publish
