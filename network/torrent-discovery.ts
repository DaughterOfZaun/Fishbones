import { privateKeyFromRaw, publicKeyFromRaw } from '@libp2p/crypto/keys'
import { AbortError, TypedEventEmitter, peerDiscoverySymbol, serviceCapabilities } from '@libp2p/interface'
import type { ComponentLogger, Libp2pEvents, Logger, PeerDiscovery, PeerDiscoveryEvents, PeerDiscoveryProvider, PeerId, PeerStore, PrivateKey, Startable, TypedEventTarget } from '@libp2p/interface'
import type { AddressManager, TransportManager } from '@libp2p/interface-internal'
import { CODE_P2P, CODE_P2P_CIRCUIT, multiaddr, type Multiaddr } from '@multiformats/multiaddr'

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
const KEY_STRING = 'Z3z1776YR5Mz+EkkZOZ2VB7kUNSCm6syviHz1++589Vz4+INeC6EKD2RaDmaP9uVr5FssMaHKed7KlC5wE/+GA=='
const STATIC_KEY = privateKeyFromRaw(uint8ArrayFromString(KEY_STRING, 'base64pad'))
const STATIC_SALT = Buffer.from([0, 0, 0, 0, 0, 0])
const ABORT_ERROR = new AbortError()
const OK = new Error('OK')
const MAX_DATE = 8_640_000_000_000_000

//@ts-expect-error: Could not find a declaration file for module 'k-rpc'
import KRPC from 'k-rpc'
//@ts-expect-error: Could not find a declaration file for module 'k-rpc-socket'
import type KRPCSocket from 'k-rpc-socket'

import { createSocket, isDHT, type Socket } from '../network/umplex'
import { equals as uint8ArrayEquals } from 'uint8arrays'
import { peerIdFromCID } from '@libp2p/peer-id'
import { getThinWaistAddresses } from '@libp2p/utils/get-thin-waist-addresses'
import { isUint8Array } from 'node:util/types'
//import { isPrivateIp } from '@libp2p/utils/private-ip'

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

class TorrentPeerDiscoveryInit {
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

    filterCircuits?: boolean = true
    derive!: DeriveFunc
}

interface TorrentPeerDiscoveryComponents {
    peerId: PeerId
    privateKey: PrivateKey
    logger: ComponentLogger
    events: TypedEventTarget<Libp2pEvents>
    peerStore: PeerStore
    addressManager: AddressManager
    transportManager: TransportManager
}

interface TorrentPeerDiscoveryEvents extends PeerDiscoveryEvents {
    addr: CustomEvent<Multiaddr[]>
    record: CustomEvent<PeerId>
}

export function torrentPeerDiscovery(init: TorrentPeerDiscoveryInit): (components: TorrentPeerDiscoveryComponents) => TorrentPeerDiscovery {
    return (components: TorrentPeerDiscoveryComponents) => new TorrentPeerDiscovery(init, components)
}

const verify = (signature: Uint8Array, data: Uint8Array, publicKeyRaw: Uint8Array) => {
    const publicKey = publicKeyFromRaw(publicKeyRaw)
    const ret = publicKey.verify(data, signature)
    //console.log('verify', signature, data, publicKeyRaw, ret)
    return ret === true //HACK:
}

type RPCPeer = { id: Buffer, host?: string, address?: string, port: number }
type RPCResponse = {
    ip?: Buffer,
    r?: { id?: Buffer, nodes?: Buffer, p?: number },
    a?: { id?: Buffer }
}
//type RPCVisitCallback = (res: RPCResponse, peer: RPCPeer) => void
type RPCQueryCallback = (err: null | Error & { code?: string }, res: RPCResponse, peer: RPCPeer) => void

type Bencoded = Uint8Array | string | number | { [key: number]: Bencoded } | { [key: string]: Bencoded }
type DHTGetReturnType = { v: Bencoded }

type u = undefined
type HostPort = { host: string, port: number }
type DeriveFunc = ({ host, port }: HostPort) => Multiaddr[]
type ExternalAddress = {
    ipport: string // For debug log
    key: PrivateKey
    salt: Uint8Array
    reportedBy: Map<string, number>
    
    shouldBePublished?: boolean
    recheckTimeout?: u|ReturnType<typeof setTimeout>
    republishTimeout?: u|ReturnType<typeof setTimeout>
    
    hostport?: Parameters<DeriveFunc>[0]
    derived?: ReturnType<DeriveFunc>
    multiaddr?: Multiaddr
}
type ResolutionResult = {
    ipport: string // For debug log
    hash: Uint8Array
    salt: Uint8Array
    retries?: number
    resolvedAt?: number
    resolvedHash?: Uint8Array
    retryTimeout?: u|ReturnType<typeof setTimeout>
}

export type { TorrentPeerDiscovery }
class TorrentPeerDiscovery extends TypedEventEmitter<TorrentPeerDiscoveryEvents> implements PeerDiscovery, PeerDiscoveryProvider, Startable {
    
    private discovery: Discovery
    private readonly init: Required<TorrentPeerDiscoveryInit>
    private readonly components: TorrentPeerDiscoveryComponents
    private readonly log: Logger

    private readonly externalAddress: ExternalAddress
    private readonly externalAddresses = new Map<string, ExternalAddress>()
    private readonly resolutionResults = new Map<string, ResolutionResult>()
    private readonly resolutionQueue: ResolutionResult[] = []
    private readonly knownIds = new Map<string, Uint8Array>()
    
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

    constructor(init: TorrentPeerDiscoveryInit, components: TorrentPeerDiscoveryComponents){
        super()
        this.init = {
            ...new TorrentPeerDiscoveryInit(), ...init,
        } as Required<TorrentPeerDiscoveryInit>
        this.components = components
        this.log = components.logger.forComponent('libp2p:torrent-discovery')
        
        const zeroedIP = '000.000.000.000:0000'
        this.externalAddress = {
            ipport: zeroedIP,
            key: this.components.privateKey,
            salt: STATIC_SALT,
            reportedBy: new Map(),
            shouldBePublished: true,
        }
        this.externalAddresses.set(zeroedIP, this.externalAddress)
    }

    public start() {
        if(this.discovery) return

        const hash = sha1
        const hashLength = hash(Buffer.from('')).length
        const opts = {
            k: this.components.privateKey.publicKey.raw,
            salt: STATIC_SALT,
        }
        const publicKeyHash = hash(Buffer.concat([opts.k, opts.salt]))

        const optsDHT: DHTInit = {
            socket: createSocket({ type: 'udp4', filter: isDHT }),
            nodeId: publicKeyHash,
            id: publicKeyHash,
            bootstrap: true,
            verify,
            hash,
        }
        let portGetsCount = 0 //HACK: To bypass opts.port check
        const optsDiscovery: DiscoveryInit = {
            get port(){ return (portGetsCount++) ? 0 : 5116 },
            dhtPort: 0,
            tracker: false,
            lsd: false,

            infoHash: this.init.infoHash,
            peerId: publicKeyHash,
            userAgent: USER_AGENT,
            dht: optsDHT,
        }

        const rpc = optsDHT.krpc = new KRPC({ idLength: hashLength, ...optsDHT } as KRPCInit)
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
            
            //console.log('query', query.q, ipport)

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
        
        const discovery = new Discovery(optsDiscovery)
        this.discovery = discovery

        const { dht } = discovery
        const dht__debug = dht._debug
        dht._debug = (...args: unknown[]) => {
            if(args[0] !== 'received ping')
                return dht__debug.apply(dht, args)
        }

        const runningGets = new Map<string, (err: null | Error, n: number) => void>
        const dht__closest = dht._closest
        dht._closest = (
            target: Buffer,
            message: Record<string, Bencoded>,
            onmessage?: null | ((message: Record<string, Bencoded>, peer: RPCPeer) => boolean),
            cb?: null | ((err: null | Error, n: number) => void)
        ): void => {
            let onMessagePatched = onmessage
            let cbPatched = cb
            const message_a = message.a as { target: Buffer }
            if(message.q === 'get' && !onmessage && cb){
                const key = message_a.target
                const keyStr = key.toHex()
                const prevCb = runningGets.get(keyStr)
                      prevCb?.(ABORT_ERROR, 0)
                runningGets.set(keyStr, cb)
                cbPatched = function(this: unknown, err, n){
                    const cb = runningGets.get(keyStr)
                    runningGets.delete(keyStr)
                    cb!.call(this, err ?? null, n)
                }
                if(prevCb) return
            }
            if(message.q === 'get' && onmessage && cb){
                onMessagePatched = function(this: unknown, message, peer){
                    const ret = onmessage.call(this, message, peer)
                    cb.call(this, null, 0)
                    return ret
                }
                cbPatched = function(this: unknown, err, n){
                    if(err){
                        cb.call(this, err, n)
                    } else {
                        cb.call(this, null, n)
                        cb.call(this, OK, n)
                    }
                }
            }
            dht__closest.call(dht, target, message, onMessagePatched, cbPatched)
        }
        
        //rpc.addListener('node', this.onNode)
        rpc.addListener('query', this.onReply)

        //socket.addListener('update', this.resolutionQueue_kick)

        discovery.addListener('peer', this.onPeer)
        discovery.addListener('warning', this.onWarning)
        discovery.addListener('error', this.onError)

        this.components.events.addEventListener('self:peer:update', this.onUpdate)

        //this.onUpdate()
    }

    public async stop() {
        if(!this.discovery) return
        const discovery = this.discovery
        this.discovery = undefined

        const rpc = discovery.dht._rpc
        //rpc.removeListener('node', this.onNode)
        rpc.removeListener('query', this.onReply)

        //const socket = discovery.dht._rpc.socket
        //socket.removeListener('update', this.resolutionQueue_kick)

        discovery.removeListener('peer', this.onPeer)
        discovery.removeListener('warning', this.onWarning)
        discovery.removeListener('error', this.onError)

        this.components.events.removeEventListener('self:peer:update', this.onUpdate)

        for(const external of this.externalAddresses.values()){
            clearTimeout(external.republishTimeout)
            external.republishTimeout = undefined
        }
        
        await new Promise<void>(res => discovery.destroy(() => res()))
    }

    private readonly onNode = (peer: RPCPeer, res?: RPCResponse) => {
        
        peer.id ||= (res?.r?.id || res?.a?.id)!
        if(!peer.id || (!peer.address && !peer.host) || !peer.port) return

        const ipport = `${peer.host || peer.address}:${peer.port}`
        //this.log('onNode', !!res, ipport, Buffer.from(peer.id).toString('hex'))
        this.knownIds.set(ipport, peer.id)

        /*
        //TODO: Safe-switch & compare hash with resolvedHash.
        const result = this.resolutionResults.get(ipport)
        if(result && result.salt !== STATIC_SALT){
            this.log('switching %s to strategy B', ipport)
            result.salt = STATIC_SALT
            result.hash = peer.id
        }
        */
    }

    private readonly onReply = (res: RPCResponse, peer: RPCPeer) => {
        if(!this.discovery) return

        //this.log('onReply', `${peer.host || peer.address}:${peer.port}`, res)
        const rpc = this.discovery.dht._rpc
        
        this.onNode(peer, res)

        if(ArrayBuffer.isView(res?.ip)){
            const node = parseIpPort(res.ip)
            this.maybeAddAndPublishExternalAddress(node, 'dht', res, peer)
        }
        if(ArrayBuffer.isView(res?.r?.nodes)){
            const nodes = parseNodes(res.r.nodes, rpc._idLength)
            for(const node of nodes){
                //this.log('onReply', `${node.host}:${node.port}`, node.id.toString('hex'), 'vs', rpc.id.toString('hex'))
                if(node.id.equals(rpc.id)){
                    this.maybeAddAndPublishExternalAddress(node, 'dht', res, peer)
                } else {
                    this.onNode(node)
                }
            }
        }
    }

    private readonly onPeer = (ipport: string, source: 'tracker'|'dht'|'lsd') => {
        if(!this.discovery) return
        
        const dht = this.discovery.dht

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

        const [host, port]: [string, number] = addrToIPPort(ipport)
        const derived = this.init.derive({ host, port })

        ////@ts-expect-error Argument of type A is not assignable to parameter of type B.
        //this.components.events.safeDispatchEvent('addr:discovery', { detail: derived })
        this.safeDispatchEvent('addr', { detail: derived })

        let result: ResolutionResult
        const hash = this.knownIds.get(ipport)
        if(!hash){
            this.log('using strategy A against %s', ipport)
            const salt = encodePeer(host, port)
            const opts = { salt, k: STATIC_KEY.publicKey.raw }
            const hash = dht._hash(Buffer.concat([opts.k, opts.salt]))
            result = { ipport, hash, salt }
        } else {
            this.log('using strategy B against %s', ipport)
            result = { ipport, hash, salt: STATIC_SALT }
        }
        
        this.resolutionResults.set(ipport, result)
        this.resolutionQueue.push(result)
        this.resolutionQueue_kick()
    }
    private readonly resolutionQueue_kick = () => {
        if(!this.discovery) return

        const dht = this.discovery.dht
        //const rpc = this.discovery.dht._rpc
        //if(rpc.socket.inflight >= rpc.concurrency) return
        
        const result = this.resolutionQueue.pop()
        if(!result) return

        const { ipport, hash, salt } = result

        const fail = () => {
            result.retries ??= 0
            if(result.retries < this.init.resolutionRetriesMax){
                this.log('setting retry timer')
                result.retries++
                result.retryTimeout = setTimeout(() => {
                    result.retryTimeout = undefined
                    this.resolutionQueue.unshift(result)
                    this.resolutionQueue_kick()
                }, this.init.resolutionRetryTimeout)
            } else {
                this.log('max retries reached - forcefully resolving')
                result.resolvedAt = Date.now()
            }
        }

        let foundValueBuffer = false
        let foundValidRecord = false
        const consumingErrors: unknown[] = []
        let prevValue: null | DHTGetReturnType = null
        dht.get(hash, { salt, cache: false }, (err: null | Error, value: DHTGetReturnType) => {
            /*
            this.log(
                'get', ipport,
                err ? (err === OK) ? 'OK' : 'Error' : 'None',
                value ? (value === prevValue) ? 'Prev' : 'New' : 'None',
                foundValueBuffer, foundValidRecord, consumingErrors.length === 0
            )
            */
            if(err){
                if(err !== OK){
                    this.log('error getting record for %s - %e', ipport, err)
                    return fail()
                } else if(!foundValueBuffer){
                    this.log('error getting record for %s - no value provided or its not a buffer', ipport)
                    return fail()
                } else if(!foundValidRecord){
                    this.log('received invalid peer record for %s - %e', ipport, consumingErrors[0])
                    return fail()
                }
            } else if(prevValue === (prevValue = value)){
                // Do nothing.
            } else if(value && ArrayBuffer.isView(value.v)){
                foundValueBuffer = true
                const buf = value.v
                
                Promise.resolve().then(async () => {
                    //src: @libp2p/peer-store/src/index.ts
                    const options = {}
                    const envelope = await RecordEnvelope.openAndCertify(buf, PeerRecord.DOMAIN, options)
                    
                    const hash = sha1
                    const opts = { k: envelope.publicKey.raw, salt: STATIC_SALT }
                    result.resolvedHash = hash(Buffer.concat([opts.k, opts.salt]))
                    
                    if(result.salt === STATIC_SALT && !uint8ArrayEquals(result.hash, result.resolvedHash)){
                        this.log('peer record public key hash mismatch')
                        return false
                    }

                    const peerId = peerIdFromCID(envelope.publicKey.toCID())    
                    this.safeDispatchEvent('record', { detail: peerId })

                    const success = await this.components.peerStore.consumePeerRecord(buf)
                    if(success){
                        this.log('consumed peer record for %s %p', ipport, peerId)
                        //const peerRecord = PeerRecord.createFromProtobuf(envelope.payload) //TODO: Optimize.
                        //const info: PeerInfo = { id: peerId, multiaddrs: peerRecord.multiaddrs }
                        //this.safeDispatchEvent('record', { detail: info })
                    }
                    return success
                }).then(success => {
                    if(!success) return
                    foundValidRecord = true
                    result.resolvedAt = Date.now()
                }).catch((reason) => {
                    consumingErrors.push(reason)
                })
            }
        })
    }

    private readonly onWarning = (err: Error) => {
        this.log.error('warning', err)
    }
    private readonly onError = (err: Error) => {
        this.log.error('error', err)
    }
    
    private maybeAddAndPublishExternalAddress(hostport: HostPort, source: string, res: object, peer: RPCPeer){
        const now = Date.now()
        const { host, port } = hostport
        const ipport = `${host}:${port}`
        const reporter = `${(peer.address || peer.host)!}:${peer.port}`

        //if(isPrivateIp(host) === true) return

        let external = this.externalAddresses.get(ipport)
        if(!external){
            this.log('discovered new external address %s from %s', ipport, source)
            external = {
                ipport,
                key: STATIC_KEY,
                salt: encodePeer(host, port),
                reportedBy: new Map([[ reporter, now ]]),
                hostport: hostport,
            }
            this.externalAddresses.set(ipport, external)
        } else {
            if(!external.reportedBy.has(reporter))
                this.log.trace('received confirmation for external address %s from %s', ipport, source)
            external.reportedBy.set(reporter, now)
        }

        this.check(external)
    }

    private check(external: ExternalAddress){
        if(!this.discovery) return

        const am = this.components.addressManager
        const now = Date.now()

        let reportsCount = 0
        let lastReportedAt = 0
        for(const reportedAt of external.reportedBy.values()){
            if((now - reportedAt) <= this.init.observationLifetime){
                lastReportedAt = Math.max(lastReportedAt, reportedAt)
                reportsCount++
            }
        }

        const prevShouldBePublished = external.shouldBePublished
        const newShouldBePublished = external.shouldBePublished
            = reportsCount >= this.init.observationsCount

        if(newShouldBePublished && !prevShouldBePublished){ // new & !prev - Add.

            this.log.trace('setting addr %s for publication', external.ipport)

            //ref: @libp2p/tcp/src/listener.ts/getAddrs
            const socket: Socket = this.discovery.dht._rpc.socket.socket
            const { address: lhost, port: lport } = socket.address()
            const listeningMultiaddr = multiaddr(`/ip4/${lhost}/udp/${lport}`)
            const listeningAddrs = getThinWaistAddresses(listeningMultiaddr)
            
            const { host: ehost, port: eport } = external.hostport!
            external.multiaddr ??= multiaddr(`/ip4/${ehost}/udp/${eport}`)
            
            //ref: libp2p/src/address-manager/index.ts/confirmObservedAddr
            //ref: libp2p/src/address-manager/index.ts/maybeUpgradeToIPMapping
            const filteredListeningAddrs = listeningAddrs
                .map(ma => ma.toOptions())
                .filter(opts => opts.host !== '127.0.0.1')
            
            //this.log('external:', external.multiaddr)
            //this.log('listening:', listeningMultiaddr)
            //this.log('listening:', listeningAddrs)
            //this.log('filtered:', filteredListeningAddrs)
            
            if(filteredListeningAddrs.length === 1){
                this.log('adding public addr mapping')

                const internalAddr = filteredListeningAddrs[0]!
                const { host: ihost, port: iport } = internalAddr

                //am['ipMappings']['add'](ihost, iport, ehost, eport, 'udp')
                //am['ipMappings']['confirm'](external.multiaddr, MAX_DATE - now)
                //am['_updatePeerStoreAddresses']()
                //console.log('addresses with metadata:', am.getAddressesWithMetadata())

                am.addPublicAddressMapping(ihost, iport, ehost, eport, 'udp')
                am.confirmObservedAddr(external.multiaddr, {
                    type: 'ip-mapping', ttl: MAX_DATE - now
                })
            } else if(external.hostport){
                this.log('adding observed addr')

                external.derived ??= this.init.derive(external.hostport)
                for(const derivedMultiaddr of external.derived){
                    am.addObservedAddr(derivedMultiaddr)
                    am.confirmObservedAddr(derivedMultiaddr, {
                        type: 'observed', ttl: MAX_DATE - now
                    })
                }
            }

            external.recheckTimeout = setTimeout(
                () => this.check(external),
                this.init.observationLifetime
            )
        } else if(newShouldBePublished){ // new & prev - Update.
            
            this.log.trace('updating addr %s publication timer', external.ipport)

            clearTimeout(external.recheckTimeout)
            external.recheckTimeout = setTimeout(
                () => this.check(external),
                this.init.observationLifetime - (now - lastReportedAt),
            )
        } else if(prevShouldBePublished) { // !new & prev - Remove.
            
            this.log.trace('removing addr %s from publication', external.ipport)

            const { host: ehost, port: eport } = external.hostport!
            //external.multiaddr ??= multiaddr(`/ip4/${ehost}/udp/${eport}`)

            am.removePublicAddressMapping('undefined', NaN, ehost, eport, 'udp')
            if(external.hostport){
                external.derived ??= this.init.derive(external.hostport)
                for(const derivedMultiaddr of external.derived){
                    am.removeObservedAddr(derivedMultiaddr)
                }
            }

            clearTimeout(external.recheckTimeout)
            external.recheckTimeout = undefined
        }
    }
    
    //TODO: Split into three functions: onSelfUpdate(), onExternalUpdate(external, force), publishAll().
    private readonly onUpdate = (/*{ detail: { peer } }: CustomEvent<PeerUpdate>*/) => {

        const options = undefined
        const peerId = this.components.peerId
        const am = this.components.addressManager
        const tm = this.components.transportManager

        let { multiaddrs } = removePrivateAddressesMapper({ id: peerId, multiaddrs: am.getAddresses() })
        if(this.init.filterCircuits){
            const transports = tm.getTransports().filter(transport => transport.constructor.name !== 'CircuitRelayTransport')
            multiaddrs = multiaddrs.filter(ma => {
                const decapsulated = ma.decapsulateCode(CODE_P2P_CIRCUIT)
                return transports.some(transport => transport.dialFilter([ decapsulated ]).length)
            })
        }
        multiaddrs = multiaddrs.map(ma => ma.decapsulateCode(CODE_P2P))
        
        const filteredExternalAddresses = this.externalAddresses.values()
        .filter(external => external.shouldBePublished)
        .toArray()
        /*
        for(const external of filteredExternalAddresses){
            const { hostport } = external
            if(!external.derived && hostport){
                external.derived = derive(hostport)
            }
        }
        const derived = filteredExternalAddresses
        .flatMap(external => external.derived ?? [])
        multiaddrs.unshift(...derived) //TODO: Deduplicate.
        */
        //this.log('self:peer:update', am.getAddresses().map(ma => ma.toString()), 'vs', multiaddrs.map(ma => ma.toString()), 'vs', this.multiaddrs.map(ma => ma.toString()),)
        if(!this.multiaddrs_eq(multiaddrs) || !this.peerRecord || !this.signedPeerRecord){
            this.multiaddrs = multiaddrs
            
            this.log('listening addresses have changed', multiaddrs.map(ma => ma.toString()))
            
            this.peerRecord = new PeerRecord({ peerId, multiaddrs, })
            RecordEnvelope.seal(this.peerRecord, this.components.privateKey, options).then(signedPeerRecord => {
                this.signedPeerRecord = signedPeerRecord
                for(const external of filteredExternalAddresses)
                    this.maybePublishExternalAddress(external)
            }).catch(err => {
                this.log.error('error sealing record - %e', err)
            })
        }
    }

    private maybePublishExternalAddress(external: ExternalAddress){
        if(!this.discovery) return
        
        const dht = this.discovery.dht
        const { ipport } = external
        
        clearTimeout(external.republishTimeout)
        external.republishTimeout = undefined

        if(!external.shouldBePublished){
            return
        }
        if(!this.peerRecord || !this.signedPeerRecord){
            this.log('no addresses to publish')
            return
        }       
        
        this.log('begin putting records for', ipport)
        
        external.republishTimeout = setTimeout(
            () => this.maybePublishExternalAddress(external),
            this.init.republishInterval
        )

        const opts = {
            k: external.key.publicKey.raw,
            salt: external.salt,
            seq: Number(this.peerRecord.seqNumber),
            v: this.signedPeerRecord.marshal(),
            sign: (data: Uint8Array) => {
                const ret = external.key.sign(data) as Uint8Array
                //console.log('sign', Buffer.from(data).toString('hex'), Buffer.from(ret).toString('hex'))
                return ret
            },
        }

        const hash = dht._hash(Buffer.concat([opts.k, opts.salt]))
        this.abortQueries('put', hash)

        dht.put(opts, (err: null|Error, hash: Buffer, n: number) => {
            if(err === ABORT_ERROR) this.log.error('failed to put record for %s - previous operation aborted', ipport)
            else if(err) this.log.error('failed to put record for %s - %e', ipport, err)
            else this.log('put record for %s on %d nodes', ipport, n)
        })
    }

    private abortQueries(q: string, hash: Buffer){
        if(!this.discovery) return

        const rpc = this.discovery.dht._rpc

        let abortedPending = 0
        const pending: [RPCPeer, Record<string, Bencoded>, RPCQueryCallback][] = rpc.pending
        for(let i = pending.length - 1; i >= 0; i--){
            const [/*node*/, message, cb] = pending[i]!
            //@ts-expect-error Property A does not exist on type B.
            if(message.q === q && message.a?.target && isUint8Array(message.a.target) && uint8ArrayEquals(message.a.target, hash)){
                cb(ABORT_ERROR, null!, null!)
                pending.splice(i, 1)
                abortedPending++
            }
        }
        
        let abortedInflight = 0
        const socket = rpc.socket
        const reqs: (null | {
            ttl: number,
            peer: RPCPeer,
            message: Record<string, Bencoded>,
            callback: RPCQueryCallback
        })[] = socket._reqs
        for(const [/*index*/, req] of reqs.entries()){
            if(!req) continue
            const { message } = req
            //@ts-expect-error Property A does not exist on type B.
            if(message.q === q && message.a?.target && isUint8Array(message.a.target) && uint8ArrayEquals(message.a.target, hash)){
                //socket._ids[index] = 0
                //socket._reqs[index] = null
                //socket.inflight--
                req.callback(ABORT_ERROR, null!, null!)
                req.callback = () => rpc.concurrency--
                rpc.concurrency++
                abortedInflight++
            }
        }
        if(abortedInflight > 0){
            socket.emit('update')
            socket.emit('postupdate')
        }

        if(abortedPending > 0 || abortedInflight > 0)
            this.log('aborted %d pending %d inflight %s queries', abortedPending, abortedInflight, q)
    }
}

//TODO: parseNodes6

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

//src: bittorrent-dht/client.js
function encodePeer(host: string, port: number){
    const buf = Buffer.allocUnsafe(6)
    const ip = host.split('.')
    for (let i = 0; i < 4; i++)
        buf[i] = parseInt(ip[i] || '0', 10)
    buf.writeUInt16BE(port, 4)
    return buf
}