import {promises as FileSystem} from 'fs'
import Path from 'path'
import pkgUp from 'pkg-up'

export default (pluginOptions = {}) => ({
    name: 'rollup-plugin-package',
    async generateBundle(outputOptions, bundle, isWrite) {
        // console.log(outputOptions, bundle, isWrite)
        // console.log(await pkgUp());
        const pkgFile = await pkgUp()

        const pkg = pick(JSON.parse(await FileSystem.readFile(pkgFile, 'utf8')),{
            // https://docs.npmjs.com/cli/v6/configuring-npm/package-json#publishconfig
            name: Path.basename(Path.dirname(pkgFile)),
            version: undefined,
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
        // delete pkg.devDependencies
        // delete pkg.scripts
        // delete pkg.jest
        // console.log(Path.basename(Path.dirname(pkgFile)))

        for(const chunk of Object.values(bundle)) {
            if(chunk.isEntry) {
                pkg.main = chunk.fileName;
                const types = Path.basename(chunk.fileName, '.js') + '.d.ts'
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
    }
})

function pick(obj,defaults) {
    const out = Object.create(null)
    for(const k of Object.keys(defaults)) {
        out[k] = obj[k] ?? defaults[k]
    }
    return out
}