import { privateKeyFromRaw, publicKeyFromRaw } from '@libp2p/crypto/keys'
import { TypedEventEmitter, peerDiscoverySymbol, serviceCapabilities } from '@libp2p/interface'
import type { AbortOptions, ComponentLogger, Libp2pEvents, Logger, PeerDiscovery, PeerDiscoveryEvents, PeerDiscoveryProvider, PeerId, PeerStore, PrivateKey, PublicKey, Startable, TypedEventTarget } from '@libp2p/interface'
import type { AddressManager, ConnectionManager } from '@libp2p/interface-internal'
import { ipPortToMultiaddr } from '@libp2p/utils/ip-port-to-multiaddr'
import { multiaddr, type Multiaddr } from '@multiformats/multiaddr'
//@ts-expect-error: Could not find a declaration file for module 'addr-to-ip-port'
import addrToIPPort from 'addr-to-ip-port'
//@ts-expect-error: Could not find a declaration file for module 'torrent-discovery'
import Discovery from 'torrent-discovery'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
//import { concat as uint8ArrayConcat } from 'uint8arrays/concat'
////@ts-expect-error: Could not find a declaration file for module 'bittorrent-dht'
//import { Client as DHT } from 'bittorrent-dht'
import { RecordEnvelope, PeerRecord } from '@libp2p/peer-record'

import { removePrivateAddressesMapper } from '@libp2p/kad-dht'
//import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
//import { peerIdFromCID } from '@libp2p/peer-id'

import crypto from 'node:crypto'
import type { BinaryLike } from 'node:crypto'
//src: bittorrent-dht/client.js
function sha1 (buf: BinaryLike) {
    return crypto.createHash('sha1').update(buf).digest()
}

const VERSION = '2.6.7'
//import { version as VERSION } from 'webtorrent/package.json'
const USER_AGENT = `WebTorrent/${VERSION} (https://webtorrent.io)`
//TODO: Pass via Init
const KEY = 'Z3z1776YR5Mz+EkkZOZ2VB7kUNSCm6syviHz1++589Vz4+INeC6EKD2RaDmaP9uVr5FssMaHKed7KlC5wE/+GA=='

//@ts-expect-error: Could not find a declaration file for module 'k-rpc'
import KRPC from 'k-rpc'
//@ts-expect-error: Could not find a declaration file for module 'k-rpc-socket'
import type KRPCSocket from 'k-rpc-socket'
import { createSocket, isDHT, type Socket } from '../network/umplex'
import { Queue } from '@libp2p/utils/queue'

interface KRPCSocketInit {
    timeout?: number //= 2000
    isIP?: (input: string) => number
    socket?: Socket
}

interface KRPCInit extends KRPCSocketInit {
    idLength?: number //= 20
    id?: string | Buffer | ArrayBufferView
    nodeId?: string | Buffer | ArrayBufferView
    krpcSocket?: KRPCSocket
    nodes?: boolean | { host: string, port: number }[]
    bootstrap?: boolean | { host: string, port: number }[]
    concurrency?: number //= 16
    backgroundConcurrency?: number //= 4
    k?: number //= 20
}

interface DHTInit extends KRPCInit {
    maxTables?: number //= 1000
    maxValues?: number //= 1000
    maxAge?: number //= 0
    maxPeers?: number //= 10000
    hash?: (data: BinaryLike) => Buffer
    krpc?: KRPC
    verify?: (signature: Uint8Array, data: Uint8Array, publicKeyRaw: Uint8Array) => boolean //= null
    host?: string //= null
    timeBucketOutdated?: number //= 15 * 60 * 1000
    bootstrap?: boolean //= true
}

interface DiscoveryInit {
    peerId: string | Buffer
    infoHash: string | Buffer
    port: number

    userAgent?: string
    announce?: string[] //= []
    intervalMs?: number //= 15 * 60 * 1000
    tracker?: boolean | object
    dht?: boolean | DHTInit
    dhtPort?: number
    lsd?: boolean
}

interface DiscoveryServiceInit {
    infoHash: string | Buffer
    announce?: string[]
    
    findSelfInterval?: number
    observationsCount?: number
    observationLifetime?: number
    //observationRetryTime?: number
    republishInterval?: number

    //lookupInterval?: number
    resolutionConcurrency?: number
    resolutionLifetime?: number
}

interface DiscoveryComponents {
    peerId: PeerId
    logger: ComponentLogger
    connectionManager: ConnectionManager
    events: TypedEventTarget<Libp2pEvents>
    peerStore: PeerStore
    addressManager: AddressManager
}

interface DiscoveryEvents extends PeerDiscoveryEvents {
    addr: CustomEvent<Multiaddr>
}

export function torrentPeerDiscovery(init: DiscoveryServiceInit): (components: DiscoveryComponents) => DiscoveryClass {
    return (components: DiscoveryComponents) => new DiscoveryClass(init, components)
}

const verify = (signature: Uint8Array, data: Uint8Array, publicKeyRaw: Uint8Array) => {
    const publicKey = publicKeyFromRaw(publicKeyRaw)
    return publicKey.verify(data, signature)
        === true //HACK:
}

type RPCPeer = { id: Buffer, host?: string, address?: string, port: number }
type RPCResponse = { r?: { nodes?: Buffer }, ip?: Buffer }
type RPCVisitCallback = (res: RPCResponse, peer: RPCPeer) => void

type Bencoded = Buffer | string | number | { [key: number]: Bencoded } | { [key: string]: Bencoded }
type DHTGetReturnType = { v: Bencoded }

type HostPort = { host: string, port: number }
type ExternalAddress = HostPort & {
    reportedBy: Map<string, number>
    publishedItShouldBe: boolean
    published: boolean
}
type ResolutionJobOptions = AbortOptions & {
    ipport: string
    detail: Multiaddr
}

class DiscoveryClass extends TypedEventEmitter<DiscoveryEvents> implements PeerDiscovery, PeerDiscoveryProvider, Startable {
    
    private discovery: Discovery
    private readonly init: Required<DiscoveryServiceInit>
    private readonly components: DiscoveryComponents
    private readonly log: Logger

    private readonly publicKey: PublicKey
    private readonly privateKey: PrivateKey
    private readonly sign = (data: Uint8Array) => {
        return this.privateKey.sign(data)
    }

    private readonly resolutionQueue: Queue<void, ResolutionJobOptions>
    private readonly resolved = new Map<string, number>()
    
    constructor(init: DiscoveryServiceInit, components: DiscoveryComponents){
        super()
        this.init = {
            announce: [],

            findSelfInterval: 1/*m*/ * 60/*s*/ * 1000/*ms*/,
            
            // @libp2p/autonat-v2/src/client.ts
            observationsCount: 4, // REQUIRED_SUCCESSFUL_DIALS
            // libp2p/src/address-manager/index.ts
            observationLifetime: 10/*m*/ * 60/*s*/ * 1000/*ms*/, //defaultValues.addressVerificationTTL
            //observationRetryTime: 5/*m*/ * 60/*s*/ * 1000/*ms*/, //defaultValues.addressVerificationRetry

            // bittorrent.org/beps/bep_0044.html#expiration
            republishInterval: 1/*h*/ * 60/*m*/ * 60/*s*/ * 1000/*ms*/,

            resolutionConcurrency: 3,
            resolutionLifetime: 10/*m*/ * 60/*s*/ * 1000/*ms*/,
            
            ...init,
        }
        this.components = components
        this.log = components.logger.forComponent('libp2p:torrent-discovery')
        this.privateKey = privateKeyFromRaw(uint8ArrayFromString(KEY, 'base64pad'))
        this.publicKey = this.privateKey.publicKey
        this.resolutionQueue = new Queue({
            concurrency: this.init.resolutionConcurrency
        })
    }

    public readonly [peerDiscoverySymbol] = this
    public readonly [Symbol.toStringTag] = '@libp2p/torrent-discovery'
    public readonly [serviceCapabilities]: string[] = [
      '@libp2p/peer-discovery'
    ]

    public start() {
        if(this.discovery) return

        const hash = sha1
        const hashLength = hash(Buffer.from('')).length

        const optsDHT: DHTInit = {
            socket: createSocket({ type: 'udp4', filter: isDHT }),
            bootstrap: true,
            verify,
            hash,
        }
        const opts: DiscoveryInit = {
            port: 0,
            dhtPort: 0,
            tracker: false,
            lsd: false,

            infoHash: this.init.infoHash,
            peerId: hash(this.components.peerId.publicKey!.raw),
            userAgent: USER_AGENT,
            dht: optsDHT,
        }

        const rpc = optsDHT.krpc = new KRPC({ idLength: hashLength, ...opts } as KRPCInit)
        
        const rpc__closest = rpc._closest
        rpc._closest = (target: unknown, message: unknown, background: unknown, visit: RPCVisitCallback, cb: unknown) => {
            const patchedVisit = (!visit || visit === this.onReply) ? this.onReply : (res: RPCResponse, peer: RPCPeer) => {
                const ret = visit(res, peer)
                this.onReply(res, peer)
                return ret
            }
            return rpc__closest.call(rpc, target, message, background, patchedVisit, cb)
        }
        /*
        const rpc_query = rpc.query
        rpc.query = (node: unknown, message: Record<string, Bencoded>, cb: (err: Error, res: RPCResponse, peer: RPCPeer) => void) => {
            if(message.q === 'ping'){
                this.log('replaced ping with find_node')
                message = {
                    q: 'find_node',
                    a: {
                        id: rpc.id,
                        target: rpc.id
                    }
                }
            }
            return rpc_query.call(rpc, node, message, (err: Error, res: RPCResponse, peer: RPCPeer) => {
                const ret = cb?.(err, res, peer)
                this.onReply(res, peer)
                return ret
            })
        }
        */
        process.browser = true //HACK: To bypass opts.port check
        const discovery = new Discovery(opts)
        process.browser = false
        this.discovery = discovery

        const { dht } = discovery
        const dht__debug = dht._debug
        dht._debug = function(...args: unknown[]){
            if(args[0] !== 'received ping')
                return dht__debug.apply(this, args)
        }

        dht.on('node', this.onNode)

        discovery.addListener('peer', this.onPeer)
        discovery.addListener('warning', this.onWarning)
        discovery.addListener('error', this.onError)

        this.components.events.addEventListener('self:peer:update', this.onUpdate)

        //this.findSelfTimeout = setTimeout(this.findSelf, this.init.findSelfInterval)
    }

    public async stop() {
        if(!this.discovery) return

        const discovery = this.discovery
        this.discovery = undefined
        
        const { dht } = discovery
        dht.removeListener('node', this.onNode)

        discovery.removeListener('peer', this.onPeer)
        discovery.removeListener('warning', this.onWarning)
        discovery.removeListener('error', this.onError)

        this.components.events.removeEventListener('self:peer:update', this.onUpdate)
        
        clearTimeout(this.publishTimeout)
        clearTimeout(this.findSelfTimeout)
        
        await new Promise<void>(res => discovery.destroy(() => res()))
    }

    private readonly onNode = (node: RPCPeer) => {
        const dht = this.discovery.dht
        const rpc = this.discovery.dht._rpc
        
        const requiresNewObservations = !!this.externalAddresses.values().find(addr => addr.publishedItShouldBe)
        if(!requiresNewObservations){
            dht.removeListener('node', this.onNode)
            return
        }

        rpc.query(node, {
            q: 'find_node',
            a: {
                id: rpc.id,
                target: rpc.id
            }
        }, (err: undefined | Error & { code: string }, res: RPCResponse, peer: RPCPeer) => {
            if(this.afterQuery(err, res, peer)){
                this.onReply(res, peer)
            }
        })
    }

    private afterQuery(err: undefined | Error & { code: string }, res: RPCResponse, peer: RPCPeer){
        const rpc = this.discovery.dht._rpc

        if(err){
            if (err.code === 'EUNEXPECTEDNODE' || err.code === 'ETIMEDOUT') {
                if (peer?.id && rpc.nodes.get(peer.id)) {
                    rpc.nodes.remove(peer.id)
                }
            } else if(err.message != 'Query was cancelled'){
                this.log('error querying node %s - %e', peer.id.toString('hex'), err)
            }
            return false
        }
        return true
    }

    private findSelfTimeout?: ReturnType<typeof setTimeout>
    private readonly findSelf = (foreground = false) => {
        clearTimeout(this.findSelfTimeout)
        
        //const dht = this.discovery.dht
        const rpc = this.discovery.dht._rpc
        const msg = {
            q: 'find_node',
            a: {
                id: rpc.id,
                target: rpc.id
            }
        }
        
        this.log('begin finding self')

        Promise.resolve().then(async () => {
            let n = 0
            let pending = 0
            let stop = false

            const queried = new Set<string>()
            
            //const nodes = rpc.nodes.closest(infoHash)
            //const nodes = shuffleInplace(rpc.nodes.toArray())
            //for(const node of nodes){
            while(true){
                
                const evt = foreground ? 'update' : 'postupdate'
                const otherInflight = rpc.pending.length + rpc.socket.inflight - pending
                const concurrency = foreground ? rpc.concurrency : rpc.backgroundConcurrency
                while (!stop && rpc.socket.inflight >= concurrency && (foreground || !otherInflight))
                    await new Promise(resolve => rpc.socket.once(evt, resolve))
                if(stop) break

                //TODO: Optimize.
                const nodes = rpc.nodes.toArray().filter((peer: RPCPeer) => {
                    const ipport = `${peer.host || peer.address}:${peer.port}`
                    return !queried.has(ipport)
                })
                const node = nodes[Math.floor(Math.random() * nodes.length)]
                if(!node) break

                pending++
                rpc.socket.query(node, msg, (err: undefined | Error & { code: string }, res: RPCResponse, peer: RPCPeer) => {
                    pending--
                    
                    const ipport = `${peer.host || peer.address}:${peer.port}`
                    queried.add(ipport)

                    if(this.afterQuery(err, res, peer)){
                        this.onReply(res, peer)
                        stop ||= !!this.externalAddresses.values().find(addr => addr.publishedItShouldBe)
                        n++
                    }

                    if(!pending){
                        this.log('visited %d nodes', n)
                        done.call(this)
                    }
                })
            }
            if(!pending){
                this.log('visited %d nodes', n)
                done.call(this)
            }
        })
        //.then(() => done.call(this))
        //.catch((err) => done.call(this, err))

        function done(this: DiscoveryClass, err?: Error){
            if(err) this.log('error finding self - %e', err)
            else this.log('done finding self')
            this.findSelfTimeout = setTimeout(this.findSelf, this.init.findSelfInterval)
        }
    }

    private readonly onReply = (res: RPCResponse, peer: RPCPeer) => {
        //this.log('onReply', `${peer.host || peer.address}:${peer.port}`, res)
        
        if(!res?.r?.nodes) return
        
        const rpc = this.discovery.dht._rpc
        const nodes = Buffer.isBuffer(res.r.nodes) ? parseNodes(res.r.nodes, rpc._idLength) : []
        let foundNewExtAddr = false
        for(const node of nodes){
            //this.log('onReply', `${node.host}:${node.port}`, node.id.toString('hex'), 'vs', rpc.id.toString('hex'))
            if(node.id.equals(rpc.id)){
                foundNewExtAddr ||= this.maybeAddExternalAddress(node, 'dht', res, peer)
            }
        }
        if(foundNewExtAddr)
            this.publish(false)
    }

    private readonly onPeer = async (ipport: string, source: 'tracker'|'dht'|'lsd') => {
        
        if(this.externalAddresses.has(ipport)){
            this.log('discovered self %s from %s', ipport, source)
            return
        } else {
            const now = Date.now()
            const resolvedAt = this.resolved.get(ipport)
            if(resolvedAt !== undefined){
                if((now - resolvedAt) <= this.init.resolutionLifetime){
                    this.log('discovered already resolved peer %s from %s', ipport, source)
                    return
                } else {
                    this.log('discovered already resolved but expired peer %s from %s', ipport, source)
                }
            } else {
                const resolving = this.resolutionQueue.queue.find(job => job.options.ipport == ipport)
                if(resolving){
                    this.log('discovered already resolving peer %s from %s', ipport, source)
                    return
                } else {
                    this.log('discovered peer %s from %s', ipport, source)
                }
            }
        }        

        const [ip, port]: [string, number] = addrToIPPort(ipport)
        const detail = ipPortToMultiaddr(ip, port)
        this.safeDispatchEvent('addr', { detail })

        this.resolutionQueue.add(this.resolveAddress, {
            ipport, detail,
        })
        .catch(err => this.log.error(err))
    }
    private readonly resolveAddress = async ({ ipport, detail }: ResolutionJobOptions) => {
        const opts = {
            k: this.publicKey.raw,
            salt: detail.bytes,
        }
        const hash = this.discovery.dht._hash(Buffer.concat([opts.k, opts.salt]))
        try {
            const value = await new Promise<DHTGetReturnType>((resolve, reject) => {
                this.discovery.dht.get(hash, { cache: false }, (err: Error, value: DHTGetReturnType) => {
                    if(err) reject(err)
                    else resolve(value)
                })
            })

            this.resolved.set(ipport, Date.now())
            
            if(value && Buffer.isBuffer(value.v)){
                const buf = value.v
                if(await this.components.peerStore.consumePeerRecord(buf))
                    this.log('consumed peer record for %s', ipport)
                else
                    this.log('received invalid peer record for %s', ipport)
            } else {
                this.log('error getting record for %s - no value provided or its not a buffer', ipport)
            }
        } catch (err){
            this.log('error getting record for %s - %e', ipport, err)
        }
    }

    private readonly onWarning = (err: Error) => {
        this.log.error('warning', err)
    }
    private readonly onError = (err: Error) => {
        this.log.error('error', err)
    }
    
    private multiaddrs: Multiaddr[] = []
    private multiaddrs_eq(to: Multiaddr[]){
        return this.multiaddrs.length === to.length && !this.multiaddrs.some(ma => !to.some(mb => ma.equals(mb)))
    }
    
    private readonly externalAddresses = new Map<string, ExternalAddress>()
    private maybeAddExternalAddress(info: HostPort, source: string, res: object, peer: RPCPeer): boolean {
        const now = Date.now()
        const { host, port } = info
        const hostport = `${host}:${port}`
        const reporter = `${(peer.address || peer.host)!}:${peer.port}`
        
        let external = this.externalAddresses.get(hostport)
        if(!external){
            this.log('discovered new external address %s from %s', hostport, source, res)
            this.externalAddresses.set(hostport, external = {
                host, port,
                published: false,
                publishedItShouldBe: false,
                reportedBy: new Map([[ reporter, now ]]),
            })
        } else {
            if(!external.reportedBy.has(reporter))
                this.log('received confirmation for external address %s from %s', hostport, source, res)
            external.reportedBy.set(reporter, now)
        }
        return this.reevaluateExternalAddress(external)
    }
    private reevaluateExternalAddress(external: ExternalAddress): boolean {
        const now = Date.now()
        
        const reportedAtLast = external.reportedBy.values().reduce((accum, reportedAt) => Math.max(accum, reportedAt), 0)
        const reportsCount = 
            //external.reportedBy.values().reduce((accum, reportedAt) => accum + +((now - reportedAt) <= this.init.observationLifetime), 0)
            ((now - reportedAtLast) <= this.init.observationLifetime) ? external.reportedBy.size : 0
        return !external.publishedItShouldBe && (external.publishedItShouldBe = (
            reportsCount >= this.init.observationsCount
        ))
    }
    
    private peerRecord?: PeerRecord
    private signedPeerRecord?: RecordEnvelope
    private readonly onUpdate = async (/*{ detail: { peer } }: CustomEvent<PeerUpdate>*/) => {

        const options: AbortOptions | undefined = undefined
        const peerId = this.components.peerId
        const am = this.components.addressManager

        const { multiaddrs } = removePrivateAddressesMapper({
            id: peerId,
            multiaddrs: am.getAddresses().map(ma => {
                //return ma.decapsulateCode(protocols('p2p').code)
                return ma.decapsulate(multiaddr(`/p2p/${peerId.toString()}`))
            })
        })
        //this.log(this.multiaddrs.map(ma => ma.toString()), 'vs', multiaddrs.map(ma => ma.toString()))
        if(!this.multiaddrs_eq(multiaddrs)){
            this.multiaddrs = multiaddrs
            this.peerRecord = new PeerRecord({ peerId, multiaddrs, })
            this.signedPeerRecord = await RecordEnvelope.seal(this.peerRecord, this.privateKey, options)
            this.log('listening addresses have changed', multiaddrs.map(ma => ma.toString()))
            this.publish(true)
        }
    }

    private publishTimeout?: ReturnType<typeof setTimeout>
    private publish(all: boolean){
        clearTimeout(this.publishTimeout)
        this.publishTimeout = setTimeout(this.publish, this.init.republishInterval)

        if(!this.peerRecord || !this.signedPeerRecord){
            this.log('no addresses to publish')
            return
        }
        const recordsToUpdate = this.externalAddresses.entries()
            .filter(([, external]) => external.publishedItShouldBe && (all || !external.published)).toArray()        

        if(recordsToUpdate.length > 0){
            this.log('begin putting records for', recordsToUpdate.map(([hostport,]) => hostport))
        } else {
            this.log('no records to update')
            return
        }

        for(const [hostport, info] of recordsToUpdate){
            const { host, port } = info
            
            info.published = true

            this.discovery.dht.put({
                k: this.publicKey.raw,
                salt: ipPortToMultiaddr(host, port).bytes,
                seq: Number(this.peerRecord.seqNumber),
                v: this.signedPeerRecord.marshal(),
                sign: this.sign,
            }, (err: null|Error, hash: Buffer, n: number) => {
                if(n > 0) this.log('put record for %s on %d nodes', hostport, n)
                if(err) this.log.error('error putting record for %s - %e', hostport, err)
            })
        }
    }
}

//src: k-rpc/index.js
function parseNodes(buf: Buffer, idLength: number){
    const contacts = []
    try {
        for (let i = 0; i < buf.length; i += (idLength + 6)) {
            const port = buf.readUInt16BE(i + (idLength + 4))
            if (!port) continue
            contacts.push({
                id: buf.subarray(i, i + idLength),
                host: parseIp(buf, i + idLength),
                port: port,
                //distance: 0,
                //token: null
            })
        }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
        // do nothing
    }
    return contacts
}
function parseIp(buf: Buffer, offset: number = 0){
    return buf[offset++] + '.' + buf[offset++] + '.' + buf[offset++] + '.' + buf[offset++]
}

function shuffleInplace(array: unknown[]) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const temp = array[i]
        array[i] = array[j]
        array[j] = temp
    }
    return array
}
