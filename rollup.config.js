import nodeResolve from '@rollup/plugin-node-resolve';
import nodeExternals from 'rollup-plugin-node-externals'
import * as tsconfig from './tsconfig.json';
import json from '@rollup/plugin-json';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';
import packagePlugin from './rollup-plugins/rollup-plugin-package'
import cleanPlugin from './rollup-plugins/rollup-plugin-clean'

const isWatch = process.env.ROLLUP_WATCH === 'true'
const isDev = process.env.NODE_ENV === 'development'
const isProd = !isDev


export default {
    input: tsconfig.files,
    plugins: [
        commonjs({
            include: 'node_modules/**',
        }),
        nodeExternals({
            builtins: true,
            deps: true,
            devDeps: false,
            peerDeps: true,
            optDeps: false,
        }),
        json(),
        typescript({
            abortOnError: isProd,
        }),
        nodeResolve({
            extensions: ['.ts','.json']
        }),
        packagePlugin(),
        cleanPlugin(),
    ],
    watch: {
      buildDelay: 200,
    },
    preserveSymlinks: true,  // https://www.npmjs.com/package/@rollup/plugin-commonjs#usage-with-symlinks
    preserveModules: false,  // outputs multiple files
    output: {
        // banner: '#!/usr/bin/env -S node --max-old-space-size=16384 --enable-source-maps',
        dir: 'dist',
        format: 'cjs',
        sourcemap: true,
        inlineDynamicImports: false,
    },
}

