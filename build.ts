/* eslint-disable @typescript-eslint/no-unused-vars */

import { $ } from 'bun'
import { promises as fs } from 'node:fs'
import path from 'node:path'

await $`mv node_modules node_modules_linux_npm`
await $`mv node_modules_win_npm node_modules`
try {
await patch()
//await build_libUTP()

const TARGET = 'bun-windows-x64'
const OUTDIR = 'dist'
const OUTFILE = 'Fishbones.exe'
const HIDE_CONSOLE = false // --windows-hide-console
const ICON = 'icon.ico'
const VERSION = '0.02'
const TITLE = `Fishbones v${VERSION}`
const PUBLISHER = "Jinx"
const DESCRIPTION = "Yet another LeagueSandbox launcher with a twist"
const COPYRIGHT = "AGPLv3"

await $`bun build --compile --target="${TARGET}" --outfile="${path.join(OUTDIR, OUTFILE)}" 'index.ts'`
await $`flatpak run --command='bottles-cli' com.usebottles.bottles run -b 'Default Gaming' -e './rcedit-x64.exe' '${path.join(OUTDIR, OUTFILE)} --set-icon ${ICON}`

//await $`flatpak run --command='bottles-cli' com.usebottles.bottles run -b 'Default Gaming' -e ${path.join(__dirname, 'bun.exe')} "build --compile --target='${TARGET}' --outfile='${path.join(__dirname, OUTDIR, OUTFILE)}' --windows-icon='${ICON}' --windows-title='${TITLE}' --windows-publisher='${PUBLISHER}' --windows-version='${VERSION}' --windows-description='${DESCRIPTION}' --windows-copyright='${COPYRIGHT}' --root='${__dirname}' '${path.join(__dirname, 'index.ts')}'"`

//console.log(`bun build --compile --target="${TARGET}" --outfile="${path.join(OUTDIR, OUTFILE)}" --windows-icon="${ICON}" --windows-title="${TITLE}" --windows-publisher="${PUBLISHER}" --windows-version="${VERSION}" --windows-description="${DESCRIPTION}" --windows-copyright="${COPYRIGHT}" 'index.ts'`)
/*
await Bun.build({
    ////@ts-expect-error: Type A is not assignable to type B
    target: 'bun',
    entrypoints: ['./index.ts'],
    outdir: './dist',
    //@ts-expect-error: Object literal may only specify known properties.
    compile: {
        target: 'bun-windows-x64',
        outfile: 'Fishbones.exe',
        windows: {
            hideConsole: false,
            icon: "./icon.ico",
            title: `Fishbones v${VERSION}`,
            publisher: "Jinx",
            version: VERSION,
            description: "Yet another LeagueSandbox launcher with a twist",
            //copyright: "GPLv3",
        },
    }
})
*/
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
