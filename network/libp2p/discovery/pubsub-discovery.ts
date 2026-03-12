import { publicKeyFromProtobuf, publicKeyToProtobuf } from '@libp2p/crypto/keys'
import { TypedEventEmitter, peerDiscoverySymbol } from '@libp2p/interface'
import { peerIdFromPublicKey } from '@libp2p/peer-id'
import { multiaddr } from '@multiformats/multiaddr'
import { Peer as PBPeer } from '../../../message/peer'
import type { PeerDiscovery, PeerDiscoveryEvents, PeerId, PeerInfo, Startable, ComponentLogger, Logger, PeerStore, PublishResult, TypedEventTarget } from '@libp2p/interface'
import type { AddressManager, ConnectionManager } from '@libp2p/interface-internal'
import type { GossipSub, GossipsubMessage, GossipsubOpts } from '@chainsafe/libp2p-gossipsub'
import type { PinningService } from '../../../network/libp2p/pinning'
import type { TimeService } from '../../../utils/proxy/time'
//import { console_log } from '../../../ui/remote/remote'
import type { LibP2PEvents } from '../../../node/node'

export const TOPIC = '_peer-discovery._p2p._pubsub'

const ms = 1
const s = 1000*ms
const m = 60*s
const h = 60*m

const TTL_MARGIN = 7.5*s
const RECORD_LIFETIME = 15*m
const REANNOUNCE_INTERVAL = RECORD_LIFETIME - TTL_MARGIN
const POSITIVELY_REACHABLE_TIMEOUT = 100*ms

export interface PubsubPeerDiscoveryInit {
    topic?: string
}

export interface PubSubPeerDiscoveryComponents {
    peerId: PeerId
    pubsub?: GossipSub
    addressManager: AddressManager
    logger: ComponentLogger
    peerStore: PeerStore
    connectionManager: ConnectionManager
    events: TypedEventTarget<LibP2PEvents>
    pinning: PinningService
    time: TimeService
}

export interface PubSubPeerDiscoveryEvents {
    add: CustomEvent<PeerIdWithData>
    remove: CustomEvent<PeerIdWithData>
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
    msgIdStr: string,
    status: Status,
}
enum Status {
    Unknown,
    Reachable,
    Unreachable,
}

export function pubsubPeerDiscovery (init: PubsubPeerDiscoveryInit = {}): (components: PubSubPeerDiscoveryComponents) => PubSubPeerDiscovery {
    return (components: PubSubPeerDiscoveryComponents) => new PubSubPeerDiscovery(components, init)
}

export class PubSubPeerDiscovery extends TypedEventEmitter<PeerDiscoveryEvents & PubSubPeerDiscoveryEvents> implements PeerDiscovery, Startable {
    public readonly [peerDiscoverySymbol] = this
    public readonly [Symbol.toStringTag] = '@libp2p/pubsub-peer-discovery'

    private peers = new Map<string, PeerIdWithDataAndMessage>()
    getListOfReachablePeersWithData(): PeerIdWithData[] {
        return [...this.peers.values().filter(peer => this.isInList(peer))] as PeerIdWithData[]
    }
    private isInList(peer?: PeerIdWithDataAndMessage){
        return !!peer && peer.status == Status.Reachable && !!peer.data
    }
    private updatePeer(peerId: PeerId, cb: (peer: PeerIdWithDataAndMessage | undefined) => PeerIdWithDataAndMessage){
    
        const oldPeer = this.peers.get(peerId.toString())
        const oldInList = this.isInList(oldPeer)
        const newPeer = cb(oldPeer)
        const newInList = this.isInList(newPeer)
    
        if(newPeer) this.peers.set(peerId.toString(), newPeer)
        else this.peers.delete(peerId.toString())

        if(oldInList || newInList){
            this.safeDispatchEvent('update', { detail: newPeer })
            if(!oldInList && newInList)
                this.safeDispatchEvent('add', { detail: newPeer })
            if(oldInList && !newInList)
                this.safeDispatchEvent('remove', { detail: oldPeer })
        }
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

        const events = this.components.events
        events.addEventListener('self:peer:update', this.onSelfUpdate)
        pubsub.addEventListener('gossipsub:message', this.onMessage)
        events.addEventListener('connection:begin', this.onConnectionBegin)
        events.addEventListener('connection:fail', this.onConnectionFail)
        events.addEventListener('peer:connect', this.onPeerConnect)
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

        const events = this.components.events
        events.removeEventListener('self:peer:update', this.onSelfUpdate)
        pubsub.removeEventListener('gossipsub:message', this.onMessage)
        events.removeEventListener('connection:begin', this.onConnectionBegin)
        events.removeEventListener('connection:fail', this.onConnectionFail)
        events.removeEventListener('peer:connect', this.onPeerConnect)
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
            data: announce && this.data ? this.data : undefined,
            timestamp: BigInt(this.components.time.now()),
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

    onMessage = (event: CustomEvent<GossipsubMessage>): void => {

        //console_log('PUBSUB', 'onMessage', event.detail.msgId)
        
        const msg = event.detail.msg
        const msgIdStr = event.detail.msgId
        
        if (this.topic !== msg.topic) return

        try {
            const peer = PBPeer.decode(msg.data)
            const publicKey = publicKeyFromProtobuf(peer.publicKey)
            const peerId = peerIdFromPublicKey(publicKey)

            //console_log('PUBSUB', 'onMessage', event.detail.msgId, peerId.toString())

            const now = this.components.time.now()
            const timeRemaining = RECORD_LIFETIME - (now - Number(peer.timestamp ?? now))
            if(timeRemaining <= 0) return

            this.updatePeer(peerId, (oldPWD) => {

                if(oldPWD){
                    this.components.pinning.unpin(oldPWD.msgIdStr)
                    clearTimeout(oldPWD.timeout)
                }

                if (peer.addrs.length > 0){

                    const newPWD: PeerIdWithDataAndMessage = {
                        id: peerId,
                        data: peer.data,
                        msgIdStr,
                        timeout: undefined!,
                        status: undefined!,
                    }

                    this.components.pinning.pin(newPWD.msgIdStr)
                    newPWD.timeout = setTimeout(() => this.updatePeer(peerId, (peer) => {
                        if(peer){
                            this.components.pinning.unpin(peer.msgIdStr)
                            clearTimeout(peer.timeout)
                        }
                        return undefined!
                    }), timeRemaining)
                    
                    newPWD.status = oldPWD?.status ?? Status.Unknown
                    if(newPWD.status == Status.Unknown){
                        const cm = this.components.connectionManager
                        if(cm.getConnections(peerId))
                            newPWD.status = Status.Reachable
                        else if(cm.getDialQueue().find(dial => dial.peerId == peerId)) //TODO: Should I check the status?
                            newPWD.status = Status.Unreachable
                        else
                            setTimeout(this.onPositiveTimeout, POSITIVELY_REACHABLE_TIMEOUT, { detail: peerId })
                    }

                    return newPWD
                }
                return undefined!
            })

            if (peerId.equals(this.components.peerId)) return
            this.log('discovered peer %p on %s', peerId, msg.topic)

            if(peer.addrs.length > 0){
                const multiaddrs = peer.addrs.map(b => multiaddr(b))
                //for(const ma of multiaddrs)
                //    console_log('onMessage', event.detail.msgId, ma.toString())
                //this.components.peerStore.merge(peerId, { multiaddrs })
                const detail: PeerInfo = { id: peerId, multiaddrs, }
                this.safeDispatchEvent<PeerInfo>('peer', { detail })
            }
        } catch (err) {
            this.log.error('error handling incoming message', err)
        }
    }

    onSelfUpdate = (): void => {
        if(this.announced)
            this.broadcast(true)
    }

    onPositiveTimeout = ({ detail: peerId }: CustomEvent<PeerId>) => {
        this.updatePeer(peerId, (peer) => {
            if(peer?.status == Status.Unknown)
                peer.status = Status.Reachable
            return peer!
        })
    }

    onConnectionBegin = ({ detail: peerId }: CustomEvent<PeerId>) => {
        this.updatePeer(peerId, (peer) => {
            if(peer?.status == Status.Unknown)
                peer.status = Status.Unreachable
            return peer!
        })
    }

    onPeerConnect = ({ detail: peerId }: CustomEvent<PeerId>) => {
        this.updatePeer(peerId, (peer) => {
            if(peer)
                peer.status = Status.Reachable
            return peer!
        })
    }

    onConnectionFail = ({ detail: peerId }: CustomEvent<PeerId>) => {
        this.updatePeer(peerId, (peer) => {
            if(peer)
                peer.status = Status.Unreachable
            return peer!
        })
    }
}
