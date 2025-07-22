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

const ms = 1
const s = 1000*ms
const m = 60*s
const h = 60*m

class DiscoveryServiceInit {
    infoHash!: string | Buffer

    // @libp2p/autonat-v2/src/client.ts:REQUIRED_SUCCESSFUL_DIALS
    observationsCount?: number = 4
    // libp2p/src/address-manager/index.ts:addressVerificationTTL
    observationLifetime?: number = 10*m
    // bittorrent.org/beps/bep_0044.html#expiration
    republishInterval?: number = 1*h
    //announce?: string[] = []
    
    //lookupInterval?: number
    resolutionLifetime?: number = Infinity
    resolutionRetriesMax?: number = 1
    resolutionRetryTimeout?: number = 1*m
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
const sign = (key: PrivateKey, data: Uint8Array) => {
    return key.sign(data)
}

type RPCPeer = { id: Buffer, host?: string, address?: string, port: number }
type RPCResponse = { ip?: Buffer, r?: { nodes?: Buffer, p?: number } }
//type RPCVisitCallback = (res: RPCResponse, peer: RPCPeer) => void
type RPCQueryCallback = (err: undefined | Error & { code: string }, res: RPCResponse, peer: RPCPeer) => void

type Bencoded = Buffer | string | number | { [key: number]: Bencoded } | { [key: string]: Bencoded }
type DHTGetReturnType = { v: Bencoded }

type HostPort = { host: string, port: number }
type ExternalAddress = {
    ipport: string // For debug log
    key: PrivateKey
    salt?: Uint8Array
    reportedBy: Map<string, number>
    shouldBePublished?: boolean
    publicationTimeout?: ReturnType<typeof setTimeout>
}
type ResolutionResult = {
    ipport: string // For debug log
    hash: Uint8Array
    retries?: number
    resolvedAt?: number
    retryTimeout?: ReturnType<typeof setTimeout>
}

class DiscoveryClass extends TypedEventEmitter<DiscoveryEvents> implements PeerDiscovery, PeerDiscoveryProvider, Startable {
    
    private discovery: Discovery
    private readonly init: Required<DiscoveryServiceInit>
    private readonly components: DiscoveryComponents
    private readonly log: Logger

    private readonly publicKey: PublicKey
    private readonly privateKey: PrivateKey
    
    private readonly externalAddresses = new Map<string, ExternalAddress>()
    private readonly resolutionResults = new Map<string, ResolutionResult>()
    private readonly resolutionQueue: ResolutionResult[] = []
    
    private multiaddrs: Multiaddr[] = []
    private multiaddrs_eq(to: Multiaddr[]){
        return this.multiaddrs.length === to.length && !this.multiaddrs.some(ma => !to.some(mb => ma.equals(mb)))
    }

    private peerRecord?: PeerRecord
    private signedPeerRecord?: RecordEnvelope

    public readonly [peerDiscoverySymbol] = this
    public readonly [Symbol.toStringTag] = '@libp2p/torrent-discovery'
    public readonly [serviceCapabilities]: string[] = [
      '@libp2p/peer-discovery'
    ]

    constructor(init: DiscoveryServiceInit, components: DiscoveryComponents){
        super()
        this.init = {
            ...new DiscoveryServiceInit(), ...init,
        } as Required<DiscoveryServiceInit>
        this.components = components
        this.log = components.logger.forComponent('libp2p:torrent-discovery')
        this.privateKey = privateKeyFromRaw(uint8ArrayFromString(KEY, 'base64pad'))
        this.publicKey = this.privateKey.publicKey
    }

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
        const findSelfQuery = {
            q: 'find_node',
            a: {
                id: rpc.id,
                target: rpc.id
            }
        }
        const queried = new Set<string>()
        const socket = rpc.socket
        const socket_query = socket.query
        socket.query = (peer: RPCPeer, query: Record<string, Bencoded>, cb?: RPCQueryCallback) => {
            const ipport = `${peer.host || peer.address}:${peer.port}`
            if(!queried.has(ipport)){
                queried.add(ipport)
                const query_a = query.a as Record<string, Bencoded>
                if(query.q === 'ping' || (query.q === 'find_node' && query_a.target === rpc.id)){
                    if(query.q === 'ping'){
                        //this.log('replacing ping with find_self query')
                        query = findSelfQuery
                    } else {
                        //this.log('sending single find_self query')
                    }
                    return socket_query.call(socket, peer, query, ((err, res, peer) => {
                        const ret = cb?.(err, res, peer)
                        if(!err) this.onReply(res, peer)
                        return ret
                    }) as RPCQueryCallback)
                } else {
                    //this.log('sending second find_self query')
                    const ret = socket_query.call(socket, peer, query, cb)
                    socket_query.call(socket, peer, findSelfQuery, ((err, res, peer) => {
                        if(!err) this.onReply(res, peer)
                    }) as RPCQueryCallback)
                    return ret
                }
            } else {
                return socket_query.call(socket, peer, query, cb)
            }
        }
        
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

        rpc.addListener('query', this.onReply)

        socket.addListener('update', this.resolutionQueue_kick)

        discovery.addListener('peer', this.onPeer)
        discovery.addListener('warning', this.onWarning)
        discovery.addListener('error', this.onError)

        this.components.events.addEventListener('self:peer:update', this.onUpdate)
    }

    public async stop() {
        if(!this.discovery) return
        const discovery = this.discovery
        this.discovery = undefined

        const rpc = discovery.dht._rpc
        rpc.removeListener('query', this.onReply)

        const socket = discovery.dht._rpc.socket
        socket.removeListener('update', this.resolutionQueue_kick)

        discovery.removeListener('peer', this.onPeer)
        discovery.removeListener('warning', this.onWarning)
        discovery.removeListener('error', this.onError)

        this.components.events.removeEventListener('self:peer:update', this.onUpdate)
        
        await new Promise<void>(res => discovery.destroy(() => res()))
    }

    private readonly onReply = (res: RPCResponse, peer: RPCPeer) => {
        //this.log('onReply', `${peer.host || peer.address}:${peer.port}`, res)
        const rpc = this.discovery.dht._rpc
        
        if(Buffer.isBuffer(res?.ip)){
            const node = parseIpPort(res.ip)
            const external = this.maybeAddExternalAddress(node, 'dht', res, peer)
            if(external) this.publish(external)
        }
        if(Buffer.isBuffer(res?.r?.nodes)){
            const nodes = parseNodes(res.r.nodes, rpc._idLength)
            for(const node of nodes){
                //this.log('onReply', `${node.host}:${node.port}`, node.id.toString('hex'), 'vs', rpc.id.toString('hex'))
                if(node.id.equals(rpc.id)){
                   const external = this.maybeAddExternalAddress(node, 'dht', res, peer)
                   if(external) this.publish(external)
                }
            }
        }
    }

    private readonly onPeer = async (ipport: string, source: 'tracker'|'dht'|'lsd') => {
        
        if(this.externalAddresses.has(ipport)){
            this.log('discovered self %s from %s', ipport, source)
            return
        } else {
            const now = Date.now()
            const result = this.resolutionResults.get(ipport)
            const resolvedAt = result?.resolvedAt
            if(result){
                if(resolvedAt === undefined){
                    this.log('discovered already resolving peer %s from %s', ipport, source)
                    return
                } else if((now - resolvedAt) <= this.init.resolutionLifetime){
                    this.log('discovered already resolved peer %s from %s', ipport, source)
                    return
                } else {
                    this.log('discovered expired peer %s from %s', ipport, source)
                }
            } else {
                this.log('discovered peer %s from %s', ipport, source)
            }
        }        

        const [ip, port]: [string, number] = addrToIPPort(ipport)
        const detail = ipPortToMultiaddr(ip, port)
        this.safeDispatchEvent('addr', { detail })

        const opts = {
            k: this.publicKey.raw,
            salt: detail.bytes,
        }
        const hash = this.discovery.dht._hash(Buffer.concat([opts.k, opts.salt]))
        
        const result: ResolutionResult = { ipport, hash }
        this.resolutionResults.set(ipport, result)
        this.resolutionQueue.push(result)
        this.resolutionQueue_kick()
    }
    private readonly resolutionQueue_kick = () => {
        const dht = this.discovery.dht
        const rpc = this.discovery.dht._rpc
        
        if(rpc.socket.inflight >= rpc.concurrency) return
        
        const result = this.resolutionQueue.pop()
        if(!result) return

        const { ipport, hash } = result

        dht.get(hash, { cache: false }, (err: Error, value: DHTGetReturnType) => {
            
            const fail = () => {
                result.retries ??= 0
                if(result.retries < this.init.resolutionRetriesMax){
                    this.log('setting retry timer')
                    result.retries++
                    result.retryTimeout = setTimeout(() => {
                        this.resolutionQueue.unshift(result)
                    }, this.init.resolutionRetryTimeout)
                } else {
                    this.log('max retries reached - forcefully resolving')
                    result.resolvedAt = Date.now()
                }
            }
            
            if(err){
                this.log('error getting record for %s - %e', ipport, err)
                return fail()
            } else if(value && Buffer.isBuffer(value.v)){
                const buf = value.v
                this.components.peerStore.consumePeerRecord(buf).then(() => {
                    this.log('consumed peer record for %s', ipport)
                    result.resolvedAt = Date.now()
                }).catch((reason) => {
                    this.log('received invalid peer record for %s - %e', ipport, reason)
                    return fail()
                })
            } else {
                this.log('error getting record for %s - no value provided or its not a buffer', ipport)
                return fail()
            }
        })
    }

    private readonly onWarning = (err: Error) => {
        this.log.error('warning', err)
    }
    private readonly onError = (err: Error) => {
        this.log.error('error', err)
    }
    
    private maybeAddExternalAddress(info: HostPort, source: string, res: object, peer: RPCPeer){
        const now = Date.now()
        const { host, port } = info
        const ipport = `${host}:${port}`
        const reporter = `${(peer.address || peer.host)!}:${peer.port}`
        
        let external = this.externalAddresses.get(ipport)
        if(!external){
            this.log('discovered new external address %s from %s', ipport, source)
            external = {
                ipport,
                key: this.privateKey,
                salt: ipPortToMultiaddr(host, port).bytes,
                reportedBy: new Map([[ reporter, now ]]),
            }
            this.externalAddresses.set(ipport, external)
        } else {
            if(!external.reportedBy.has(reporter))
                this.log('received confirmation for external address %s from %s', ipport, source)
            external.reportedBy.set(reporter, now)
        }
        return this.reevaluateExternalAddress(external) ? external : undefined
    }
    private reevaluateExternalAddress(external: ExternalAddress): boolean {
        const now = Date.now()
        
        //const reportedAtLast = external.reportedBy.values().reduce((accum, reportedAt) => Math.max(accum, reportedAt), 0)
        const reportsCount = 
            external.reportedBy.values().reduce((accum, reportedAt) => accum + +((now - reportedAt) <= this.init.observationLifetime), 0)
            //((now - reportedAtLast) <= this.init.observationLifetime) ? external.reportedBy.size : 0
        return !external.shouldBePublished && (external.shouldBePublished = (
            reportsCount >= this.init.observationsCount
        ))
    }
    
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
            for(const external of this.externalAddresses.values())
                this.publish(external)
        }
    }

    private publish(external: ExternalAddress){
        const { ipport } = external
        
        clearTimeout(external.publicationTimeout)
        
        if(!this.peerRecord || !this.signedPeerRecord){
            this.log('no addresses to publish')
            return
        }       
        
        this.log('begin putting records for', ipport)
        
        external.publicationTimeout = setTimeout(() => this.publish(external), this.init.republishInterval)

        this.discovery.dht.put({
            k: external.key.publicKey.raw,
            salt: external.salt,
            seq: Number(this.peerRecord.seqNumber),
            v: this.signedPeerRecord.marshal(),
            sign: sign.bind(null, external.key),
        }, (err: null|Error, hash: Buffer, n: number) => {
            if(n > 0) this.log('put record for %s on %d nodes', ipport, n)
            if(err) this.log.error('error putting record for %s - %e', ipport, err)
        })
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
function parseIpPort(buf: Buffer): HostPort {
    return { host: parseIp(buf, 0), port: buf.readUInt16BE(4) }
}
