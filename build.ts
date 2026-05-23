/* eslint-disable @typescript-eslint/no-unused-vars */

import { $ } from 'bun'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { NAME, OUTDIR, OUTFILE, VERSION_REGEX } from './utils/constants-build'
import { config, type Config } from './utils/data/embedded/config'
import { Reader, sizeof, Writer } from './utils/binary'
//import { ariaPkg } from './utils/data/packages/aria2'

const GODOT_EDITOR_EXE =
    process.platform == 'linux' ? './dist/Godot_v4.6.3-stable_linux.x86_64' :
        process.platform == 'win32' ? './dist/Godot_v4.6.3-stable_win64.exe' :
            undefined!
if (GODOT_EDITOR_EXE === undefined)
    throw new Error('Platform not specified or not supported')

const GODOT_TEMPLATES_DIR = path.join(process.env['HOME'] ?? '~', '.local/share/godot/export_templates/4.6.3.stable')

const release = process.argv.includes('release') ? 'release' : 'debug'

const version = process.argv.find(arg => VERSION_REGEX.test(arg))
console.assert(typeof version === 'string')

const indexJS = `./${OUTDIR}/index-${version}.js`
const indexJSMap = `./${OUTDIR}/index-${version}.js.map`

const platform =
    process.argv.includes('linux') ? 'linux' :
        process.argv.includes('windows') ? 'windows' :
            undefined!
if (platform === undefined)
    throw new Error('Platform not specified or not supported')

// Godot's packed file magic header ("GDPC" in ASCII).
const GODOT_PACK_HEADER_MAGIC = 0x43504447
const GODOT_TEMPLATE_EXE = ({
    windows: path.join(GODOT_TEMPLATES_DIR, `${platform}_${release}_x86_64.exe`),
    linux: path.join(GODOT_TEMPLATES_DIR, `${platform}_${release}.x86_64`),
} as const)[platform]
const godot_preset = ({
    windows: 'Windows Desktop',
    linux: 'Linux Desktop',
} as const)[platform]

const target: Bun.Build.CompileTarget =
    (platform === 'linux') ? `bun-linux-x64-baseline` :
        (platform === 'windows') ? `bun-windows-x64-baseline` :
            undefined!

if (process.argv.includes('server')) {
    await Bun.build({
        entrypoints: ['./node/server.ts'],
        sourcemap: 'linked',
        outdir: OUTDIR,
        env: 'disable',
        target: 'bun',
        minify: true,
        compile: {
            target,
        },
    })
    process.exit()
}

async function fs_ensureDir(path: string) {
    try { await fs.mkdir(path) }
    catch (err) {
        if (err != null && typeof err == 'object' &&
            'code' in err && err['code'] == 'EEXIST') { /* Ignore. */ }
        else throw err
    }
}

let embeddedJson: Record<string, string> = {}
let embedFileCopies: { from: string, to: string }[] = []

async function generate_embeds_json() {

    config['indexJS'] = indexJS
    config['indexJSMap'] = indexJSMap

    for (const [key, keyConfig] of Object.entries(config as Config)) {
        let from =
            (typeof keyConfig === 'string') ? keyConfig :
                (platform in keyConfig) ? keyConfig[platform]! : ''

        if (from) {
            from = path.resolve(from)
            let fileName = path.basename(from)
            if (!path.extname(fileName)) fileName += '.exe'
            const to = `./remote-ui/embedded/${fileName}`
            embeddedJson[key] = to.replace('./remote-ui/', 'res://')
            embedFileCopies.push({ from, to })
        } else {
            embeddedJson[key] = ''
        }
    }

    await fs_ensureDir('./dist')
    await fs.writeFile('./dist/embedded.json', JSON.stringify(embeddedJson, null, 4), 'utf8')
}

async function build_embeds() {
    await fs_ensureDir('./remote-ui/embedded/')
    await $`rm ./remote-ui/embedded/*`.quiet().nothrow()

    for (const { from, to } of embedFileCopies) {
        //console.log(`ln -sf "${from}" "${to}"`)
        if (process.platform == 'linux')
            await $`ln -sf ${from} ${to}`
        else await $`cp ${from} ${to}`
    }

    let tscn = await fs.readFile('./remote-ui/main.tscn', 'utf8')
    const embeddedFiles = Object.entries(embeddedJson)
        .filter(([key, file]) => !!file && !['bunExe', 'indexJS', 'indexJSMap', 'dataChannelLib'].includes(key))
        .map(([key, file]) => file)
        .toSorted()
    tscn = tscn.replace(/^embedded_js = ".*"$/m, `embedded_js = "${embeddedJson['indexJS']}"`)
    tscn = tscn.replace(/^embedded_js_map = ".*"$/m, `embedded_js_map = "${embeddedJson['indexJSMap']}"`)
    tscn = tscn.replace(/^embedded_exe = ".*"$/m, `embedded_exe = "${embeddedJson['bunExe']}"`)
    tscn = tscn.replace(/^embedded_lib_0 = ".*"$/m, `embedded_lib_0 = "${embeddedJson['dataChannelLib']}"`)
    tscn = tscn.replace(/(embedded_file_\w+ = ".*"\n)+/g, embeddedFiles.map((file, i) => {
        return `embedded_file_${i} = "${file}"\n`
    }).join(''))
    await fs.writeFile('./remote-ui/main.tscn', tscn, 'utf8')
}

if (process.argv.includes('embeds'))
    await generate_embeds_json()

if (process.argv.includes('bun')) {
    if (platform === 'windows' && process.platform == 'linux') {
        await $`mv node_modules node_modules_linux_npm`
        await $`mv node_modules_win_npm node_modules`
    }
    if (process.argv.includes('install')) {
        await $`bun install --linker hoisted`
    }
    if (process.argv.includes('patch-modules')) {
        await patch_npm_modules()
    }
    if (process.argv.includes('libutp')) {
        await build_libUTP()
    }
    if (process.argv.includes('protons')) {
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
            entrypoints: ['./index.ts'],
            sourcemap: 'linked',
            outdir: OUTDIR,
            env: 'disable',
            target: 'bun',
            minify: true,
            packages: "bundle",
            define: {
                'process.env.VERSION': `"${version}"`
            },
        })
        await fs.rename(`./${OUTDIR}/index.js`, indexJS)
        await fs.rename(`./${OUTDIR}/index.js.map`, indexJSMap)
    } finally {
        if (platform === 'windows' && process.platform == 'linux') {
            await $`mv node_modules node_modules_win_npm`
            await $`mv node_modules_linux_npm node_modules`
        }
    }
}

if (process.argv.includes('embeds'))
    await build_embeds()

const relative_exe_path = path.join('..', OUTDIR, OUTFILE)
const relative_pck_path = relative_exe_path.replace('.exe', '') + '.pck'

if (process.argv.includes('godot')) {

    const file = './remote-ui/project.godot'
    let proj = await fs.readFile(file, 'utf8')
    proj = proj.replace(/^(config\/name)="(.*?)"$/m, `$1="${NAME} v${version}"`)
    proj = proj.replace(/^(config\/version)="(.*?)"$/m, `$1="${version}"`)
    await fs.writeFile(file, proj, 'utf8')

    if(platform == 'windows'){
        await build_godot_exe(relative_exe_path)
    } else {
        await build_godot_pck(relative_pck_path)
        process.argv.push('append-pck') //HACK:
    }
}

if (process.argv.includes('append-pck')) {

    const template_exe_path = GODOT_TEMPLATE_EXE.replace('..', '.') //HACK:
    const pck_path = relative_pck_path.replace('..', '.')
    const exe_path = relative_exe_path.replace('..', '.')

    const template = await fs.readFile(template_exe_path)
    const pck = await fs.readFile(pck_path)
    
    const template_size = template.length //Math.ceil(template.length / 8) * 8
    const pck_size = pck.length //Math.ceil(pck.length / 8) * 8
    
    const exe = Buffer.alloc(template_size + pck_size + sizeof.uint64 + sizeof.uint32)
    
    const endianness = 'LE'

    const writer = new Writer(exe, endianness)
    writer.writeBytes(template)
    //writer.writePad(template_size - template.length)
    writer.writeBytes(pck)
    //writer.writePad(pck_size - pck.length)
    writer.writeUInt64(pck_size)
    writer.writeUInt32(GODOT_PACK_HEADER_MAGIC)

    //const reader = new Reader(exe, endianness)
    //reader.position = exe.length
    //reader.position -= 4
    //console.assert(reader.readUInt32() == GODOT_PACK_HEADER_MAGIC, `Assertion failed: 1`)
    //reader.position -= 4
    //reader.position -= 8
    //console.assert(reader.readUInt64() == BigInt(pck_size), `Assertion failed: 2`)
    //reader.position -= 8
    //reader.position -= pck_size
    //console.assert(reader.readUInt32() == GODOT_PACK_HEADER_MAGIC, `Assertion failed: 3`)

    await fs.writeFile(exe_path, exe)
}

async function build_godot_exe(outfile: string) {
    await $`${GODOT_EDITOR_EXE} \
    --export-${{ raw: release }} ${godot_preset} ${outfile} \
    --path ./remote-ui \
    --headless\
    --quiet`
}

async function build_godot_pck(outfile: string) {
    await $`${GODOT_EDITOR_EXE} \
    --export-pack ${godot_preset} ${outfile} \
    --path ./remote-ui \
    --headless\
    --quiet`
}

async function build_libUTP() {
    $.cwd('./node_modules/utp-native/deps/libutp')
    try {
        const objs = ['utp_internal.o', 'utp_utils.o', 'utp_hash.o', 'utp_callbacks.o', 'utp_api.o', 'utp_packedsockaddr.o',]
        if (platform === 'windows') {
            //zig build-lib -dynamic -lc -lc++ -target x86_64-windows-gnu -lws2_32
            const gpp = `x86_64-w64-mingw32-g++ -Wall -DPOSIX -g -fno-exceptions -O3 -fPIC -fno-rtti -Wno-sign-compare -fpermissive` // -D_DEBUG -DUTP_DEBUG_LOGGING
            await Promise.all(objs.map(async (obj) => $`${{ raw: gpp }} -c -o ${obj} ${obj.replace(/\.o$/, '.cpp')}`))
            await $`${{ raw: gpp }} -o libutp.dll -shared ${{ raw: objs.join(' ') }} -lws2_32 -static -static-libgcc -static-libstdc++`
        } else if (platform === 'linux') {
            const gpp = `g++ -Wall -DPOSIX -g -fno-exceptions -O3 -fPIC -fno-rtti -Wno-sign-compare -fpermissive` // -D_DEBUG -DUTP_DEBUG_LOGGING
            await Promise.all(objs.map(async (obj) => $`${{ raw: gpp }} -c -o ${obj} ${obj.replace(/\.o$/, '.cpp')}`))
            await $`${{ raw: gpp }} -o libutp.so -shared ${{ raw: objs.join(' ') }}`
        }
    } finally {
        $.cwd()
    }
}

async function patch_npm_modules() {
    await Promise.all([
        patch_achingbrain_ssdp(),
        patch_node_datachannel(),
        patch_node_datachannel_again(),
        patch_ipshipyard_node_datachannel(),
        patch_simple_peer(),
        //patch_rendezvous(),
    ])
}

async function patch_ipshipyard_node_datachannel() {
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

async function patch_node_datachannel() {
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

async function patch_node_datachannel_again() {
    //const file = './node_modules/webrtc-polyfill/lib/Blob.js'
    const file = './node_modules/webrtc-polyfill/lib/RTCDataChannel.js'
    let js = await fs.readFile(file, 'utf8')
    //js = js.replace(`const _Blob = globalThis.Blob || (await import('node:buffer')).Blob\n\nexport default _Blob\n`.trim(), `export default globalThis.Blob`)
    js = js.replace(`import Blob from './Blob.js'`, '')
    await fs.writeFile(file, js, 'utf8')
}

async function patch_achingbrain_ssdp() {
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

async function patch_simple_peer() {
    const file = './node_modules/@thaunknown/simple-peer/lite.js'
    let js = await fs.readFile(file, 'utf8')
    js = js.replace(
        /import (.*) from 'webrtc-polyfill'/,
        "import $1 from '@ipshipyard/node-datachannel/polyfill'"
    )
    await fs.writeFile(file, js, 'utf8')
}

async function patch_rendezvous() {
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
