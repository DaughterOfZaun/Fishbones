import path from 'node:path'
import { SubProcess } from 'teen_process'
import { aria2, open, createWebSocket, type Conn } from 'maria2/dist/index.js'
import { randomBytes } from '@libp2p/crypto'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { barOpts, downloads, fs_chmod, fs_copyFile, fs_exists_and_size_eq, fs_readFile, killSubprocess, logger, multibar, rwx_rx_rx } from './data-shared'
import { getAnnounceAddrs } from './data-trackers'
import type { PkgInfo } from './data-packages'

//import aria_darwin_arm64_conf from './thirdparty/Motrix/extra/darwin/arm64/engine/aria2.conf' with { type: 'file' }
//import aria_darwin_arm64_exe from './thirdparty/Motrix/extra/darwin/arm64/engine/aria2c' with { type: 'file' }
//import aria_darwin_x64_conf from './thirdparty/Motrix/extra/darwin/x64/engine/aria2.conf' with { type: 'file' }
//import aria_darwin_x64_exe from './thirdparty/Motrix/extra/darwin/x64/engine/aria2c' with { type: 'file' }
//import aria_linux_arm64_conf from './thirdparty/Motrix/extra/linux/arm64/engine/aria2.conf' with { type: 'file' }
//import aria_linux_arm64_exe from './thirdparty/Motrix/extra/linux/arm64/engine/aria2c' with { type: 'file' }
//import aria_linux_armv7l_conf from './thirdparty/Motrix/extra/linux/armv7l/engine/aria2.conf' with { type: 'file' }
//import aria_linux_armv7l_exe from './thirdparty/Motrix/extra/linux/armv7l/engine/aria2c' with { type: 'file' }
//import aria_linux_x64_conf from './thirdparty/Motrix/extra/linux/x64/engine/aria2.conf' with { type: 'file' }
//import aria_linux_x64_exe from './thirdparty/Motrix/extra/linux/x64/engine/aria2c' with { type: 'file' }
//import aria_win32_ia32_conf from './thirdparty/Motrix/extra/win32/ia32/engine/aria2.conf' with { type: 'file' }
//import aria_win32_ia32_exe from './thirdparty/Motrix/extra/win32/ia32/engine/aria2c.exe' with { type: 'file' }
//import aria_win32_x64_conf from '../thirdparty/Motrix/extra/win32/x64/engine/aria2.conf' with { type: 'file' }
//import aria_win32_x64_exe from '../thirdparty/Motrix/extra/win32/x64/engine/aria2c.exe' with { type: 'file' }
/*
const AriaPlatformArchMap: Record<string, Record<string, string>> = {
    darwin: {
        x64: 'x64',
        arm64: 'arm64',
    },
    win32: {
        ia32: 'ia32',
        x64: 'x64',
        arm64: 'x64',
    },
    linux: {
        x64: 'x64',
        arm: 'armv7l',
        arm64: 'arm64',
    }
}
const ariaPlatform = process.platform
const ariaArch = (AriaPlatformArchMap[process.platform] ?? {})[process.arch];
if(!ariaArch) throw new Error(`Unsupported platform-arch combination: ${process.platform}-${process.arch}`)

//const ariaExeDir = path.join(cwd, 'thirdparty', 'Motrix', 'extra', ariaPlatform, ariaArch, 'engine')
const ariaExeDir = `${importMetaDirname}/thirdparty/Motrix/extra/${ariaPlatform}/${ariaArch}/engine`
const ariaExeExt = (ariaPlatform == 'win32') ? '.exe' : ''
const ariaExeName = `aria2c${ariaExeExt}`
//const ariaExe = path.join(ariaExeDir, ariaExeName)
const ariaExeEmbded = `${ariaExeDir}/${ariaExeName}`
const ariaExe = path.join(downloads, ariaExeName)

const ariaConfName = 'aria2.conf'
//const ariaConf = path.join(ariaExeDir, ariaConfName)
const ariaConfEmbded = `${ariaExeDir}/${ariaConfName}`
const ariaConf = path.join(downloads, ariaConfName)
*/
//const ariaSession = path.join(downloads, 'aria2.session')

//@ts-expect-error Cannot find module or its corresponding type declarations.
//import ariaExeEmbded from '../thirdparty/Motrix/extra/linux/x64/engine/aria2c' with { type: 'file' }
import ariaExeEmbded from '../thirdparty/Motrix/extra/win32/x64/engine/aria2c.exe' with { type: 'file' }

//@ts-expect-error Cannot find module or its corresponding type declarations.
//import ariaConfEmbded from '../thirdparty/Motrix/extra/linux/x64/engine/aria2.conf' with { type: 'file' }
import ariaConfEmbded from '../thirdparty/Motrix/extra/win32/x64/engine/aria2.conf' with { type: 'file' }

const ariaExe = path.join(downloads, 'aria2c.exe')
const ariaConf = path.join(downloads, 'aria2.conf')

export function repairAria2(){
    return Promise.all([
        (async () => {
            //if(await fs_exists(ariaExe)) return
            await fs_copyFile(ariaExeEmbded, ariaExe)
            await fs_chmod(ariaExe, rwx_rx_rx)
        })(),
        (async () => {
            //if(await fs_exists(ariaExe)) return
            await fs_copyFile(ariaConfEmbded, ariaConf)
        })(),
    ])
}

let aria2proc: undefined | SubProcess
let aria2procPromise: undefined | Promise<void>
let aria2conn: /*undefined |*/ Conn
let aria2connPromise: undefined | Promise<Conn>
let aria2secret: undefined | string

async function startAria2(){

    const trackers = await getAnnounceAddrs()
    
    if(!aria2procPromise){
        aria2secret = uint8ArrayToString(randomBytes(8), 'base32')
        aria2proc = new SubProcess(ariaExe, [
            `--enable-dht=${true}`,
            `--enable-dht6=${true}`,
            `--enable-peer-exchange=${true}`,
            `--dht-listen-port=${6881}`,
            `--conf-path=${ariaConf}`,
            `--enable-rpc=${true}`,
            `--rpc-listen-port=${6800}`,
            `--rpc-listen-all=${false}`,
            `--rpc-allow-origin-all=${false}`,
            `--rpc-secret=${aria2secret}`,
            `--bt-save-metadata=${true}`,
            `--bt-load-saved-metadata=${true}`,
            `--rpc-save-upload-metadata=${true}`,
            //`--input-file=${ariaSession}`,
            //`--save-session=${ariaSession}`,
            `--check-integrity=${true}`,
            //`--dir=${downloads}`,
            `--bt-exclude-tracker=${'*'}`,
            `--bt-tracker=${trackers?.join(',')}`,
        ])
        aria2proc.on('stream-line', line => logger.log('ARIA2C', line))
        //console.log(aria2proc.cmd, ...aria2proc.args)
        aria2procPromise = aria2proc.start()
        //TODO: Handle start fail
        await aria2procPromise
    } else
        await aria2procPromise
    
    if(!aria2connPromise){
        aria2connPromise = open(createWebSocket(`ws://127.0.0.1:${6800}/jsonrpc`), { secret: aria2secret! })
        aria2conn = await aria2connPromise
    } else
        await aria2connPromise
}

export async function stopAria2(){
    const prevSubprocess = aria2proc!

    if(!aria2proc) return
    aria2proc = undefined

    await killSubprocess(prevSubprocess)
}

export async function download(pkg: PkgInfo){
    //console.log(`Downloading ${zipName}...`)
    const bar = multibar.create(pkg.zipSize, 0, { operation: 'Downloading', filename: pkg.zipName }, barOpts)
    
    await startAria2()
    
    const opts = {
        'bt-save-metadata': true,
        'bt-load-saved-metadata': true,
        'rpc-save-upload-metadata': true,
        dir: downloads,
        out: pkg.zipName,
    }

    const webSeeds = pkg.zipWebSeed ? [ pkg.zipWebSeed ] : []
    const b64 = await fs_readFile(pkg.zipTorrent, 'base64')
    const gid = b64 ? await aria2.addTorrent(aria2conn, b64, webSeeds, opts) :
        await aria2.addUri(aria2conn, [ pkg.zipMagnet ].concat(webSeeds), opts)
    await forCompletion(gid, false, p => bar.update(p))

    bar.update(bar.getTotal())
    bar.stop()

    if(!await fs_exists_and_size_eq(pkg.zip, pkg.zipSize))
        throw new Error(`Unable to download ${pkg.zipName}`)
}

function forCompletion(gid: string, isMetadata: boolean, cb: (progress: number) => void){
    
    let resolve: () => void
    let reject: (err?: unknown) => void

    const delay = 100 //TODO: Unhardcode. delay = 1000 / bar.fps
    const interval = setInterval(update, delay)
    async function update(){
        try {
            const status = await aria2.tellStatus(aria2conn, gid, ['status', 'completedLength'])
            //if(status.status === 'complete') onComplete({ gid, status: status.status })
            //if(status.status === 'error') onError({ gid, status: status.status })
            cb(Number(status.completedLength))
        } catch(err) {
            reject(err)
        }
    }

    const promise = new Promise<void>((res, rej) => {
        resolve = () => _finally() && res()
        reject = (err) => _finally() && rej(err)
    })

    const cbs = [
        aria2.onDownloadComplete(aria2conn, onComplete),
        aria2.onBtDownloadComplete(aria2conn, onComplete),
        aria2.onDownloadError(aria2conn, onError),
    ]

    async function onComplete(notification: { gid: string, status?: string }){
        if(notification.gid == gid){
            if(isMetadata){
                try {
                    const status = await aria2.tellStatus(aria2conn, gid, [ 'followedBy' ])
                    //console.assert(status.followedBy?.length == 1, 'status.followedBy?.length == 1')
                    if(status.followedBy && status.followedBy.length > 0){
                        gid = status.followedBy[0]!
                        isMetadata = false
                        //timeout = setTimeout(update, delay)
                    } else {
                        resolve()
                    }
                } catch(err) {
                    reject(err)
                }
            } else {
                resolve()
            }
        }
    }
    
    function onError(notification: { gid: string, status?: string }) {
        if(notification.gid == gid){
            reject()
        }
    }

    function _finally(){
        cbs.forEach(cb => cb.dispose())
        clearInterval(interval)
        return true
    }

    return promise
}

export function appendPartialDownloadFileExt(zip: string){
    return `${zip}.aria2c`
}
