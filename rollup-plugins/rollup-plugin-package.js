import {promises as FileSystem, constants as FileConst} from 'fs'
import Path from 'path'
import pkgUp from 'pkg-up'

const COPY_FILES = ['LICENSE','README.md']

export default (pluginOptions = {}) => {
    let pkgFile;
    let pkgDir;
    let build = 0
    const isWatch = process.env.ROLLUP_WATCH === 'true'

    return {
        name: 'rollup-plugin-package',
        async buildStart(inputOptions) {
            pkgFile = await pkgUp()
            pkgDir = Path.dirname(pkgFile)
            this.addWatchFile(pkgFile)

            // console.dir(inputOptions,{depth:1,maxStringLength :32})
        },
        async generateBundle(outputOptions, bundle, isWrite) {
            if(!isWrite) return
            // console.log(outputOptions, bundle, isWrite)
            // console.log(await pkgUp());
            // const pkgFile = await pkgUp()

            // console.dir(outputOptions,{depth:1,maxStringLength :32})

            // TODO: support publishConfig https://pnpm.js.org/en/package_json#publishconfig
            const pkg = pick(JSON.parse(await FileSystem.readFile(pkgFile, 'utf8')),{
                // https://docs.npmjs.com/cli/v6/configuring-npm/package-json#publishconfig
                name: Path.basename(pkgDir),
                version: '0.1.0',
                description: undefined,
                license: 'UNLICENSED',
                dependencies: undefined,
                peerDependencies: undefined,
                engines: undefined,
                os: undefined,
                cpu: undefined,
                author: undefined,
                contributors: undefined,
                funding: undefined,
                bugs: undefined,
                homepage: undefined,
                repository: undefined,
                keywords: undefined,
            })

            if(isWatch) {
                pkg.version += `+${++build}`;
            }

            // delete pkg.devDependencies
            // delete pkg.scripts
            // delete pkg.jest
            // console.log(Path.basename(Path.dirname(pkgFile)))

            for(const chunk of Object.values(bundle)) {
                if(chunk.isEntry) {
                    pkg.main = chunk.fileName;
                    const types = chunk.fileName.replace(/\.js$/, '.d.ts');
                    if(bundle[types]) {
                        pkg.types = bundle[types].fileName
                    }
                    break;
                }
            }

            this.emitFile({
                type: 'asset',
                fileName: 'package.json',
                source: JSON.stringify(pkg,null,2),
            })

            for(const file of COPY_FILES) {
                try {
                    const license = await FileSystem.readFile(Path.join(pkgDir, file))
                    this.emitFile({
                        type: 'asset',
                        fileName: file,
                        source: license,
                    })
                } catch(err) {
                }
            }
        }
    }
}

function exists(path, mode=FileConst.R_OK) {
    return FileSystem.access(path,mode).then(() => true, () => false)
}

function pick(obj,defaults) {
    const out = Object.create(null)
    for(const k of Object.keys(defaults)) {
        out[k] = obj[k] ?? defaults[k]
    }
    return out
}
