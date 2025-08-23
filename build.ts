import { $ } from 'bun'
import { promises as fs } from 'node:fs'

await $`mv node_modules node_modules_linux_npm`
await $`mv node_modules_win_npm node_modules`
try {
await patch()
//await build_libUTP()
await $`bun build --compile --target=bun-windows-x64 --sourcemap=inline --outfile=./dist/Fishbones.exe ./index.ts`
await $`chmod 666 ./dist/Fishbones.exe`
} finally {
await $`mv node_modules node_modules_win_npm`
await $`mv node_modules_linux_npm node_modules`
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function build_libUTP(){
    $.cwd('./node_modules/utp-native/deps/libutp')
    try {
    //zig build-lib -dynamic -lc -lc++ -target x86_64-windows-gnu -lws2_32
    const objs = ['utp_internal.o', 'utp_utils.o', 'utp_hash.o', 'utp_callbacks.o', 'utp_api.o', 'utp_packedsockaddr.o',]
    const gpp = 'x86_64-w64-mingw32-g++ -Wall -DPOSIX -g -fno-exceptions -O3 -fPIC -fno-rtti -Wno-sign-compare -fpermissive'
    await Promise.all(objs.map(obj => $`${{ raw: gpp }} -c -o ${obj} ${obj.replace(/\.o$/, '.cpp')}`))
    await $`${{ raw: gpp }} -o libutp.so -shared ${{ raw: objs.join(' ') }} -lws2_32 -static -static-libgcc -static-libstdc++`
    } finally {
    $.cwd()
    }
}

async function patch(){
    await Promise.all([
        patch_ipshipyard_node_datachannel(),
        patch_node_datachannel(),
        patch_achingbrain_ssdp(),
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
const nodeDataChannel = require("../../../build/Release/node_datachannel.node");
    `.trim(), `
import nodeDataChannel from "../../../build/Release/node_datachannel.node";
    `.trim())
    await fs.writeFile(file, js, 'utf8')
}

async function patch_node_datachannel(){
    const file = './node_modules/webrtc-polyfill/node_modules/node-datachannel/lib/node-datachannel.js'
    let js = await fs.readFile(file, 'utf8')
    js = js.replace(`
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
    `.trim(), '')
    js = js.replace(`
const nodeDataChannel = require('../build/Release/node_datachannel.node');
`.trim(), `
import nodeDataChannel from "../build/Release/node_datachannel.node";
`.trim())
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
