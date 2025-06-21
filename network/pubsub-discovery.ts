import { publicKeyFromProtobuf, publicKeyToProtobuf } from '@libp2p/crypto/keys'
import { TypedEventEmitter, peerDiscoverySymbol } from '@libp2p/interface'
import { peerIdFromPublicKey } from '@libp2p/peer-id'
import { multiaddr } from '@multiformats/multiaddr'
import { Peer as PBPeer } from '../message/peer.js'
import type { PeerDiscovery, PeerDiscoveryEvents, PeerId, PeerInfo, Message, Startable, ComponentLogger, Logger, PeerStore } from '@libp2p/interface'
import type { AddressManager } from '@libp2p/interface-internal'
import type { GossipSub } from '@chainsafe/libp2p-gossipsub'

export const TOPIC = '_peer-discovery._p2p._pubsub'

export interface PubsubPeerDiscoveryInit {
    interval?: number
    topics?: string[]
    enableBroadcast?: boolean
}

export interface PubSubPeerDiscoveryComponents {
    peerId: PeerId
    pubsub?: GossipSub
    addressManager: AddressManager
    logger: ComponentLogger
    peerStore: PeerStore
}

export type PubSubPeerDiscoveryEvents = {
    //data: PeerIdWithData,
    update: void
}

export type PeerIdWithData = { id: PeerId, data?: PBPeer.AdditionalData }

export function pubsubPeerDiscovery (init: PubsubPeerDiscoveryInit = {}): (components: PubSubPeerDiscoveryComponents) => PubSubPeerDiscovery {
    return (components: PubSubPeerDiscoveryComponents) => new PubSubPeerDiscovery(components, init)
}

export class PubSubPeerDiscovery extends TypedEventEmitter<PeerDiscoveryEvents & PubSubPeerDiscoveryEvents> implements PeerDiscovery, Startable {
    public readonly [peerDiscoverySymbol] = true
    public readonly [Symbol.toStringTag] = '@libp2p/pubsub-peer-discovery'

    private readonly enableBroadcast: boolean
    private intervalId?: ReturnType<typeof setInterval>
    public getBroadcastEnabled = () => !!this.intervalId
    public setBroadcastEnabled(broadcastEnabled: boolean){
        if(broadcastEnabled === !!this.intervalId) return
        if(broadcastEnabled){
            this.intervalId = setInterval(() => {
                this.broadcast()
            }, this.interval)
        } else { //if (this.intervalId) {
            clearInterval(this.intervalId)
            this.intervalId = undefined
        }
    }

    private data: undefined | PBPeer.AdditionalData
    setData(data: null | undefined | PBPeer.AdditionalData){
        data = data ? data : undefined
        if(this.data == data) return
        this.data = data
        //this.broadcast(!!data)
        //this.setBroadcastEnabled(!!data || this.enableBroadcast)
    }

    private peersWithData: PeerIdWithData[] = []
    getPeersWithData = () => this.peersWithData.slice(0)

    private readonly interval: number
    private readonly topics: string[]
    private readonly components: PubSubPeerDiscoveryComponents
    private readonly log: Logger

    constructor (components: PubSubPeerDiscoveryComponents, init: PubsubPeerDiscoveryInit = {}) {
        super()
        this.components = components
        this.interval = init.interval ?? 10000
        this.enableBroadcast = init.enableBroadcast ?? false
        this.log = components.logger.forComponent('libp2p:discovery:pubsub-with-data')
        this.topics = (Array.isArray(init.topics) && init.topics.length > 0) ? init.topics : [ TOPIC ]
    }

    start (): void {}

    afterStart (): void {
        //this.log('afterStart')

        const pubsub = this.components.pubsub
        if (!pubsub) throw new Error('PubSub not configured')

        pubsub.addEventListener('message', this.onMessage)
        for (const topic of this.topics) {
            pubsub.subscribe(topic)
        }

        if(this.enableBroadcast){
            this.broadcast(true)
            this.setBroadcastEnabled(true)
        }
    }

    beforeStop (): void {
        //this.log('beforeStop')

        const pubsub = this.components.pubsub
        //if (!pubsub) throw new Error('PubSub not configured')
            
        this.setData(null)
        if(this.getBroadcastEnabled()){
            this.setBroadcastEnabled(false)
            if(pubsub?.isStarted())
            this.broadcast(false)
        }
        
        if(pubsub){
            pubsub.removeEventListener('message', this.onMessage)
            for (const topic of this.topics) {
                if(pubsub?.isStarted())
                pubsub.unsubscribe(topic)
            }
        }
    }

    stop (): void {}

    broadcast (announce = true): void {
        //this.log('broadcast', announce)

        const peerId = this.components.peerId
        const pubsub = this.components.pubsub
        const am = this.components.addressManager

        if (!peerId.publicKey) throw new Error('PeerId was missing public key')
        if (!pubsub) throw new Error('PubSub not configured')

        const encodedPeer = PBPeer.encode({
            publicKey: publicKeyToProtobuf(peerId.publicKey),
            addrs: announce ? am.getAddresses().map(ma => ma.bytes) : [],
            data: announce ? this.data : undefined,
        })
        
        for (const topic of this.topics) {
            if (pubsub.getSubscribers(topic).length === 0) {
                this.log('skipping broadcasting our peer data on topic %s because there are no peers present', topic)
                continue
            }

            this.log('broadcasting our peer data on topic %s', topic)
            void pubsub.publish(topic, encodedPeer)
        }
    }

    onMessage = (event: CustomEvent<Message>): void => {
        const message = event.detail
        //this.log('onMessage')

        if (!this.topics.includes(message.topic)) return

        try {
            const peer = PBPeer.decode(message.data)
            const publicKey = publicKeyFromProtobuf(peer.publicKey)
            const peerId = peerIdFromPublicKey(publicKey)

            if (peerId.equals(this.components.peerId)) return
            
            this.log('discovered peer %p on %s', peerId, message.topic)

            const i = this.peersWithData.findIndex(pwd => pwd.id.equals(peerId))
            if (peer.data){
                const pwd = { id: peerId, data: peer.data }
                if(i != -1) this.peersWithData.splice(i, 1, pwd)
                else this.peersWithData.push(pwd)

                //this.safeDispatchEvent<PeerIdWithData>('data', { detail: pwd })
            } else {
                this.peersWithData.splice(i, 1)
            }
            this.safeDispatchEvent('update')

            if(peer.addrs.length > 0){
                const multiaddrs = peer.addrs.map(b => multiaddr(b))
                //console.log(multiaddrs.map(ma => ma.toString()))

                this.components.peerStore.merge(peerId, { multiaddrs })

                this.safeDispatchEvent<PeerInfo>('peer', {
                    detail: { id: peerId, multiaddrs, }
                })
            }
        } catch (err) {
            this.log.error('error handling incoming message', err)
        }
    }
}
