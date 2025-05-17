import { publicKeyFromProtobuf, publicKeyToProtobuf } from '@libp2p/crypto/keys'
import { TypedEventEmitter, peerDiscoverySymbol } from '@libp2p/interface'
import { peerIdFromPublicKey } from '@libp2p/peer-id'
import { multiaddr } from '@multiformats/multiaddr'
import { Peer as PBPeer } from './peer.js'
import type { PeerDiscovery, PeerDiscoveryEvents, PeerId, PeerInfo, Message, PubSub, Startable, ComponentLogger, Logger } from '@libp2p/interface'
import type { AddressManager } from '@libp2p/interface-internal'

export const TOPIC = '_peer-discovery._p2p._pubsub'

export interface PubsubPeerDiscoveryInit {
    interval?: number
    topics?: string[]
    enableBroadcast?: boolean
}

export interface PubSubPeerDiscoveryComponents {
    peerId: PeerId
    pubsub?: PubSub
    addressManager: AddressManager
    logger: ComponentLogger
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
    getBroadcastEnabled = () => !!this.intervalId
    setBroadcastEnabled(broadcastEnabled: boolean){
        if(broadcastEnabled === !!this.intervalId) return
        if(broadcastEnabled){
            this.broadcast()
            this.intervalId = setInterval(() => {
                this.broadcast()
            }, this.interval)
        } else if (this.intervalId) {
            clearInterval(this.intervalId)
            this.intervalId = undefined
        }
    }

    private data: undefined | PBPeer.AdditionalData
    setData(data: null | undefined | PBPeer.AdditionalData){
        data = data ? data : undefined
        if(this.data == data) return
        this.data = data
        if(!data) this.broadcast(false)
        this.setBroadcastEnabled(!!data || this.enableBroadcast)
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
        this.log = components.logger.forComponent('libp2p:discovery:pubsub')
        this.topics = (Array.isArray(init.topics) && init.topics.length > 0) ? init.topics : [ TOPIC ]
    }

    start (): void {}

    afterStart (): void {
        const pubsub = this.components.pubsub
        if (!pubsub) throw new Error('PubSub not configured')

        for (const topic of this.topics) {
            pubsub.subscribe(topic)
            pubsub.addEventListener('message', this.onMessage)
        }

        this.setBroadcastEnabled(this.enableBroadcast)
    }

    beforeStop (): void {
        const pubsub = this.components.pubsub
        if (!pubsub) throw new Error('PubSub not configured')
            
        this.setData(null)
        
        for (const topic of this.topics) {
            pubsub.unsubscribe(topic)
            pubsub.removeEventListener('message', this.onMessage)
        }
    }

    stop (): void {}

    broadcast (announce = true): void {
        const peerId = this.components.peerId
        const pubsub = this.components.pubsub

        if (!peerId.publicKey) throw new Error('PeerId was missing public key')
        if (!pubsub) throw new Error('PubSub not configured')

        const encodedPeer = PBPeer.encode({
            publicKey: publicKeyToProtobuf(peerId.publicKey),
            addrs: announce ? this.components.addressManager.getAddresses().map(ma => ma.bytes) : [],
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

        if (!this.topics.includes(message.topic)) return

        try {
            const peer = PBPeer.decode(message.data)
            const publicKey = publicKeyFromProtobuf(peer.publicKey)
            const peerId = peerIdFromPublicKey(publicKey)

            if (peerId.equals(this.components.peerId)) return
            
            this.log('discovered peer %p on %s', peerId, message.topic)

            let i = this.peersWithData.findIndex(pwd => pwd.id.equals(peerId))
            if (peer.data){
                let pwd = { id: peerId, data: peer.data }
                if(i != -1) this.peersWithData.splice(i, 1, pwd)
                else this.peersWithData.push(pwd)

                //this.safeDispatchEvent<PeerIdWithData>('data', { detail: pwd })
            } else {
                this.peersWithData.splice(i, 1)
            }
            this.safeDispatchEvent('update')

            if(peer.addrs.length > 0){
                
                //TODO: PeerStore.merge

                this.safeDispatchEvent<PeerInfo>('peer', {
                    detail: {
                        id: peerId,
                        multiaddrs: peer.addrs.map(b => multiaddr(b)),
                    }
                })
            }
        } catch (err) {
            this.log.error('error handling incoming message', err)
        }
    }
}
