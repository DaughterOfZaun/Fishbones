import path from 'node:path'
import { aria2, open, createWebSocket, type Conn } from 'maria2/dist/index.js'
import { randomBytes } from '@libp2p/crypto'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { barOpts, logger, multibar } from './data-shared'
import { killSubprocess, logTerminationMsg, registerShutdownHandler, spawn, startProcess, type ChildProcess } from './data-process'
import { rwx_rx_rx, downloads, fs_chmod, fs_copyFile, fs_exists, fs_exists_and_size_eq, fs_readFile } from './data-fs'
import type { AbortOptions } from '@libp2p/interface'
import { getAnnounceAddrs } from './data-trackers'
import type { PkgInfo } from './data-packages'
import * as MegaProxy from './data-download-mega'

const LOG_PREFIX = 'ARIA2C'

//@ts-expect-error Cannot find module or its corresponding type declarations.
//import ariaExeEmbded from '../thirdparty/Motrix/extra/linux/x64/engine/aria2c' with { type: 'file' }
import ariaExeEmbded from '../thirdparty/Motrix/extra/win32/x64/engine/aria2c.exe' with { type: 'file' }

//@ts-expect-error Cannot find module or its corresponding type declarations.
//import ariaConfEmbded from '../thirdparty/Motrix/extra/linux/x64/engine/aria2.conf' with { type: 'file' }
import ariaConfEmbded from '../thirdparty/Motrix/extra/win32/x64/engine/aria2.conf' with { type: 'file' }

const ariaExe = path.join(downloads, 'aria2c.exe')
const ariaConf = path.join(downloads, 'aria2.conf')

export function repairAria2(opts: Required<AbortOptions>){
    return Promise.all([
        (async () => {
            if(await fs_exists(ariaExe, opts)) return
            await fs_copyFile(ariaExeEmbded, ariaExe, opts)
            await fs_chmod(ariaExe, rwx_rx_rx, opts)
        })(),
        (async () => {
            if(await fs_exists(ariaConf, opts)) return
            await fs_copyFile(ariaConfEmbded, ariaConf, opts)
        })(),
    ])
}

let aria2proc: ChildProcess | undefined
let aria2procPromise: Promise<void> | undefined
let aria2conn: Conn //| undefined
let aria2connPromise: Promise<Conn> | undefined
let aria2secret: string | undefined
let aria2port: number | undefined = 6800

registerShutdownHandler((force) => {
    aria2proc?.kill(force ? 'SIGKILL' : 'SIGSTOP')
})

async function startAria2(opts: Required<AbortOptions>){

    const trackers = await getAnnounceAddrs(opts)
    
    if(!aria2procPromise){
        aria2secret = uint8ArrayToString(randomBytes(8), 'base32')
        aria2proc = spawn(ariaExe, [
            `--enable-dht=${true}`,
            `--enable-dht6=${true}`,
            `--enable-peer-exchange=${true}`,
            //`--dht-listen-port=${6881}`,
            `--conf-path=${ariaConf}`,
            `--enable-rpc=${true}`,
            //`--rpc-listen-port=${6800}`,
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
            `--file-allocation=${'falloc'}`,
            `--dht-file-path=${'aria2.dht.dat'}`,
            `--dht-file-path6=${'aria2.dht6.dat'}`,
            `--log=${'aria2.log'}`,

            //TODO: These values are tweaked to download exactly two archives.
            //`--min-split-size=${512 * 1024 * 1024}`,
            //`--max-connection-per-server=${5}`,
            //`--split=${4}`,
        ], {
            cwd: downloads,
        }) //TODO: Handle start fail. Maybe?
        aria2proc.addListener('exit', (code, signal) => logTerminationMsg(LOG_PREFIX, 'exited', code, signal))

        aria2proc.stdout.setEncoding('utf8').addListener('data', (chunk) => onData('[STDOUT]', chunk))
        aria2proc.stderr.setEncoding('utf8').addListener('data', (chunk) => onData('[STDERR]', chunk))
        function onData(src: string, chunk: string){
            chunk = chunk.trim()
            if(chunk && !/^\[#\w+ .*\]$/.test(chunk)) // [#e69e0c 0B/20MiB(0%) CN:1 SD:0 DL:0B]
                logger.log(LOG_PREFIX, src, chunk)
        }

        aria2procPromise = startProcess(LOG_PREFIX, aria2proc, (stdout, /*stderr*/) => {
            const match = stdout.match(/IPv4 RPC: listening on TCP port (?<port>\d+)/)
            if(match){
                aria2port = parseInt(match.groups!['port']!)
                return true
            }
            return false
        }, opts)
        
        await aria2procPromise
    } else
        await aria2procPromise
    
    if(!aria2connPromise){
        aria2connPromise = open(createWebSocket(`ws://127.0.0.1:${aria2port}/jsonrpc`), { secret: aria2secret! })
        aria2conn = await aria2connPromise
    } else
        await aria2connPromise
}

export async function stopAria2(opts: Required<AbortOptions>){
    const prevSubprocess = aria2proc!

    if(!aria2proc) return
    aria2proc = undefined

    await killSubprocess(LOG_PREFIX, prevSubprocess, opts)
}

export async function download(pkg: PkgInfo, opts: Required<AbortOptions>){

    if(process.argv.includes('--no-download')){
        console.log(`Pretending to download ${pkg.zipName}...`)
        //await new Promise<void>(res => { if(Math.random() === 0) res() })
        //throw new Error('Unable to download file, offline mode enabled')
        return
    }

    //console.log(`Downloading ${pkg.zipName}...`)
    const bar = multibar.create(pkg.zipSize, 0, { operation: 'Downloading', filename: pkg.zipName }, barOpts)
    try {
    
        if(pkg.zipMega)
        await MegaProxy.start(opts)
        await startAria2(opts)
        
        const args = {
            'bt-save-metadata': true,
            'bt-load-saved-metadata': true,
            'rpc-save-upload-metadata': true,
            dir: downloads,
            out: pkg.zipName,
        }

        const webSeeds = []
        if(pkg.zipWebSeed) webSeeds.push(pkg.zipWebSeed)
        if(pkg.zipMega) webSeeds.push(MegaProxy.getURL(pkg))
        
        const b64 = await fs_readFile(pkg.zipTorrent, { ...opts, encoding: 'base64' })
        const gid = b64 ? await aria2.addTorrent(aria2conn, b64, webSeeds, args) :
            await aria2.addUri(aria2conn, [ pkg.zipMagnet ].concat(webSeeds), args)
        opts.signal.throwIfAborted()

        await forCompletion(gid, false, p => bar.update(p))
        if(pkg.zipMega) MegaProxy.ungetURL()

    } finally {
        bar.update(bar.getTotal())
        bar.stop()
    }

    if(!await fs_exists_and_size_eq(pkg.zip, pkg.zipSize, opts))
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
