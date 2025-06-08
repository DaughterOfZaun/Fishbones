import path from 'node:path'
import { promises as fs } from "node:fs"
import { SubProcess } from 'teen_process'
import { aria2, open, createWebSocket, type Conn } from 'maria2/dist/index.js'
import { randomBytes } from '@libp2p/crypto'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { barOpts, downloads, fs_exists_and_size_eq, importMetaDirname, killSubprocess, logger, multibar, rwx_rx_rx } from './data-shared'
import { getAnnounceAddrs } from './data-trackers'
import type { PkgInfo } from './data-packages'

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

//const ariaSession = path.join(downloads, 'aria2.session')

export function repairAria2(){
    return Promise.all([
        (async () => {
            //if(await fs_exists(ariaExe)) return
            await fs.copyFile(ariaExeEmbded, ariaExe)
            await fs.chmod(ariaExe, rwx_rx_rx)
        })(),
        (async () => {
            //if(await fs_exists(ariaExe)) return
            await fs.copyFile(ariaConfEmbded, ariaConf)
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
        aria2connPromise = open(createWebSocket('ws://localhost:6800/jsonrpc'), { secret: aria2secret })
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

export async function download(pkg: PkgInfo, type: 'magnet' | 'torrent'){
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
    if(type == 'torrent'){
        const b64 = await fs.readFile(pkg.zipTorrent, 'base64')
        const gid = await aria2.addTorrent(aria2conn, b64, webSeeds, opts)
        await forCompletion(gid, false, p => bar.update(p))
    } else if(type == 'magnet'){
        const gid = await aria2.addUri(aria2conn, [ pkg.zipMagnet ].concat(webSeeds), opts)
        await forCompletion(gid, true, p => bar.update(p))
    }

    bar.stop()

    if(!await fs_exists_and_size_eq(pkg.zip, pkg.zipSize))
        throw new Error(`Unable to download ${pkg.zipName}`)
}

function forCompletion(gid: string, isMetadata: boolean, cb: (progress: number) => void){
    
    const delay = 100 //TODO: Unhardcode. delay = 1000 / bar.fps
    let timeout: ReturnType<typeof setTimeout>
    async function update(){
        try {
            const status = await aria2.tellStatus(aria2conn, gid, ['completedLength'])
            cb(Number(status.completedLength))
        } catch(err) {}
        timeout = setTimeout(update, delay)
    }

    /*if(!isMetadata)*/ timeout = setTimeout(update, delay)

    return new Promise<void>((resolve, reject) => {
        const cbs = [
            aria2.onDownloadComplete(aria2conn, onComplete),
            aria2.onBtDownloadComplete(aria2conn, onComplete),
            aria2.onDownloadError(aria2conn, onError),
        ]
        async function onComplete(notification: { gid: string }){
            if(notification.gid == gid){
                if(isMetadata){
                    try {
                        const status = await aria2.tellStatus(aria2conn, gid, [ 'followedBy' ])
                        console.assert(status.followedBy?.length == 1)
                        if(status.followedBy && status.followedBy.length > 0){
                            gid = status.followedBy[0]!
                            isMetadata = false
                            //timeout = setTimeout(update, delay)
                        }
                    } catch(err) {
                        cbs.forEach(cb => cb.dispose())
                        clearTimeout(timeout)
                        reject(err)
                    }
                } else {
                    cbs.forEach(cb => cb.dispose())
                    clearTimeout(timeout)
                    resolve()
                }
            }
        }
        function onError(notification: { gid: string }) {
            if(notification.gid == gid){
                cbs.forEach(cb => cb.dispose())
                clearTimeout(timeout)
                reject()
            }
        }
        
    })
}
