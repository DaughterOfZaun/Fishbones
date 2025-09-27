/* eslint-disable @typescript-eslint/no-unused-vars */

import { $ } from 'bun'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { COPYRIGHT, DESCRIPTION, HIDE_CONSOLE, ICON, NAME, OUTDIR, OUTFILE, PUBLISHER, TARGET, TITLE, VERSION } from './utils/constants'
const OUTDIR_FILE = path.join(OUTDIR, OUTFILE)

//import { NtExecutable } from 'pe-library'
//const PE_HEADER_OFFSET_LOCATION = 0x3c
//const SUBSYSTEM_OFFSET = 0x5c
//const CONSOLE_SUBSYSTEM = 0x3
//const GUI_SUBSYSTEM = 0x2

// const supportedPlatforms = [ 'linux' , 'windows' ]
// type SupportedPlatforms = 'linux' | 'windows'
const platform: string = process.argv[2] ?? 'linux'
//if(!supportedPlatforms.includes(platform))
if(platform !== 'linux' && platform !== 'windows')
    throw new Error()

const target = `bun-${platform}-x64` as const

if(platform === 'windows'){
    await $`mv node_modules node_modules_linux_npm`
    await $`mv node_modules_win_npm node_modules`
}
try {
    //await patch()
    //await build_godot()
    //await build_libUTP()

    //await $`bun build --compile --sourcemap --target="${TARGET}" --outfile="${OUTDIR_FILE}" 'index.ts'`
    await Bun.build({
        entrypoints: [ './index.ts' ],
        sourcemap: true,
        outdir: OUTDIR,
        compile: {
            target: target,
            outfile: OUTFILE,
            windows: {
                hideConsole: HIDE_CONSOLE,
                icon: ICON,
                title: TITLE,
                publisher: PUBLISHER,
                version: VERSION,
                description: DESCRIPTION,
                copyright: COPYRIGHT,
            },
        },
        define: {
            'process.env.IS_COMPILED': 'true',
        }
    })

    //await $`bun build --sourcemap --target="bun" --outdir="${OUTDIR}" 'index-failsafe.ts'`
    //await $`bun build --compile --sourcemap --target="${TARGET}" --outfile="${OUTDIR_FILE}" './dist/index-failsafe.js' './dist/index.js'`

    //console.log(`bun build --compile --target="${TARGET}" --outfile="${OUTDIR_FILE}" --windows-icon="${ICON}" --windows-title="${TITLE}" --windows-publisher="${PUBLISHER}" --windows-version="${VERSION}" --windows-description="${DESCRIPTION}" --windows-copyright="${COPYRIGHT}" 'index.ts'`)
    //await $`flatpak run --command='bottles-cli' com.usebottles.bottles run -b 'Default Gaming' -e ${path.join(__dirname, 'bun.exe')} "build --compile --target='${TARGET}' --outfile='${path.join(__dirname, OUTDIR, OUTFILE)}' --windows-icon='${ICON}' --windows-title='${TITLE}' --windows-publisher='${PUBLISHER}' --windows-version='${VERSION}' --windows-description='${DESCRIPTION}' --windows-copyright='${COPYRIGHT}' --root='${__dirname}' '${path.join(__dirname, 'index.ts')}'"`
    if(process.argv.includes('--release')){
        const wine = `flatpak run --command='bottles-cli' com.usebottles.bottles run -b 'Default Gaming' -e`
        const args = [
            `--set-icon "${ICON}"`,
            `--set-file-version "${VERSION}"`,
            `--set-product-version "${VERSION}"`,
            `--set-version-string "FileDescription" "${DESCRIPTION}"`,
            `--set-version-string "InternalName" "${NAME}"`,
            `--set-version-string "OriginalFilename" "${OUTFILE}"`,
            `--set-version-string "ProductName" "${NAME}"`,
            `--set-version-string "CompanyName" "${PUBLISHER}"`,
            `--set-version-string "LegalCopyright" "${COPYRIGHT}"`,
        ]
        await $`${{ raw: wine }} './rcedit-x64.exe' '${OUTDIR_FILE} ${{ raw: args.join(' ') }}'`
    }
    
    /*
    const exe = await fs.readFile(OUTDIR_FILE)
    const ntExe = NtExecutable.from(exe, { ignoreCert: true })
    const ntExeHeader = ntExe.newHeader.optionalHeader
    console.log('Current subsystem is', ntExeHeader.subsystem)
    if(ntExeHeader.subsystem !== GUI_SUBSYSTEM){
        ntExeHeader.subsystem = GUI_SUBSYSTEM
        await fs.writeFile(OUTDIR_FILE, Buffer.from(ntExe.generate()))
    }
    */
    /*
    const exe = await fs.readFile(OUTDIR_FILE)

    const peHeaderOffset = exe.readUInt32LE(PE_HEADER_OFFSET_LOCATION)
    const subsystemOffset = peHeaderOffset + SUBSYSTEM_OFFSET
    const currentSubsystem = exe.readUInt16LE(subsystemOffset)

    console.log('Current subsystem is', currentSubsystem)
    if(currentSubsystem !== GUI_SUBSYSTEM){
        exe.writeUInt16LE(GUI_SUBSYSTEM, subsystemOffset)
        await fs.writeFile(OUTDIR_FILE, exe)
    }
    */

    await $`chmod +x ./dist/Fishbones.exe`
} finally {
    if(platform === 'windows'){
        await $`mv node_modules node_modules_win_npm`
        await $`mv node_modules_linux_npm node_modules`
    }
}

async function build_godot(){
    await $`/home/user/Programs/Godot/Godot_v4.5-stable_linux.x86_64 \
    --export-pack 'Windows Desktop' ../dist/RemoteUI.zip \
    --path ./remote-ui \
    --headless`
 }

async function build_libUTP(){
    $.cwd('./node_modules/utp-native/deps/libutp')
    try {
        //zig build-lib -dynamic -lc -lc++ -target x86_64-windows-gnu -lws2_32
        const objs = ['utp_internal.o', 'utp_utils.o', 'utp_hash.o', 'utp_callbacks.o', 'utp_api.o', 'utp_packedsockaddr.o',]
        const gpp = 'x86_64-w64-mingw32-g++ -Wall -DPOSIX -g -fno-exceptions -O3 -fPIC -fno-rtti -Wno-sign-compare -fpermissive'
        await Promise.all(objs.map(async (obj) => $`${{ raw: gpp }} -c -o ${obj} ${obj.replace(/\.o$/, '.cpp')}`))
        await $`${{ raw: gpp }} -o libutp.dll -shared ${{ raw: objs.join(' ') }} -lws2_32 -static -static-libgcc -static-libstdc++`
    } finally {
        $.cwd()
    }
}

async function patch(){
    await Promise.all([
        patch_achingbrain_ssdp(),
        patch_node_datachannel(),
        patch_node_datachannel_again(),
        patch_ipshipyard_node_datachannel(),
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
