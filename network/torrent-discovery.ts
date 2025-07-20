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

//import crypto from 'crypto'
//function sha1 (buf: Buffer) {
//    return crypto.createHash('sha1').update(buf).digest()
//}

const VERSION = '2.6.7'
//import { version as VERSION } from 'webtorrent/package.json'
const USER_AGENT = `WebTorrent/${VERSION} (https://webtorrent.io)`
//TODO: Pass via Init
const KEY = 'Z3z1776YR5Mz+EkkZOZ2VB7kUNSCm6syviHz1++589Vz4+INeC6EKD2RaDmaP9uVr5FssMaHKed7KlC5wE/+GA=='

import type { BinaryLike } from 'node:crypto'
//@ts-expect-error: Could not find a declaration file for module 'k-rpc'
import type KRPC from 'k-rpc'
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

interface DiscoveryServiceInit {
    infoHash: string | Buffer
    findSelfInterval?: number
    republishInterval?: number
    observationLifetime?: number
    observationsCount?: number
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
        == true //HACK:
}
/*
const sign = (data: Uint8Array, publicKeyRaw: Uint8Array, privateKeyRaw: Uint8Array) => {
    const privateKey = privateKeyFromRaw(uint8ArrayConcat([
        privateKeyRaw, publicKeyRaw,
    ]))
    return privateKey.sign(data)
}
*/

type RPCPeer = { host?: string, address?: string, port: number }
type RPCResponse = { r: { nodes?: Buffer } }
type RPCVisitCallback = (res: RPCResponse, peer: RPCPeer) => void

type HostPort = { host: string, port: number }
type ExternalAddress = HostPort & {
    reportedBy: Map<string, number>
    publishedItShouldBe: boolean
    published: boolean
}

class DiscoveryClass extends TypedEventEmitter<DiscoveryEvents> implements PeerDiscovery, PeerDiscoveryProvider, Startable {
    
    private discovery: Discovery
    private readonly init: Required<DiscoveryServiceInit>
    private readonly components: DiscoveryComponents
    private readonly log: Logger

    private readonly publicKey: PublicKey
    private readonly privateKey: PrivateKey
    private sign = (data: Uint8Array) => {
        return this.privateKey.sign(data)
    }
    
    constructor(init: DiscoveryServiceInit, components: DiscoveryComponents){
        super()
        this.init = {
            findSelfInterval: 1/*m*/ * 60/*s*/ * 1000/*ms*/,
            republishInterval: 1/*h*/ * 60/*m*/ * 60/*s*/ * 1000/*ms*/,
            observationLifetime: 30/*m*/ * 60/*s*/ * 1000/*ms*/,
            observationsCount: 3,
            ...init,
        }
        this.components = components
        this.log = components.logger.forComponent('libp2p:torrent-discovery')
        this.privateKey = privateKeyFromRaw(uint8ArrayFromString(KEY, 'base64pad'))
        this.publicKey = this.privateKey.publicKey
    }

    public readonly [peerDiscoverySymbol] = this
    public readonly [Symbol.toStringTag] = '@libp2p/torrent-discovery'
    public readonly [serviceCapabilities]: string[] = [
      '@libp2p/peer-discovery'
    ]

    public start() {
        if(this.discovery) return

        const init: DiscoveryInit = {
            port: 0,
            dhtPort: 0,
            tracker: false,
            lsd: false,

            infoHash: this.init.infoHash,
            peerId: this.components.peerId.toString(),
            userAgent: USER_AGENT,
            dht: {
                socket: createSocket({ type: 'udp4', filter: isDHT }),
                //bootstrap: false,
                verify,
            },
        }

        process.browser = true //HACK: To bypass opts.port check
        const discovery = new Discovery(init)
        process.browser = false
        this.discovery = discovery

        const rpc = discovery.dht._rpc
        const rpc__closest = rpc._closest
        rpc._closest = (target: unknown, message: unknown, background: unknown, visit: RPCVisitCallback, cb: unknown) => {
            const patchedVisit = (!visit || visit === this.onReply) ? this.onReply : (res: RPCResponse, peer: RPCPeer) => {
                const ret = visit(res, peer)
                this.onReply(res, peer)
                return ret
            }
            rpc__closest.call(rpc, target, message, background, patchedVisit, cb)
        }

        discovery.addListener('peer', this.onPeer)
        discovery.addListener('warning', this.onWarning)
        discovery.addListener('error', this.onError)

        this.components.events.addEventListener('self:peer:update', this.onUpdate)

        discovery.dht.once('ready', () => {
            this.findSelfTimeout = setTimeout(this.findSelf, this.init.findSelfInterval)
            this.publish(true)
        })
    }

    public stop() {
        if(!this.discovery) return
        const discovery = this.discovery
        this.discovery = undefined

        discovery.removeListener('peer', this.onPeer)
        discovery.removeListener('warning', this.onWarning)
        discovery.removeListener('error', this.onError)

        this.components.events.removeEventListener('self:peer:update', this.onUpdate)
        
        clearTimeout(this.publishTimeout)
        clearTimeout(this.findSelfTimeout)
        
        return new Promise<void>(res => discovery.destroy(() => res()))
    }

    private findSelfTimeout?: ReturnType<typeof setTimeout>
    private findSelf = () => {
        if(!this.discovery) return
        
        clearTimeout(this.findSelfTimeout)
        
        const rpc = this.discovery.dht._rpc
        const msg = {
            q: 'find_node',
            a: {
                id: rpc.id,
                target: rpc.id
            }
        }
        
        this.log('begin finding self')

        rpc._closest(rpc.id, msg, true, this.onReply, done)
        //rpc.populate(rpc.id, msg, done)
        //rpc.closest(rpc.id, msg, this.onreply, done.bind(this))
        //rpc.queryAll()
        
        function done(this: DiscoveryClass, err?: Error){
            if(err) this.log('error finding self - %e', err)
            else this.log('done finding self')
            this.findSelfTimeout = setTimeout(this.findSelf, this.init.findSelfInterval)
        }
    }

    private onReply = (res: RPCResponse, peer: RPCPeer) => {
        const rpc = this.discovery.dht._rpc

        const r = res && res.r
        const nodes = r.nodes ? parseNodes(r.nodes, rpc._idLength) : []
        let foundNewExtAddr = false
        for(const node of nodes){
            //this.log('onreply', `${node.host}:${node.port}`, node.id.toString('hex'), 'vs', rpc.id.toString('hex'))
            if(node.id.equals(rpc.id)){
                foundNewExtAddr ||= this.maybeAddExternalAddress(node, 'dht', res, peer)
            }
        }
        if(foundNewExtAddr)
            this.publish(false)
    }

    private onPeer = async (ipport: string, source: 'tracker'|'dht'|'lsd') => {
        
        if(this.externalAddresses.has(ipport)){
            this.log('discovered self %s from %s', ipport, source)
            return
        } else {
            this.log('discovered peer %s from %s', ipport, source)
        }

        const [ip, port]: [string, number] = addrToIPPort(ipport)
        const detail = ipPortToMultiaddr(ip, port)
        this.safeDispatchEvent('addr', { detail })

        const opts = {
            k: this.publicKey.raw,
            salt: detail.bytes,
        }
        const hash = this.discovery.dht._hash(Buffer.concat([opts.k, opts.salt]))
        this.discovery.dht.get(hash, { cache: true }, async (err: Error, value?: { v: unknown }) => {
            if(err){
                this.log('error getting record for %s - %e', ipport, err)
                return
            }
            if(!value || !Buffer.isBuffer(value.v)){
                this.log('error getting record for %s - no value provided or its not a buffer', ipport)
                return
            }
            const buf = value.v
            /*
            //src: @libp2p/peer-store/src/index.ts
            const options = {}
            const envelope = await RecordEnvelope.openAndCertify(buf, PeerRecord.DOMAIN, options)
            const peerId = peerIdFromCID(envelope.publicKey.toCID())
            const peerRecord = PeerRecord.createFromProtobuf(envelope.payload)
            this.log('discovered %p listening on', peerId, peerRecord.multiaddrs)
            */
            this.components.peerStore.consumePeerRecord(buf)
        })
    }
    private onWarning = (err: Error) => {
        this.log.error('warning', err)
    }
    private onError = (err: Error) => {
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
            external.reportedBy.set(reporter, now)
        }
        return this.reevaluateExternalAddress(external)
    }
    private reevaluateExternalAddress(external: ExternalAddress): boolean {
        const now = Date.now()
        const reportsCount = external.reportedBy.values()
            .reduce((accum, reportedAt) => accum + +((now - reportedAt) <= this.init.observationLifetime), 0)
        return !external.publishedItShouldBe && (external.publishedItShouldBe = (
            reportsCount >= this.init.observationsCount
        ))
    }
    
    private peerRecord?: PeerRecord
    private signedPeerRecord?: RecordEnvelope
    private onUpdate = async (/*{ detail: { peer } }: CustomEvent<PeerUpdate>*/) => {

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
        } else return

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
                id: buf.slice(i, i + idLength),
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

function parseIp(buf: Buffer, offset: number){
    return buf[offset++] + '.' + buf[offset++] + '.' + buf[offset++] + '.' + buf[offset++]
}
