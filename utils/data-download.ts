import path from 'node:path'
import { aria2, open, createWebSocket, type Conn } from 'maria2/dist/index.js'
import { randomBytes } from '@libp2p/crypto'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { createBar, fs_copyFile } from '../ui/remote'
import { killSubprocess, spawn, startProcess, type ChildProcess } from './data-process'
import { rwx_rx_rx, downloads, fs_chmod, fs_exists, fs_exists_and_size_eq, fs_readFile } from './data-fs'
import type { AbortOptions } from '@libp2p/interface'
import { getAnnounceAddrs } from './data-trackers'
import type { PkgInfo } from './data-packages'
import * as MegaProxy from './data-download-mega'
import { args } from './args'
import defer from 'p-defer'
import embedded from './embedded'

const LOG_PREFIX = 'ARIA2C'

const ariaExe = path.join(downloads, 'aria2c.exe')
const ariaConf = path.join(downloads, 'aria2.conf')

export async function repairAria2(opts: Required<AbortOptions>){
    return Promise.all([
        (async () => {
            if(await fs_exists(ariaExe, opts)) return
            await fs_copyFile(embedded.ariaExe, ariaExe, opts)
            await fs_chmod(ariaExe, rwx_rx_rx, opts)
        })(),
        (async () => {
            if(await fs_exists(ariaConf, opts)) return
            await fs_copyFile(embedded.ariaConf, ariaConf, opts)
        })(),
    ])
}

let aria2proc: ChildProcess | undefined
let aria2procPromise: Promise<void> | undefined
let aria2conn: Conn //| undefined
let aria2connPromise: Promise<Conn> | undefined
let aria2secret: string | undefined
let aria2port: number | undefined = 6800

async function startAria2(opts: Required<AbortOptions>){

    const trackers = await getAnnounceAddrs(opts)
    
    if(!aria2procPromise){
        aria2secret = uint8ArrayToString(randomBytes(8), 'base32')
        aria2proc = spawn(ariaExe, [

            `--enable-rpc=${true}`,
            //`--rpc-listen-port=${6800}`,
            `--rpc-listen-all=${false}`,
            `--rpc-allow-origin-all=${false}`,
            `--rpc-secret=${aria2secret}`,

            //`--conf-path=${ariaConf}`,
            //`--log=${'aria2.log'}`,
            
            `--enable-dht=${true}`,
            `--enable-dht6=${true}`,
            //`--dht-listen-port=${6881}`,
            `--dht-file-path=${'aria2.dht.dat'}`,
            `--dht-file-path6=${'aria2.dht6.dat'}`,
            `--dht-entry-point=${'dht.transmissionbt.com:6881'}`,
            `--dht-entry-point6=${'dht.transmissionbt.com:6881'}`,
            
            `--bt-exclude-tracker=${'*'}`,
            `--bt-tracker=${trackers.join(',')}`,
            //`--bt-tracker-timeout=${10}`,
            //`--bt-tracker-connect-timeout=${10}`,

            `--enable-peer-exchange=${true}`,
            
            `--bt-enable-lpd=${true}`,

            // All *.torrent files are embedded now.
            //`--bt-save-metadata=${true}`,
            //`--bt-load-saved-metadata=${true}`,
            //`--rpc-save-upload-metadata=${true}`,
            
            //`--input-file=${ariaSession}`,
            //`--save-session=${ariaSession}`,
            
            //`--dir=${downloads}`,
            `--check-integrity=${true}`,
            `--check-certificate=${false}`,
            `--bt-hash-check-seed=${true}`,
            //`--file-allocation=${'prealloc'}`,

            `--summary-interval=${1}`,
            `--show-console-readout=${false}`,
            `--truncate-console-readout=${false}`,
            `--human-readable=${false}`,

            // Stability tweaks
            `--allow-piece-length-change=${true}`,
            `--auto-file-renaming=${true}`,
            `--allow-overwrite=${true}`,

            //TODO: These values are tweaked to download exactly two archives.
            //`--min-split-size=${512 * 1024 * 1024}`,
            //`--max-connection-per-server=${5}`,
            //`--split=${4}`,
        ], {
            logPrefix: LOG_PREFIX,
            //signal: opts.signal,
            cwd: downloads,
            log: true,
        }) //TODO: Handle start fail. Maybe?

        aria2procPromise = startProcess(LOG_PREFIX, aria2proc, 'stdout', (chunk) => {
            const match = chunk.match(/IPv4 RPC: listening on TCP port (?<port>\d+)/)
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

    if(!args.download.enabled){
        console.log(`Pretending to download ${pkg.zipName}...`)
        //await new Promise<void>(res => { if(Math.random() === 0) res() })
        //throw new Error('Unable to download file, offline mode enabled')
        return
    }

    //console.log(`Downloading ${pkg.zipName}...`)
    const bar = createBar('Downloading', pkg.zipName, pkg.zipSize)
    try {
    
        const webSeeds = []
        if(pkg.zipWebSeed) webSeeds.push(pkg.zipWebSeed)
        if(pkg.zipMega && args.megaDownload.enabled){
            await MegaProxy.start(opts)
            webSeeds.push(MegaProxy.getURL(pkg))
        }

        try {
            await startAria2(opts)
            
            const aria2args = {
                'bt-save-metadata': true,
                'bt-load-saved-metadata': true,
                'rpc-save-upload-metadata': true,
                dir: downloads,
                out: pkg.zipName,
            }
            
            let gid
            try {
                let b64
                if(args.torrentDownload.enabled && pkg.zipTorrent && (
                    b64 = await fs_readFile(pkg.zipTorrent, { ...opts, encoding: 'base64' })
                )){
                    gid = await aria2.addTorrent(aria2conn, b64, webSeeds, aria2args)
                } else if(args.torrentDownload.enabled && pkg.zipMagnet){
                    gid = await aria2.addUri(aria2conn, [ pkg.zipMagnet, ...webSeeds], aria2args)
                } else {
                    gid = await aria2.addUri(aria2conn, webSeeds, aria2args)
                }
            } catch(err) {
                throw new Error(`Downloading of "${pkg.zipName}" failed.`, { cause: err })
            }
            opts.signal.throwIfAborted()

            await forCompletion(gid, false, p => bar.update(p), pkg.zipName)
            
        } finally {
            if(pkg.zipMega && args.megaDownload.enabled){
                MegaProxy.ungetURL()
            }
        }
    } finally {
        bar.update(bar.getTotal())
        bar.stop()
    }

    if(!await fs_exists_and_size_eq(pkg.zip, pkg.zipSize, opts))
        throw new Error(`Unable to download "${pkg.zipName}"`)
}

const bytesRegex = /(\d+)B\/(\d+)B/
const progressRegex = /\[#(\w{6}) (.*?)\]/g
async function forCompletion(gid: string, isMetadata: boolean, cb: (progress: number) => void, fileName: string){
    
    const deferred = defer()

    const gid6lc = gid.slice(0, 6).toLowerCase()
    aria2proc!.stdout.setEncoding('utf8').on('data', onData)
    function onData(chunk: string){
        for(const [, gid, body] of [...chunk.matchAll(progressRegex)].toReversed()){
            if(gid === gid6lc){
                const m = bytesRegex.exec(body!)
                if(m && m[1]) cb(parseInt(m[1]))
                break
            }
        }
    }

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
                        deferred.resolve()
                    }
                } catch(err) {
                    deferred.reject(new Error(`Downloading of "${fileName}" failed.`, { cause: err }))
                }
            } else {
                deferred.resolve()
            }
        }
    }
    
    function onError(notification: { gid: string, status?: string }) {
        if(notification.gid == gid){
            deferred.reject(new Error(`Downloading of "${fileName}" failed.`))
        }
    }

    return deferred.promise.finally(() => {
        aria2proc!.stdout.off('data', onData)
        cbs.forEach(cb => cb.dispose())
        return true
    })
}

export function appendPartialDownloadFileExt(zip: string){
    return `${zip}.aria2`
}
