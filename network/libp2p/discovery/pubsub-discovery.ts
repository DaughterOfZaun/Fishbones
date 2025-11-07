import { publicKeyFromProtobuf, publicKeyToProtobuf } from '@libp2p/crypto/keys'
import { TypedEventEmitter, peerDiscoverySymbol } from '@libp2p/interface'
import { peerIdFromPublicKey } from '@libp2p/peer-id'
import { multiaddr } from '@multiformats/multiaddr'
import { Peer as PBPeer } from '../../../message/peer'
import type { PeerDiscovery, PeerDiscoveryEvents, PeerId, PeerInfo, Startable, ComponentLogger, Logger, PeerStore, PublishResult, TypedEventTarget, Libp2pEvents } from '@libp2p/interface'
import type { AddressManager } from '@libp2p/interface-internal'
import type { GossipSub, GossipsubMessage, GossipsubOpts } from '@chainsafe/libp2p-gossipsub'

export const TOPIC = '_peer-discovery._p2p._pubsub'

const s = 1000
const m = 60*s
const h = 60*m

const TTL_MARGIN = 30*s
const RECORD_LIFETIME = 1*h
const REANNOUNCE_INTERVAL = RECORD_LIFETIME - TTL_MARGIN

export interface PubsubPeerDiscoveryInit {
    topic?: string
}

export interface PubSubPeerDiscoveryComponents {
    peerId: PeerId
    pubsub?: GossipSub
    addressManager: AddressManager
    logger: ComponentLogger
    peerStore: PeerStore
    events: TypedEventTarget<Libp2pEvents>
}

export interface PubSubPeerDiscoveryEvents {
    add: CustomEvent<PeerIdWithData>
    update: CustomEvent<void>
}

type MemoryCache = GossipsubOpts['messageCache']
type RPCMessage = NonNullable<ReturnType<MemoryCache['get']>>

export interface PeerIdWithData {
    id: PeerId
    data: PBPeer.AdditionalData
}
interface PeerIdWithDataAndMessage {
    id: PeerId
    data?: PBPeer.AdditionalData
    timeout?: ReturnType<typeof setTimeout>
    iwantCounts: Map<string, number>
    msgIdStr: string
    msgId: Uint8Array
    msg: RPCMessage
}

export function pubsubPeerDiscovery (init: PubsubPeerDiscoveryInit = {}): (components: PubSubPeerDiscoveryComponents) => PubSubPeerDiscovery {
    return (components: PubSubPeerDiscoveryComponents) => new PubSubPeerDiscovery(components, init)
}

export class PubSubPeerDiscovery extends TypedEventEmitter<PeerDiscoveryEvents & PubSubPeerDiscoveryEvents> implements PeerDiscovery, Startable {
    public readonly [peerDiscoverySymbol] = true
    public readonly [Symbol.toStringTag] = '@libp2p/pubsub-peer-discovery'

    private peers = new Map<string, PeerIdWithDataAndMessage>()
    getPeersWithData(): PeerIdWithData[] {
        return [...this.peers.values().filter(peer => !!peer.data)] as PeerIdWithData[]
    }
    
    private readonly topic: string
    private readonly components: PubSubPeerDiscoveryComponents
    private readonly log: Logger
    
    constructor (components: PubSubPeerDiscoveryComponents, init: PubsubPeerDiscoveryInit = {}) {
        super()
        this.components = components
        this.log = components.logger.forComponent('libp2p:discovery:pubsub-with-data')
        this.topic = init.topic ?? TOPIC
    }
    
    private running = false

    start (): void {}

    afterStart (): void {
        if(this.running) return
        this.running = true
        
        const pubsub = this.components.pubsub
        if (!pubsub || !pubsub.isStarted()){
            throw new Error('PubSub not configured')
        }

        this.components.
        events.addEventListener('self:peer:update', this.onSelfUpdate)
        pubsub.addEventListener('gossipsub:message', this.onMessage)
        pubsub.subscribe(this.topic)

        this.announce()
    }

    async beforeStop (): Promise<void> {
        if(!this.running) return
        this.running = false
        
        const pubsub = this.components.pubsub
        if (!pubsub || !pubsub.isStarted()){
            //throw new Error('PubSub not configured')
            return
        }
        
        this.deannounce()
        await this.lastPublishPromise

        this.components.
        events.removeEventListener('self:peer:update', this.onSelfUpdate)
        pubsub.removeEventListener('gossipsub:message', this.onMessage)
        pubsub.unsubscribe(this.topic)
    }

    stop (): void {}

    public announce(): void {
        if(!this.announced){
            this.broadcast(true)
        }
    }
    public deannounce(): void {
        if(this.announced){
            this.broadcast(false)
        }
    }
    private data: PBPeer.AdditionalData | null | undefined = undefined
    public setData(data: PBPeer.AdditionalData | null | undefined): void {
        this.data = data
        if(this.announced)
            this.broadcast(true)
    }
    private announced = false
    private lastPublishPromise: Promise<PublishResult> | undefined
    private broadcastTimeout: ReturnType<typeof setTimeout> | undefined
    private broadcast (announce: boolean): void {        
        this.announced = announce

        const peerId = this.components.peerId
        const pubsub = this.components.pubsub
        const am = this.components.addressManager

        if (!peerId.publicKey) throw new Error('PeerId was missing public key')
        if (!pubsub) throw new Error('PubSub not configured')

        const encodedPeer = PBPeer.encode({
            publicKey: publicKeyToProtobuf(peerId.publicKey),
            addrs: announce ? am.getAddresses().map(ma => ma.bytes) : [],
            data: announce ? this.data ? this.data : undefined : undefined,
        })
        
        //if (pubsub.getSubscribers(topic).length === 0) {
        //    this.log('skipping broadcasting our peer data on topic %s because there are no peers present', topic)
        //    continue
        //}

        this.log('broadcasting our peer data on topic %s', this.topic)
        this.lastPublishPromise = pubsub.publish(this.topic, encodedPeer)

        clearTimeout(this.broadcastTimeout)
        if(announce){
            this.broadcastTimeout = setTimeout(() => {
                this.broadcast(true)
            }, REANNOUNCE_INTERVAL)
        }
    }

    getGossipIDs (topics: Set<string>): Map<string, Uint8Array[]> {
        const msgIdsByTopic = new Map<string, Uint8Array[]>()
        if(topics.has(this.topic)){
            const msgIds = [...this.peers.values().map(pwd => pwd.msgId)]
            msgIdsByTopic.set(this.topic, msgIds)
        }
        return msgIdsByTopic
    }

    getWithIWantCount(msgIdStr: string, p: string){
        const pwd = this.peers.values().find(pwd => pwd.msgIdStr === msgIdStr)
        if(pwd){
            const count = (pwd.iwantCounts.get(p) ?? 0) + 1
            pwd.iwantCounts.set(p, count)
            return { msg: pwd.msg, count }
        }
        return null
    }

    onMessage = (event: CustomEvent<GossipsubMessage>): void => {
        const msg = event.detail.msg
        const msgIdStr = event.detail.msgId

        const mcache = this.components.pubsub!['mcache'] as MemoryCache
        
        if (this.topic !== msg.topic) return

        try {
            const peer = PBPeer.decode(msg.data)
            const publicKey = publicKeyFromProtobuf(peer.publicKey)
            const peerId = peerIdFromPublicKey(publicKey)

            const oldPWD = this.peers.get(peerId.toString())
            clearTimeout(oldPWD?.timeout)

            if (peer.addrs && peer.addrs.length > 0){
                const msg = mcache.msgs.get(msgIdStr)!.message
                const msgId = mcache.history[0]!.find(entry => entry.msgIdStr === msgIdStr)!.msgId
                const newPWD = {
                    id: peerId,
                    data: peer.data,
                    msg, msgId, msgIdStr,
                    iwantCounts: new Map(),
                    timeout: setTimeout(() => {
                        this.peers.delete(peerId.toString())
                        if(peer.data) this.safeDispatchEvent('update')
                    }, RECORD_LIFETIME)
                }
                this.peers.set(peerId.toString(), newPWD)
                if(!oldPWD?.data && newPWD.data) this.safeDispatchEvent('add', { detail: newPWD })
                if(oldPWD?.data || newPWD.data) this.safeDispatchEvent('update')
            } else {
                this.peers.delete(peerId.toString())
                if(oldPWD?.data) this.safeDispatchEvent('update')
            }

            if (peerId.equals(this.components.peerId)) return
            this.log('discovered peer %p on %s', peerId, msg.topic)

            if(peer.addrs.length > 0){
                const multiaddrs = peer.addrs.map(b => multiaddr(b))
                //this.components.peerStore.merge(peerId, { multiaddrs })
                this.safeDispatchEvent<PeerInfo>('peer', {
                    detail: { id: peerId, multiaddrs, }
                })
            }
        } catch (err) {
            this.log.error('error handling incoming message', err)
        }
    }

    onSelfUpdate = (): void => {
        if(this.announced)
            this.broadcast(true)
    }
}
