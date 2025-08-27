import * as Mega from 'megajs'
import { packages } from './data-packages'
import { type Readable } from 'stream'
import http, { IncomingMessage, Server, ServerResponse } from 'http'
import type { AddressInfo } from 'net'
//import fs from 'fs'

//const api = Mega.API.getGlobalApi()
const api = Mega.API.globalApi = new Mega.API(false, {})
type Fetch = (url: string | URL | Request, opts: BunFetchRequestInit | RequestInit | undefined) => Promise<Response>
;(Mega.API as { fetchModule?: Fetch })['fetchModule'] = async (url, opts) => {
    if(Math.random() >= 0){
        console.log('fetch', url, opts)
        //throw new Error('Test error')
    }
    //return undefined! as Response
    return await fetch(url, opts)
}

Mega.File.defaultHandleRetries = handleRetries
type MegaError = Mega.err & { timeLimit?: number }
function handleRetries(tries: number, unk_err: Mega.err, cb: Mega.errorCb){
    const err = unk_err as MegaError
    if (err.timeLimit == undefined && tries <= 8){
        err.timeLimit = Math.pow(2, tries)
    }
    cb(err)
}
const files = new Map(packages.filter(pkg => pkg.zipMega).map(pkg => {
    //const file = {}
    const file = Mega.File.fromURL(pkg.zipMega!, { api })
    const fileInfo = Object.assign(file, {
        name: pkg.zipName,
        size: pkg.zipSize,
        //hash: pkg.zipHash,
    })
    const filePath = '/' + encodeURIComponent(fileInfo.name)
    return [ filePath, fileInfo ]
}))

const CACHED_RESPONSE_LIFETIME = Infinity
const cachedResponses = new Map<Mega.File, { time: number, data: JSON }>()

const api_request = api.request
api.request = function request(json, cb, retryno){
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
                console.log('cached res found', res)
                return Promise.resolve(res.data)
            }
            return api_request.call(api, json, (err, res) => {
                if(!err && res){
                    console.log('caching res', res)
                    cachedResponses.set(file, { time: Date.now(), data: res })
                }
                cb?.(err, res)
            }, retryno)
        }
    }
    return api_request.call(api, json, cb, retryno)
}

let server: Server | undefined
let serverAddress: AddressInfo | undefined
let serverListeningPromise: Promise<void> | undefined
export async function ensureStarted(){
    server ??= http.createServer({}, requestListener)
    if(server.listening) return
    await (serverListeningPromise ??= new Promise(res => {
        server!.listen(0, '127.0.0.1', () => {
            serverAddress = server!.address() as AddressInfo
            serverListeningPromise = undefined
            res()
        })
    }))
}

//TODO: Register package
export function getURL(zipName: string){
    if(!serverAddress) throw new Error('The server must be running before requesting URLs.')
    return `http://${serverAddress.address}:${serverAddress.port}/${zipName}`
}

export function stop(){
    if(!server?.listening) return
    server.close()
    server = undefined
    serverAddress = undefined
}

let nextRequestId = 0
function requestListener(req: IncomingMessage, res: ServerResponse){
    const id = nextRequestId++

    console.log(id, req.method, 'REQUEST', req.headers)

    if(!req.url || !req.headers) return
    const file = files.get(req.url)
    if(!file) return

    let ranged = false
    let start = 0, end = file.size - 1
    const rangeHeader = req.headers['range']
    if(typeof rangeHeader === 'string'){
        const parts = rangeHeader?.split('=').at(-1)?.split('-').map(Number)
        if(parts?.[0]) start = parts[0]
        if(parts?.[1]) end = parts[1]
        ranged = true
    }
    //const stream: Readable = fs.createReadStream(`./Fishbones_Data/${file.name}`)
    ///*
    const stream: Readable & { end: () => void } = file.download({
        start, end,
        forceHttps: true,
        maxConnections: 1,
        returnCiphertext: false,
        handleRetries,
    })
    //*/
    /*
    const stream: Readable = new Transform()
    setTimeout(() => {
        stream.emit('error', new Error('Test Error'))
    }, 1000)
    //*/
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
        console.log(id, 'HEADERS', status, headers)
        res.writeHead(status, headers)
        console.log(id, 'WRITE & PIPE')
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
                console.log(id, 'HEADERS', 503, headers)
                res.writeHead(503 /*Service Unavailable*/, headers)
            } else if((status = err.message.match(/MEGA returned a (\d+) status code/)?.[1])){
                console.log(id, 'HEADERS', status)
                res.writeHead(parseInt(status))
            } else {
                console.log(id, 'HEADERS', 502)
                res.writeHead(502 /*Bad Gateway*/)
            }
        }
        console.log(id, 'CLOSE')
        stream.emit('close')
        //stream.destroy()
        stream.end()
        res.end()
    })
}
/*
let sigints = 0
process.on('SIGINT', () => {
    if(++sigints == 1) server.close()
    else process.exit()
})
*/