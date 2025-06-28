import { privateKeyFromRaw, publicKeyFromRaw } from '@libp2p/crypto/keys'
import { TypedEventEmitter, peerDiscoverySymbol, serviceCapabilities } from '@libp2p/interface'
import type { AbortOptions, ComponentLogger, IdentifyResult, Libp2pEvents, Logger, PeerDiscovery, PeerDiscoveryEvents, PeerDiscoveryProvider, PeerId, PeerInfo, PeerStore, PrivateKey, PublicKey, Startable, TypedEventTarget } from '@libp2p/interface'
import type { AddressManager, ConnectionManager } from '@libp2p/interface-internal'
import { ipPortToMultiaddr } from '@libp2p/utils/ip-port-to-multiaddr'
import { multiaddr, protocols, type Multiaddr } from '@multiformats/multiaddr'
//@ts-expect-error: Could not find a declaration file for module 'addr-to-ip-port'
import addrToIPPort from 'addr-to-ip-port'
//@ts-expect-error: Could not find a declaration file for module 'torrent-discovery'
import Discovery from 'torrent-discovery'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { concat as uint8ArrayConcat } from 'uint8arrays/concat'
////@ts-expect-error: Could not find a declaration file for module 'bittorrent-dht'
//import { Client as DHT } from 'bittorrent-dht'
import { RecordEnvelope, PeerRecord } from '@libp2p/peer-record'

import crypto from 'crypto'
import { removePrivateAddressesMapper } from '@libp2p/kad-dht'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { peerIdFromCID } from '@libp2p/peer-id'
function sha1 (buf: Buffer) {
    return crypto.createHash('sha1').update(buf).digest()
}

const VERSION = '2.6.7'
//import { version as VERSION } from 'webtorrent/package.json'
const USER_AGENT = `WebTorrent/${VERSION} (https://webtorrent.io)`
//TODO: Pass via Init
const KEY = 'Z3z1776YR5Mz+EkkZOZ2VB7kUNSCm6syviHz1++589Vz4+INeC6EKD2RaDmaP9uVr5FssMaHKed7KlC5wE/+GA=='

interface DiscoveryInit {
    infoHash: string,
    port: number,
    announce: string[],
    dht: boolean | object,
    dhtPort: number,
    tracker: boolean | object,
    lsd: boolean | object,

    startupDelay?: number,
    refreshInterval?: number,
    //observationsCount?: number,
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

export function torrentPeerDiscovery(init: DiscoveryInit): (components: DiscoveryComponents) => DiscoveryClass {
    return (components: DiscoveryComponents) => new DiscoveryClass(init, components)
}

const verify = (signature: Uint8Array, data: Uint8Array, publicKeyRaw: Uint8Array) => {
    const publicKey = publicKeyFromRaw(publicKeyRaw)
    return publicKey.verify(data, signature)
}
/*
const sign = (data: Uint8Array, publicKeyRaw: Uint8Array, privateKeyRaw: Uint8Array) => {
    const privateKey = privateKeyFromRaw(uint8ArrayConcat([
        privateKeyRaw, publicKeyRaw,
    ]))
    return privateKey.sign(data)
}
*/

type RPCPeer = ({ host: string } | { address: string }) & { port: number }
type RPCResponse = { r: { nodes?: Buffer } }
type RPCVisitCallback = (res: RPCResponse, peer: RPCPeer) => void

class DiscoveryClass extends TypedEventEmitter<DiscoveryEvents> implements PeerDiscovery, PeerDiscoveryProvider, Startable {
    
    private discovery: any // eslint-disable-line @typescript-eslint/no-explicit-any
    private readonly init: DiscoveryInit & { peerId: string, userAgent: string }
    private readonly components: DiscoveryComponents
    private readonly log: Logger
    private readonly privateKey: PrivateKey
    private readonly publicKey: PublicKey
    
    constructor(init: DiscoveryInit, components: DiscoveryComponents){
        super()
        
        this.components = components
        
        if(init.dht === true)
            init.dht = {}

        init.startupDelay ??= 60 * 1000
        init.refreshInterval ??= 1 * 60 * 1000
        //init.observationsCount ??= 3

        this.init = {
            ...init,
            port: 0,
            tracker: false,
            peerId: this.components.peerId.toString(),
            userAgent: USER_AGENT,
            dht: (typeof init.dht !== 'object') ? init.dht : {
                ...init.dht,
                //bootstrap: false,
                verify,
            },
        }
        this.log = components.logger.forComponent('libp2p:torrent-discovery')
        this.privateKey = privateKeyFromRaw(uint8ArrayFromString(KEY, 'base64pad'))
        this.publicKey = this.privateKey.publicKey
    }

    public readonly [peerDiscoverySymbol] = this
    public readonly [Symbol.toStringTag] = '@libp2p/torrent-discovery'
    public readonly [serviceCapabilities]: string[] = [
      '@libp2p/peer-discovery'
    ]

    private maybeUpdateTimeout?: ReturnType<typeof setTimeout>
    public start() {
        if(this.discovery) return
        process.browser = true
        const discovery = new Discovery(this.init)
        process.browser = false
        this.discovery = discovery

        const rpc = discovery.dht._rpc
        const rpc__closest = rpc._closest
        rpc._closest = (target: unknown, message: unknown, background: unknown, visit: RPCVisitCallback, cb: unknown) => {
            const patchedVisit = (visit === this.onreply) ? this.onreply : (res: RPCResponse, peer: RPCPeer) => {
                const ret = visit ? visit(res, peer) : undefined
                this.onreply(res, peer)
                return ret
            }
            rpc__closest.call(rpc, target, message, background, patchedVisit, cb)
        }

        //process.nextTick(this.findSelf)

        discovery.addListener('peer', this.onPeer)
        discovery.addListener('warning', this.onWarning)
        discovery.addListener('error', this.onError)

        discovery.tracker?.on('update', this.onTrackerUpdate)

        this.components.events.addEventListener('self:peer:update', this.maybeUpdate)
        //this.components.events.addEventListener('peer:identify', this.onIdentify)

        this.maybeUpdateTimeout = setTimeout(() => this.maybeUpdate(), this.init.startupDelay)
        this.findSelfTimeout = setTimeout(() => this.findSelf(), this.init.startupDelay)
    }

    onIdentify = ({ detail: result }: CustomEvent<IdentifyResult>) => {
        if(!result.observedAddr) return
        const opts = result.observedAddr.toOptions()
        const foundNewExtAddr = this.maybeAddExternalAddress(opts, 'identify')
        if(foundNewExtAddr)
            this.publish(false)
    }

    onTrackerUpdate = (data: { peers?: { id?: string, ip?: string, port?: number }[] }) => {
        //this.log('tracker-update', data)
        if (Array.isArray(data.peers)) {
            let foundNewExtAddr = false
            for(const peer of data.peers){
                if(peer.ip && peer.port && peer.id === this.discovery.tracker.peerId){
                    const { ip: host, port } = peer
                    foundNewExtAddr ||= this.maybeAddExternalAddress({ host, port }, 'tracker')
                }
            }
            if(foundNewExtAddr)
                this.publish(false)
        }
    }

    ///*
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
        const done = (err?: Error) => {
            if(err) this.log('error finding self - %e', err)
            else this.log('done finding self')
            this.findSelfTimeout = setTimeout(this.findSelf, this.init.refreshInterval)
        }
        this.log('begin finding self')
        //rpc._closest(rpc.id, msg, true, this.onreply, done)
        //rpc.populate(rpc.id, msg, done)
        rpc.closest(rpc.id, msg, this.onreply, done)
        //rpc.queryAll()
    }
    //*/

    //let observations = 0
    onreply = (res: RPCResponse, peer: RPCPeer) => {
        const rpc = this.discovery.dht._rpc

        const r = res && res.r
        const nodes = r.nodes ? parseNodes(r.nodes, rpc._idLength) : []
        let foundNewExtAddr = false
        for(const node of nodes){
            //this.log('onreply', `${node.host}:${node.port}`, node.id.toString('hex'), 'vs', rpc.id.toString('hex'))
            if(node.id.equals(rpc.id)){
                foundNewExtAddr ||= this.maybeAddExternalAddress(node, 'dht', res)
            }
        }
        if(foundNewExtAddr)
            this.publish(false)
        //return !(foundSelf && ++observations > 3)
    }

    private onPeer = async (ipport: string /*| { id: string, ip: string, port: string }*/, source: 'tracker'|'dht'|'lsd') => {
        
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

    public stop() {
        if(!this.discovery) return
        const discovery = this.discovery
        this.discovery = undefined

        discovery.removeListener('peer', this.onPeer)
        discovery.removeListener('warning', this.onWarning)
        discovery.removeListener('error', this.onError)

        discovery.tracker?.removeListener('update', this.onTrackerUpdate)
        
        this.components.events.removeEventListener('self:peer:update', this.maybeUpdate)
        //this.components.events.removeEventListener('peer:identify', this.onIdentify)
        
        clearTimeout(this.maybeUpdateTimeout)
        clearTimeout(this.findSelfTimeout)
        
        return new Promise<void>(res => discovery.destroy(() => res()))
    }

    private isUpdating = false
    private maybeUpdate = () => {
        clearTimeout(this.maybeUpdateTimeout)
        
        if(this.isUpdating){
            this.log('already being updated. update request rejected')
            //TODO: Abort current update instead.
            return
        }
        this.isUpdating = true
        this.update().catch(err => this.log('error updating DHT records - %e', err))
        .then(() => this.isUpdating = false)
    }

    
    private multiaddrs: Multiaddr[] = []
    private multiaddrs_eq(to: Multiaddr[]){
        return this.multiaddrs.length === to.length && !this.multiaddrs.some(ma => !to.some(mb => ma.equals(mb)))
    }

    private peerRecord?: PeerRecord
    private signedPeerRecord?: RecordEnvelope
    
    private readonly externalAddresses = new Map<string, {
        host: string
        port: number
        isNew: boolean
    }>()
    private maybeAddExternalAddress(info: { host: string, port: number }, source: string, desc?: object): boolean {
        const { host, port } = info
        const hostport = `${host}:${port}`
        if(!this.externalAddresses.has(hostport)){
            this.log('discovered new external address %s from %s', hostport, source, desc)
            this.externalAddresses.set(hostport, { host, port, isNew: true })
            return true
        }
        return false
    }
    
    async update(options?: AbortOptions){
        const peerId = this.components.peerId
        const am = this.components.addressManager

        const { multiaddrs } = removePrivateAddressesMapper({
            id: peerId,
            multiaddrs: am.getAddresses().map(ma => {
                //return ma.decapsulateCode(protocols('p2p').code)
                return ma.decapsulate(multiaddr(`/p2p/${peerId.toString()}`))
            })
        })
        const multiaddrsChanged = !this.multiaddrs_eq(multiaddrs)
        //this.log(this.multiaddrs.map(ma => ma.toString()), 'vs', multiaddrs.map(ma => ma.toString()))
        if(multiaddrsChanged){
            this.peerRecord = new PeerRecord({ peerId, multiaddrs, })
            this.signedPeerRecord = await RecordEnvelope.seal(this.peerRecord, this.privateKey, options)
            this.log('listening addresses have changed', multiaddrs.map(ma => ma.toString()))
        }
        
        /*
        const observed = am.getObservedAddrs()
        if(observed.length)
            this.log('observed', observed.map(ma => ma.toString()))

        for(const ma of observed){
            const opts = ma.toOptions()
            this.maybeAddExternalAddress(opts, 'libp2p')
        }
        */
        this.publish(true)
    }

    private publish(all: boolean){
        if(!this.peerRecord || !this.signedPeerRecord){
            this.log('no addresses to announce')
            return
        }
        const recordsToUpdate = [...(all ?
            this.externalAddresses.entries() :
            this.externalAddresses.entries().filter(([, { isNew }]) => isNew)
        )]
        
        if(recordsToUpdate.length > 0){
            this.log('begin putting records for', recordsToUpdate.map(([hostport,]) => hostport))
        } else return

        for(const [hostport, info] of recordsToUpdate){
            const { host, port } = info
            
            info.isNew = false

            this.discovery.dht.put({
                k: this.publicKey.raw,
                salt: ipPortToMultiaddr(host, port).bytes,
                seq: Number(this.peerRecord.seqNumber),
                v: this.signedPeerRecord.marshal(),
                sign: (data: Uint8Array) => {
                    return this.privateKey.sign(data)
                }
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
    } catch (err) {
        // do nothing
    }
    return contacts
}
function parseIp(buf: Buffer, offset: number){
    return buf[offset++] + '.' + buf[offset++] + '.' + buf[offset++] + '.' + buf[offset++]
}