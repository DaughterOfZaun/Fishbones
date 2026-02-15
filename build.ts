/* eslint-disable @typescript-eslint/no-unused-vars */

import { $ } from 'bun'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { NAME, OUTDIR, OUTFILE, VERSION_REGEX } from './utils/constants-build'
import { config, type Config } from './utils/data/embedded/config'
//import { ariaPkg } from './utils/data/packages/aria2'

const GODOT_EXE = './dist/Godot_v4.6-stable_linux.x86_64'

const release = process.argv.includes('release') ? 'release' : 'debug'

const version = process.argv.find(arg => VERSION_REGEX.test(arg))
console.assert(typeof version === 'string')

const indexJS = `./${OUTDIR}/index-${version}.js`

const platform =
    process.argv.includes('linux') ? 'linux' :
    process.argv.includes('windows') ? 'windows' :
    undefined!
if(platform === undefined)
    throw new Error('Platform not specified or not supported')

const target: Bun.Build.Target =
    (platform === 'linux') ? `bun-linux-x64-baseline` as Bun.Build.Target :
    (platform === 'windows') ? `bun-windows-x64-baseline` :
    undefined!

if(process.argv.includes('server')){
    await Bun.build({
        entrypoints: [ './node/server.ts' ],
        sourcemap: 'inline',
        outdir: OUTDIR,
        env: 'disable',
        target: 'bun',
        minify: false,
        compile: {
            target,
        },
    })
    process.exit()
}

async function fs_ensureDir(path: string){
    try { await fs.mkdir(path) }
    catch(err){
        if(err != null && typeof err == 'object' &&
            'code' in err && err['code'] == 'EEXIST'){ /* Ignore. */ }
        else throw err
    }
}

async function build_embeds(){

    await fs_ensureDir('./remote-ui/embedded/')
    await $`rm ./remote-ui/embedded/*`.quiet().nothrow()

    config['indexJS'] = indexJS

    const embeddedJson: Record<string, string> = {}
    for(const [key, keyConfig] of Object.entries(config as Config)){
        let from =
            (typeof keyConfig === 'string') ? keyConfig :
            (platform in keyConfig) ? keyConfig[platform]! : ''

        if(from){
            from = path.resolve(from)
            let fileName = path.basename(from)
            if(!path.extname(fileName)) fileName += '.exe'
            const to = `./remote-ui/embedded/${fileName}`
            embeddedJson[key] = to.replace('./remote-ui/', 'res://')
            //console.log(`ln -sf "${from}" "${to}"`)
            if(process.platform == 'linux')
                 await $`ln -sf ${from} ${to}`
            else await $`cp ${from} ${to}`
        } else {
            embeddedJson[key] = ''
        }
    }

    await fs_ensureDir('./dist')
    await fs.writeFile('./dist/embedded.json', JSON.stringify(embeddedJson, null, 4), 'utf8')

    let tscn = await fs.readFile('./remote-ui/main.tscn', 'utf8')
    const embeddedFiles = Object.entries(embeddedJson)
        .filter(([key, file]) => !!file && !['bunExe', 'indexJS', 'dataChannelLib'].includes(key))
        .map(([key, file]) => file)
        .toSorted()
    tscn = tscn.replace(/^embedded_js = ".*"$/m, `embedded_js = "${embeddedJson['indexJS']}"`)
    tscn = tscn.replace(/^embedded_exe = ".*"$/m, `embedded_exe = "${embeddedJson['bunExe']}"`)
    tscn = tscn.replace(/^embedded_lib_0 = ".*"$/m, `embedded_lib_0 = "${embeddedJson['dataChannelLib']}"`)
    tscn = tscn.replace(/(embedded_file_\w+ = ".*"\n)+/g, embeddedFiles.map((file, i) => {
        return `embedded_file_${i} = "${file}"\n`
    }).join(''))
    await fs.writeFile('./remote-ui/main.tscn', tscn, 'utf8')
}

if(process.argv.includes('embeds'))
    await build_embeds()

if(process.argv.includes('bun')){
    if(platform === 'windows' && process.platform == 'linux'){
        await $`mv node_modules node_modules_linux_npm`
        await $`mv node_modules_win_npm node_modules`
    }
    if(process.argv.includes('install')){
        await $`bun install --linker hoisted`
    }
    if(process.argv.includes('patch-modules')){
        await patch_npm_modules()
    }
    if(process.argv.includes('libutp')){
        await build_libUTP()
    }
    if(process.argv.includes('protons')){
        const protons = './node_modules/protons/dist/bin/protons.js'
        const messageDir = './message'
        await Promise.all(
            (await fs.readdir(messageDir))
            .filter(file => file.endsWith('.proto'))
            .map(async (file) => {
                return $`bun run ${protons} ${`${messageDir}/${file}`}`
            })
        )
    }
    // if(process.argv.includes('thirdparty')){
    //     await Promise.all([
    //         (async () => {
    //             const ariaDir = './thirdparty/aria2'
    //             await fs_ensureDir(ariaDir)
    //             await fs.writeFile(`${ariaDir}/${ariaPkg.exeName}`, await (await fetch(ariaPkg.webSeed)).bytes())
    //         })(),
    //         (async () => {})(),
    //     ])
    // }
    try {
        await Bun.build({
            entrypoints: [ './index.ts' ],
            sourcemap: 'inline',
            outdir: OUTDIR,
            env: 'disable',
            target: 'bun',
            minify: false,
            define: {
                'process.env.VERSION': `"${version}"`
            }
        })
        await fs.rename(`./${OUTDIR}/index.js`, indexJS)
    } finally {
        if(platform === 'windows' && process.platform == 'linux'){
            await $`mv node_modules node_modules_win_npm`
            await $`mv node_modules_linux_npm node_modules`
        }
    }
}

if(process.argv.includes('godot')){

    const file = './remote-ui/project.godot'
    let proj = await fs.readFile(file, 'utf8')
    proj = proj.replace(/^(config\/name)="(.*?)"$/m, `$1="${NAME} v${version}"`)
    proj = proj.replace(/^(config\/version)="(.*?)"$/m, `$1="${version}"`)
    await fs.writeFile(file, proj, 'utf8')

    //await build_godot_pck()
    await build_godot_exe()
}

async function build_godot_exe(){
    const preset = ({
        windows: 'Windows Desktop',
        linux: 'Linux Desktop',
    } as const)[platform]
    await $`${GODOT_EXE} \
    --export-${{ raw: release }} ${preset} ${path.join('..', OUTDIR, OUTFILE)} \
    --path ./remote-ui \
    --headless\
    --quiet`
}

async function build_godot_pck(){
    await $`${GODOT_EXE} \
    --export-pack 'Windows Desktop' ../dist/RemoteUI.pck \
    --path ./remote-ui \
    --headless`
}

async function build_libUTP(){
    $.cwd('./node_modules/utp-native/deps/libutp')
    try {
        const objs = ['utp_internal.o', 'utp_utils.o', 'utp_hash.o', 'utp_callbacks.o', 'utp_api.o', 'utp_packedsockaddr.o',]
        if(platform === 'windows'){
            //zig build-lib -dynamic -lc -lc++ -target x86_64-windows-gnu -lws2_32
            const gpp = `x86_64-w64-mingw32-g++ -Wall -DPOSIX -g -fno-exceptions -O3 -fPIC -fno-rtti -Wno-sign-compare -fpermissive` // -D_DEBUG -DUTP_DEBUG_LOGGING
            await Promise.all(objs.map(async (obj) => $`${{ raw: gpp }} -c -o ${obj} ${obj.replace(/\.o$/, '.cpp')}`))
            await $`${{ raw: gpp }} -o libutp.dll -shared ${{ raw: objs.join(' ') }} -lws2_32 -static -static-libgcc -static-libstdc++`
        } else if(platform === 'linux'){
            const gpp = `g++ -Wall -DPOSIX -g -fno-exceptions -O3 -fPIC -fno-rtti -Wno-sign-compare -fpermissive` // -D_DEBUG -DUTP_DEBUG_LOGGING
            await Promise.all(objs.map(async (obj) => $`${{ raw: gpp }} -c -o ${obj} ${obj.replace(/\.o$/, '.cpp')}`))
            await $`${{ raw: gpp }} -o libutp.so -shared ${{ raw: objs.join(' ') }}`
        }
    } finally {
        $.cwd()
    }
}

async function patch_npm_modules(){
    await Promise.all([
        patch_achingbrain_ssdp(),
        patch_node_datachannel(),
        patch_node_datachannel_again(),
        patch_ipshipyard_node_datachannel(),
        patch_simple_peer(),
        patch_rendezvous(),
    ])
}

async function patch_ipshipyard_node_datachannel(){
    const file = './node_modules/@ipshipyard/node-datachannel/dist/esm/lib/node-datachannel.mjs'
    let js = await fs.readFile(file, 'utf8')
    js = js.replace(`
import cjsUrl from 'node:url';
import cjsPath from 'node:path';
import cjsModule from 'node:module';
const __filename = cjsUrl.fileURLToPath(import.meta.url);
const __dirname = cjsPath.dirname(__filename);
const require = cjsModule.createRequire(import.meta.url);
    `.trim(), '')
    /*
    js = js.replace(`
const nodeDataChannel = require("../../../build/Release/node_datachannel.node");
    `.trim(), `
import nodeDataChannel from "../../../build/Release/node_datachannel.node";
    `.trim())
    */
    await fs.writeFile(file, js, 'utf8')
}

async function patch_node_datachannel(){
    const file = './node_modules/webrtc-polyfill/node_modules/node-datachannel/lib/node-datachannel.js'
    let js = await fs.readFile(file, 'utf8')
    js = js.replace(`
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
    `.trim(), '')
    /*
    js = js.replace(`
const nodeDataChannel = require('../build/Release/node_datachannel.node');
    `.trim(), `
import nodeDataChannel from "../build/Release/node_datachannel.node";
    `.trim())
    */
    await fs.writeFile(file, js, 'utf8')
}

async function patch_node_datachannel_again(){
    //const file = './node_modules/webrtc-polyfill/lib/Blob.js'
    const file = './node_modules/webrtc-polyfill/lib/RTCDataChannel.js'
    let js = await fs.readFile(file, 'utf8')
    //js = js.replace(`const _Blob = globalThis.Blob || (await import('node:buffer')).Blob\n\nexport default _Blob\n`.trim(), `export default globalThis.Blob`)
    js = js.replace(`import Blob from './Blob.js'`, '')
    await fs.writeFile(file, js, 'utf8')
}

async function patch_achingbrain_ssdp(){
    const file = './node_modules/@achingbrain/ssdp/dist/src/ssdp.js'
    let js = await fs.readFile(file, 'utf8')
    js = js.replace(`import { createRequire } from 'node:module';`, '')
    js = js.replace(`
const req = createRequire(import.meta.url);
const { name, version } = req('../../package.json');
    `.trim(), `
import { name, version } from '../../package.json';
    `.trim())
    await fs.writeFile(file, js, 'utf8')
}

async function patch_simple_peer(){
    const file = './node_modules/@thaunknown/simple-peer/lite.js'
    let js = await fs.readFile(file, 'utf8')
    js = js.replace(
        /import (.*) from 'webrtc-polyfill'/,
        "import $1 from '@ipshipyard/node-datachannel/polyfill'"
    )
    await fs.writeFile(file, js, 'utf8')
}

async function patch_rendezvous(){
    const file = './node_modules/@canvas-js/libp2p-rendezvous/lib/server/RegistrationStore.js'
    let js = await fs.readFile(file, 'utf8')
    js = js.replace(
        'import Database from "better-sqlite3";',
        'import Database from "bun:sqlite";',
    )
    js = js.replace(
        'this.db = new Database(path ?? ":memory:");',
        'this.db = new Database(path ?? ":memory:", { strict: true, safeIntegers: true });',
    )
    js = js.replace(
        'this.db.defaultSafeIntegers(true);',
        '',
    )
    await fs.writeFile(file, js, 'utf8')
}
