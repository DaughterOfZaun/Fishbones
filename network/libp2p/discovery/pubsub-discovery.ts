import { publicKeyFromProtobuf, publicKeyToProtobuf } from '@libp2p/crypto/keys'
import { TypedEventEmitter, peerDiscoverySymbol } from '@libp2p/interface'
import { peerIdFromPublicKey } from '@libp2p/peer-id'
import { multiaddr } from '@multiformats/multiaddr'
import { Peer as PBPeer } from '../../../message/peer'
import type { PeerDiscovery, PeerDiscoveryEvents, PeerId, PeerInfo, Startable, ComponentLogger, Logger, PeerStore } from '@libp2p/interface'
import type { AddressManager } from '@libp2p/interface-internal'
import type { GossipSub, GossipsubMessage, GossipsubOpts } from '@chainsafe/libp2p-gossipsub'

export const TOPIC = '_peer-discovery._p2p._pubsub'

export interface PubsubPeerDiscoveryInit {
    topic?: string
}

export interface PubSubPeerDiscoveryComponents {
    peerId: PeerId
    pubsub?: GossipSub
    addressManager: AddressManager
    logger: ComponentLogger
    peerStore: PeerStore
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
interface PeerIdWithDataAndMessage extends PeerIdWithData {
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

    private peersWithData: PeerIdWithDataAndMessage[] = []
    getPeersWithData(): PeerIdWithData[] {
        return this.peersWithData.slice(0)
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

    start (): void {}

    afterStart (): void {
        
        const pubsub = this.components.pubsub
        if (!pubsub || !pubsub.isStarted()){
            throw new Error('PubSub not configured')
        }

        pubsub.addEventListener('gossipsub:message', this.onMessage)
        pubsub.subscribe(this.topic)
    }

    beforeStop (): void {
        
        const pubsub = this.components.pubsub
        if (!pubsub || !pubsub.isStarted()){
            //throw new Error('PubSub not configured')
            return
        }
        
        if(this.announced){
            this.broadcast(null)
        }

        pubsub.removeEventListener('gossipsub:message', this.onMessage)
        pubsub.unsubscribe(this.topic)
    }

    stop (): void {}

    private announced = false
    private data: PBPeer.AdditionalData | null | undefined = undefined
    broadcast (data: PBPeer.AdditionalData | null | undefined): void {        
        this.announced = !!data
        this.data = data

        const peerId = this.components.peerId
        const pubsub = this.components.pubsub
        const am = this.components.addressManager

        if (!peerId.publicKey) throw new Error('PeerId was missing public key')
        if (!pubsub) throw new Error('PubSub not configured')

        const encodedPeer = PBPeer.encode({
            publicKey: publicKeyToProtobuf(peerId.publicKey),
            addrs: data ? am.getAddresses().map(ma => ma.bytes) : [],
            data: data ? data : undefined,
        })
        
        //if (pubsub.getSubscribers(topic).length === 0) {
        //    this.log('skipping broadcasting our peer data on topic %s because there are no peers present', topic)
        //    continue
        //}

        this.log('broadcasting our peer data on topic %s', this.topic)
        void pubsub.publish(this.topic, encodedPeer)
    }

    private readonly pinnedMessages = new Map<string, unknown>()
    get mcache(){
        return 
    }
    getGossipIDs (topics: Set<string>): Map<string, Uint8Array[]> {
        const msgIdsByTopic = new Map<string, Uint8Array[]>()
        if(topics.has(this.topic)){
            const msgIds = this.peersWithData.map(pwd => pwd.msgId)
            msgIdsByTopic.set(this.topic, msgIds)
        }
        return msgIdsByTopic
    }

    getWithIWantCount(msgIdStr: string, p: string){
        const pwd = this.peersWithData.find(pwd => pwd.msgIdStr === msgIdStr)
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

            const i = this.peersWithData.findIndex(pwd => pwd.id.equals(peerId))
            if (peer.data){
                const msg = mcache.msgs.get(msgIdStr)!.message
                const msgId = mcache.history[0]!.find(entry => entry.msgIdStr === msgIdStr)!.msgId
                const pwd = { id: peerId, data: peer.data, msg, msgId, msgIdStr, iwantCounts: new Map() }
                if(i != -1) this.peersWithData.splice(i, 1, pwd)
                else {
                    this.safeDispatchEvent('add', pwd)
                    this.peersWithData.push(pwd)
                }
            } else {
                this.peersWithData.splice(i, 1)
            }
            this.safeDispatchEvent('update')

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
}
