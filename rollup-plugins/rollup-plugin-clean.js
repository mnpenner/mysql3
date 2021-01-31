import {promises as FileSystem} from 'fs'
import Path from 'path'

export default (pluginOptions = {}) => ({
    name: 'rollup-plugin-clean',
    async writeBundle(outputOptions, bundle) {
        if(!outputOptions.dir) {
            return this.warn("Not cleaning; output.dir not specifeid")
        }
        // console.dir(this,{depth:1})
        // console.log(await this.resolve(outputOptions.dir))
        // console.dir(outputOptions,{depth:1,maxStringLength :32})
        // console.dir(bundle,{depth:1,maxStringLength :32})
        // console.dir(bundle['index.js'].map,{depth:1,maxStringLength :32})
        //
        const outputFiles = new Set(Object.values(bundle).flatMap(file => {
            const f = Path.join(outputOptions.dir, file.fileName)
            if(file.map) {
                return [f, f + '.map']
            }
            return f
        }))

        // console.log('files',files)

        // console.log(bundle['index.js'].map)


        const deleting = []
        try {
            for await(const file of readDirR(outputOptions.dir)) {
                if(!outputFiles.has(file)) {
                    console.log(`Deleting ${file}`)
                    deleting.push(FileSystem.unlink(file))
                }
            }
        } catch(err) {
            if(err.code === 'ENOENT') return
            throw err
        }

        return Promise.allSettled(deleting)
    }
})


async function* readDirR(path) {
    const entries = await FileSystem.readdir(path,{withFileTypes:true});
    for(const entry of entries) {
        const fullPath = Path.join(path,entry.name);
        if(entry.isDirectory()) {
            yield* readDirR(fullPath);
        } else {
            yield fullPath;
        }
    }
}
