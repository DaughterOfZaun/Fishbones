//src: @libp2p/circuit-relay-v2/src/transport/discovery.ts
//src: @libp2p/autonat/src/autonat.ts

import type { ComponentLogger, Libp2pEvents, Logger, Peer, PeerId, PeerInfo, PeerStore, Startable, TypedEventTarget } from "@libp2p/interface"
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import type { ConnectionManager } from "@libp2p/interface-internal"
import { PeerQueue } from '@libp2p/utils/peer-queue'
import { setMaxListeners } from 'main-event'
import { anySignal } from 'any-signal'

const DEFAULT_CONNECTION_THRESHOLD = 80
const FloodsubID = '/floodsub/1.0.0'
const GossipsubIDv10 = '/meshsub/1.0.0'
const GossipsubIDv11 = '/meshsub/1.1.0'
const GossipsubIDv12 = '/meshsub/1.2.0'
const multicodecs = [ FloodsubID, GossipsubIDv10, GossipsubIDv11, GossipsubIDv12 ]

interface AutodialInit {
    connectionThreshold?: number
}
interface AutodialComponents {
    logger: ComponentLogger
    connectionManager: ConnectionManager
    events: TypedEventTarget<Libp2pEvents>
    peerStore: PeerStore
}

export function autodial(init: AutodialInit): (components: AutodialComponents) => Autodial {
    return (components: AutodialComponents) => new Autodial(init, components)
}

class Autodial implements Startable {

    readonly [Symbol.toStringTag] = '@libp2p/autodial'

    private readonly log: Logger
    private readonly init: Required<AutodialInit>
    private readonly components: AutodialComponents
    private readonly queue = new PeerQueue({
        concurrency: 5
    })

    private started = false
    private running = false
    private abortController?: AbortController

    constructor(init: AutodialInit, components: AutodialComponents) {
        this.log = components.logger.forComponent('libp2p:autodial')
        this.components = components
        this.init = {
            connectionThreshold: init.connectionThreshold ?? DEFAULT_CONNECTION_THRESHOLD
        }
        this.dialPeer = this.dialPeer.bind(this)
        this.onPeer = this.onPeer.bind(this)
        this.maybeStartAutodial = this.maybeStartAutodial.bind(this)
        this.maybeStopAutodial = this.maybeStopAutodial.bind(this)
    }

    start() {
        if (this.started) return
        this.started = true

        this.components.events.addEventListener('peer:connect', this.maybeStopAutodial)
        this.components.events.addEventListener('peer:disconnect', this.maybeStartAutodial)
        this.startAutodial()
    }

    stop() {
        if (!this.started) return
        this.started = false

        this.components.events.removeEventListener('peer:connect', this.maybeStopAutodial)
        this.components.events.removeEventListener('peer:disconnect', this.maybeStartAutodial)
        this.stopAutodial()
    }

    maybeStartAutodial(){
        if(!this.running && this.getConnectionCapacity()) this.startAutodial()
    }

    maybeStopAutodial(){
        if(this.running && !this.getConnectionCapacity()) this.stopAutodial()
    }

    startAutodial() {
        if(this.running) return
        this.running = true
        this.log('start autodial')

        this.abortController = new AbortController()
        setMaxListeners(Infinity, this.abortController.signal)
        this.components.events.addEventListener('peer:discovery', this.onPeer)

        const capacity = this.getConnectionCapacity()
        
        Promise.resolve().then(async () => {
            const peers = await this.components.peerStore.all({
                limit: capacity,
                filters: [
                    (peer) => multicodecs.some(codec => peer.protocols.includes(codec))
                ],
                orders: [
                    () => Math.random() < 0.5 ? 1 : -1,
                    (a, b) => {
                        const delta = getLastDial(b) - getLastDial(a)
                        return (delta < 0) ? -1 : (delta > 0) ? 1 : 0
                    }
                ],
            });
            this.log('rediscovered peers count: %d', peers.length)
            for(const peer of peers){
                this.log('maybe dialing rediscovered peer %p', peer.id)
                const info = {
                    id: peer.id,
                    multiaddrs: peer.addresses.map(addr => addr.multiaddr)
                }
                this.maybeDialPeer(info).catch(err => {
                    this.log('error dialing rediscovered peer %p - %e', peer.id, err)
                })
            }
        }).catch(err => this.log.error('error rediscovering peers - %e', err))
    }

    stopAutodial() {
        if (!this.running) return
        this.running = false
        this.log('stop autodial')

        this.abortController?.abort()
        this.queue.clear()
        this.components.events.removeEventListener('peer:discovery', this.onPeer)
    }

    onPeer(evt: CustomEvent<PeerInfo>): void {
        this.log('maybe dialing discovered peer %p', evt.detail.id)
        this.maybeDialPeer(evt.detail).catch(err => {
            this.log('error dialing discovered peer %p - %e', evt.detail.id, err)
        })
    }

    async maybeDialPeer(info: PeerInfo): Promise<void> {
        const { id: peerId, multiaddrs } = info

        if (this.queue.has(peerId)) {
            this.log('discovered peer %p was already in queue', peerId)
        } else if (this.components.connectionManager.getConnections(peerId)?.length > 0) {
            this.log('discovered peer %p was already connected', peerId)
        } else if (!(await this.components.connectionManager.isDialable(multiaddrs))) {
            this.log('discovered peer %p was not dialable', peerId)
        } else if (!this.getConnectionCapacity()) {
            this.log('discovered peer %p is skipped because we are too close to the connection limit', peerId)
            //TODO: Queue
        } else {
            this.queue.add(this.dialPeer, {
                peerId: peerId,
                signal: this.abortController?.signal
            }).catch(err => {
                this.log.error('error opening connection to discovered peer %p', peerId, err)
            })
        }
    }

    async dialPeer({ peerId, signal }: { peerId: PeerId, signal?: AbortSignal }): Promise<void> {
        const combinedSignal = anySignal([AbortSignal.timeout(5_000), signal])
        setMaxListeners(Infinity, combinedSignal)
        try {
            this.log('opening connection to discovered peer %p', peerId)
            await this.components.connectionManager.openConnection(peerId, {
                signal: combinedSignal
            })
        } finally {
            combinedSignal.clear()
        }
    }

    private getConnectionCapacity(): number {
        const connections = this.components.connectionManager.getConnections()
        const currentConnectionCount = connections.length
        const maxConnections = this.components.connectionManager.getMaxConnections()

        //return ((currentConnectionCount / maxConnections) * 100) < this.init.connectionThreshold
        return Math.max(0, maxConnections * this.init.connectionThreshold * 0.01 - currentConnectionCount)
    }
}

function getLastDial(peer: Peer): number {
    const lastDial = peer.metadata.get('last-dial-success')
    return (lastDial == null) ? 0 : new Date(uint8ArrayToString(lastDial)).getTime()
}
  