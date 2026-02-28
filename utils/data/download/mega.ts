import * as Mega from 'megajs'
import { packages, type PkgInfo } from '../packages'
import type { Readable } from 'stream'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http'
import type { AddressInfo } from 'net'
import { registerShutdownHandler } from '../../process/process'
import type { AbortOptions } from '@libp2p/interface'
//import { logger } from '../../log'

//const LOG_PREFIX = 'MEGA'

/*
type Fetch = (url: string | URL | Request, opts: BunFetchRequestInit | RequestInit | undefined) => Promise<Response>
;(Mega.API as { fetchModule?: Fetch })['fetchModule'] = async (url, opts) => {
    if(Math.random() >= 0){
        logger.log(LOG_PREFIX, 'fetch', Bun.inspect(url), Bun.inspect(opts))
        //throw new Error('Test error')
    }
    //return undefined! as Response
    return await fetch(url, opts)
}
*/

Mega.File.defaultHandleRetries = handleRetries
type MegaError = Mega.err & { timeLimit?: number }
function handleRetries(tries: number, unk_err: Mega.err, cb: Mega.errorCb){
    const err = unk_err as MegaError
    if (err.timeLimit == undefined && tries <= 8){
        err.timeLimit = Math.pow(2, tries)
    }
    cb(err)
}

//const api = Mega.API.getGlobalApi()
const api: Mega.API = Mega.API.globalApi = new Mega.API(false, {})
type MegaFile = Mega.File & { name: string, size: number }
const files = new Map<string, MegaFile>()
function registerPackages(){
    for(const pkg of packages){
        if(!pkg.zipMega) continue
        registerPackage(pkg)
    }
}
function registerPackage(pkg: PkgInfo){
    if(!pkg.zipMega) throw new Error("Attempt to register a package without Mega URL.")
    const filePath = '/' + encodeURIComponent(pkg.zipName)
    const file = Mega.File.fromURL(pkg.zipMega, { api })
    const fileInfo = Object.assign(file, {
        name: pkg.zipName,
        size: pkg.zipSize,
        //hash: pkg.zipHash,
    })
    files.set(filePath, fileInfo)
}

const CACHED_RESPONSE_LIFETIME = Infinity
const cachedResponses = new Map<Mega.File, { time: number, data: JSON }>()

const api_request = api.request.bind(api)
api.request = async function request(json, cb, retryno){
    const req = json as { a?: string, g?: number, n?: string, _querystring?: { n?: string }, p?: string }
    if(req.a === 'g' && req.g === 1){
        const file = files.values().find(file => {
            return (file.nodeId && file.nodeId === req.n)
                || (Array.isArray(file.downloadId) && req._querystring?.n === file.downloadId[0] && req.n === file.downloadId[1])
                || (req.p === file.downloadId)
        })
        if(file){
            const res = cachedResponses.get(file)
            if(res && (Date.now() - res.time) <= CACHED_RESPONSE_LIFETIME){
                //logger.log(LOG_PREFIX, 'cached response found', Bun.inspect(res))
                return Promise.resolve(res.data)
            }
            return api_request(json, (err, res) => {
                if(!err && res){
                    //logger.log(LOG_PREFIX, 'caching response', Bun.inspect(res))
                    cachedResponses.set(file, { time: Date.now(), data: res })
                }
                cb?.(err, res)
            }, retryno)
        }
    }
    return api_request(json, cb, retryno)
}

let server: Server | undefined
let serverAddress: AddressInfo | undefined
let serverListeningPromise: Promise<void> | undefined
export async function start(opts: Required<AbortOptions>){
    if(!files.size) registerPackages()
    server ??= createServer({}, requestListener)
    if(server.listening) return
    await (serverListeningPromise ??= new Promise(res => {
        server!.listen(0, '127.0.0.1', () => {
            serverAddress = server!.address() as AddressInfo
            serverListeningPromise = undefined
            res()
        })
    }))
    if(opts.signal.aborted) server.close()
    opts.signal.throwIfAborted()
}

let urlsInUse = 0
export function getURL(pkg: PkgInfo){
    if(!pkg.zipMega) throw new Error("Attempt to register a package without Mega URL.")
    if(!serverAddress) throw new Error('The server must be running before requesting URLs.')
    urlsInUse++; return `http://${serverAddress.address}:${serverAddress.port}/${pkg.zipName}`
}
export function ungetURL(){
    if(!server?.listening) return
    if(--urlsInUse == 0) stop()
}

registerShutdownHandler(stop)
export function stop(){
    if(!server?.listening) return
    server.close()
    server = undefined
    serverAddress = undefined
}

let nextRequestId = 0
function requestListener(req: IncomingMessage, res: ServerResponse){
    const id = nextRequestId++

    //logger.log(LOG_PREFIX, id, req.method ?? 'undefined', 'REQUEST', JSON.stringify(req.headers, null, 4))

    if(!req.url) return
    const file = files.get(req.url)
    if(!file) return

    let ranged = false
    let start = 0, end = file.size - 1
    const rangeHeader = req.headers['range']
    if(typeof rangeHeader === 'string'){
        const parts = rangeHeader.split('=').at(-1)?.split('-').map(n => parseInt(n))
        if(parts?.[0]) start = parts[0]
        if(parts?.[1]) end = parts[1]
        ranged = true
    }

    const stream = file.download({
        start, end: end + 1,
        //forceHttps: true,
        maxConnections: 1,
        returnCiphertext: false,
        handleRetries,
    }) as Readable & { end: () => void }

    let res_headersSent = false
    stream.once('data', (chunk) => {
        const status = ranged ? 206 /*Partial Content*/ : 200 /*OK*/
        const headers = {
            'accept-ranges': 'bytes',
            'content-range': `bytes ${start}-${end}/${file.size}`,
            'content-length': (end - start + 1).toString(),
            //'content-digest': `sha-256=:${file.hash}:`,
        }
        res_headersSent = true
        //logger.log(LOG_PREFIX, id, 'HEADERS', status, JSON.stringify(headers, null, 4))
        res.writeHead(status, headers)
        //logger.log(LOG_PREFIX, id, 'WRITE & PIPE')
        res.write(chunk)
        stream.pipe(res)
    })
    stream.on('error', (unk_err: unknown) => {
        const err = unk_err as MegaError
        console.error('ERROR', err)
        if(!res_headersSent){
            res_headersSent = true
            let status
            if(err.timeLimit){
                const headers = {
                    'retry-after': err.timeLimit.toString()
                }
                //logger.log(LOG_PREFIX, id, 'HEADERS', 503, JSON.stringify(headers, null, 4))
                res.writeHead(503 /*Service Unavailable*/, headers)
            } else if((status = err.message.match(/MEGA returned a (\d+) status code/)?.[1])){
                //logger.log(LOG_PREFIX, id, 'HEADERS', status)
                res.writeHead(parseInt(status))
            } else {
                //logger.log(LOG_PREFIX, id, 'HEADERS', 502)
                res.writeHead(502 /*Bad Gateway*/)
            }
        }
        //logger.log(LOG_PREFIX, id, 'CLOSE')
        stream.emit('close')
        //stream.destroy()
        stream.end()
        res.end()
    })
}
