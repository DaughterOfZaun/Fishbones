//src: @libp2p/circuit-relay-v2/src/transport/discovery.ts
//src: @libp2p/autonat/src/autonat.ts
//src: libp2p/src/connection-manager/connection-pruner.ts
//src: libp2p/src/connection-manager/dial-queue.ts

import type { ComponentLogger, Libp2pEvents, Logger, PeerId, PeerInfo, PeerStore, PeerUpdate, Startable, TypedEventTarget } from "@libp2p/interface"
import type { ConnectionManager, TransportManager } from "@libp2p/interface-internal"
import { setMaxListeners } from 'main-event'
import { anySignal } from 'any-signal'
import { PeerMap } from "@libp2p/peer-collections"
import { type AbortOptions, type Multiaddr } from "@multiformats/multiaddr"
import { Queue, type QueueInit } from "@libp2p/utils/queue"

interface AutodialInit {
    connectionThreshold?: number
    concurrency?: number
    unpinTimeout?: number
}
interface AutodialComponents {
    logger: ComponentLogger
    connectionManager: ConnectionManager
    events: TypedEventTarget<Libp2pEvents>
    peerStore: PeerStore
    transportManager: TransportManager
}

export function autodial(init: AutodialInit): (components: AutodialComponents) => Autodial {
    return (components: AutodialComponents) => new Autodial(init, components)
}

type DialJobOptions = AbortOptions & AutodialPeerInfo
class AutodialPeerInfo {
    id: PeerId
    value: number = 0
    pinned: boolean = false
    unpinTimeout: undefined | ReturnType<typeof setTimeout>
    multiaddrs: Multiaddr[] = []
    constructor(id: PeerId){
        this.id = id
    }
    public pin(unpinTimeout: number /*= Infinity*/, onunpin: () => void){
        if(this.pinned) return
        this.pinned = true
        
        //if(Number.isFinite(unpinTimeout))
        this.unpinTimeout = setTimeout(() => {
            this.unpin()
            onunpin()
        }, unpinTimeout)
    }
    public unpin(){
        if(!this.pinned) return
        this.pinned = false
        
        clearTimeout(this.unpinTimeout)
        this.unpinTimeout = undefined
    }
}

class PausableQueue<JobReturnType = unknown, JobOptions extends AbortOptions = AbortOptions> extends Queue<JobReturnType, JobOptions> {
    autoStart: boolean
    constructor (init: QueueInit<JobReturnType, JobOptions> & { autoStart?: boolean } = {}) {
        super(init)
        this.autoStart = init.autoStart ?? true
        const tryToStartAnother = this['tryToStartAnother']
        this['tryToStartAnother'] = () => {
            return this.autoStart ?
                tryToStartAnother.call(this) :
                false
        }
    }
    start (): void {
        if (this.autoStart) return
        this.autoStart = true
        this['tryToStartAnother']()
    }
    pause (): void {
        this.autoStart = false
    }
}

class Autodial implements Startable {

    readonly [Symbol.toStringTag] = '@libp2p/autodial'

    private readonly log: Logger
    private readonly init: Required<AutodialInit>
    private readonly components: AutodialComponents

    private started = false
    private running = false

    private readonly queue: PausableQueue<void, DialJobOptions>
    private readonly queue_has = (peerId: PeerId): boolean => {
        return this.queue_find(peerId) != null
    }
    private readonly queue_find = (peerId: PeerId) => {
        return this.queue.queue.find(job => peerId.equals(job.options.id))
    }
    private readonly queue_delete = (peerId: PeerId) => {
        const index = this.queue.queue.findIndex(job => peerId.equals(job.options.id))
        if(index !== -1){
            this.queue.queue.splice(index, 1)
            return true
        }
        return false
    }
    private readonly queue_sort = () => {
        const this_queue_sort = this.queue['sort']
        if (this_queue_sort != null) {
            this.queue.queue.sort(this_queue_sort)
        }
    }

    private readonly peerInfos = new PeerMap<AutodialPeerInfo>()
    private readonly peerInfos_get = (id: PeerId): AutodialPeerInfo => {
        let info = this.peerInfos.get(id)
        if(!info){
            info = new AutodialPeerInfo(id)
            this.peerInfos.set(id, info)
        }
        return info
    }

    constructor(init: AutodialInit, components: AutodialComponents) {
        this.log = components.logger.forComponent('libp2p:autodial')
        this.components = components
        this.init = {
            connectionThreshold: init.connectionThreshold ?? 80,
            concurrency: init.concurrency ?? 10,
            unpinTimeout: init.unpinTimeout ?? 30_000,
        }
        this.queue = new PausableQueue({
            concurrency: this.init.concurrency,
            maxSize: Infinity,
            autoStart: false,
            sort: (a, b) => {
                if(a.status !== b.status){
                    if(a.status === 'running') return -1
                    if(b.status === 'running') return +1
                }
                if(a.options.value > b.options.value) return -1
                if(a.options.value < b.options.value) return +1
                return 0
            }
        })
    }

    start() {
        if (this.started) return
        this.started = true

        //TODO: Load peers from PeerStore.

        this.components.events.addEventListener('peer:discovery', this.onPeerDiscovery)
        this.components.events.addEventListener('peer:connect', this.onPeerConnect)
        this.components.events.addEventListener('peer:update', this.onPeerUpdate)
        this.components.events.addEventListener('peer:disconnect', this.onPeerDisconnect)

        this.startAutodial()
    }

    stop() {
        if (!this.started) return
        this.started = false

        this.peerInfos.forEach(peerValue => clearTimeout(peerValue.unpinTimeout))

        this.components.events.removeEventListener('peer:discovery', this.onPeerDiscovery)
        this.components.events.removeEventListener('peer:connect', this.onPeerConnect)
        this.components.events.removeEventListener('peer:update', this.onPeerUpdate)
        this.components.events.removeEventListener('peer:disconnect', this.onPeerDisconnect)

        this.stopAutodial()
    }

    private startAutodial() {
        if (this.running) return
        this.running = true
        
        this.log('starting autodial')
        this.queue.start()
    }

    private stopAutodial() {
        if (!this.running) return
        this.running = false

        this.log('stopping autodial')
        this.queue.pause()
    }

    private readonly onPeerDiscovery = ({ detail: peer }: CustomEvent<PeerInfo>) => {
        const { id: peerId } = peer

        const info = this.peerInfos_get(peerId)
        info.multiaddrs = peer.multiaddrs
        
        this.maybeQueuePeer(info)

        this.checkCapacity()
    }
    private readonly onPeerConnect = ({ detail: peerId }: CustomEvent<PeerId>) => {
        
        const info = this.peerInfos_get(peerId)
        info.pin(this.init.unpinTimeout, () => this.checkCapacity())
        
        this.queue_delete(peerId)
        
        this.checkCapacity()
    }
    private readonly onPeerUpdate = ({ detail: { peer } }: CustomEvent<PeerUpdate>) => {
        const { id: peerId } = peer

        const info = this.peerInfos_get(peerId)
        info.multiaddrs = peer.addresses.map(addr => addr.multiaddr)
        info.value = [...peer.tags.values()].reduce((acc, curr) => {
            return acc + curr.value
        }, 0)
        
        // If the peer has changed its address and is now dialable.
        this.maybeQueuePeer(info)
        // If the peer is already in the queue.
        this.queue_sort()

        this.checkCapacity()
    }
    private readonly onPeerDisconnect = ({ detail: peerId }: CustomEvent<PeerId>) => {
        
        const info = this.peerInfos_get(peerId)
        info.unpin()

        this.checkCapacity()
    }

    private maybeQueuePeer(info: AutodialPeerInfo){
        const { id: peerId, multiaddrs } = info
        try {
            if (this.queue_has(peerId)) {
                this.log.trace('peer %p was already in queue', peerId)
                return false
            } else if (this.components.connectionManager.getConnections(peerId)?.length > 0) {
                this.log.trace('peer %p was already connected', peerId)
                return false
            } else if (!this.components_connectionManager_isDialableSync(multiaddrs)) {
                this.log.trace('peer %p was not dialable', peerId)
                return false
            } else {
                this.log.trace('adding peer %p to dial queue', peerId)
                this.queue.add(this.dialPeer, info).catch(err => {
                    this.log.error('error opening connection to peer %p - %e', peerId, err)
                })
                return true
            }
        } catch(err) {
            this.log.trace('error adding peer %p to queue - %e', peerId, err)
        }
        return false
    }

    private readonly dialPeer = async ({ id: peerId, signal }: DialJobOptions): Promise<void> => {
        const combinedSignal = anySignal([AbortSignal.timeout(5_000), signal])
        setMaxListeners(Infinity, combinedSignal)
        try {
            this.log.trace('opening connection to peer %p', peerId)
            await this.components.connectionManager.openConnection(peerId, {
                signal: combinedSignal
            })
        } finally {
            combinedSignal.clear()
        }
    }

    private components_connectionManager_isDialableSync(multiaddrs: Multiaddr[]): boolean {
        try {
            const addresses = multiaddrs.filter(ma => {
                return !!this.components.transportManager.dialTransportForMultiaddr(ma)
            })
            //if(options.runOnLimitedConnection === false){
            //    return !!addresses.find(addr => !Circuit.matches(addr.multiaddr))
            //}
            return addresses.length > 0
        } catch (err) {
            this.log.trace('error calculating if multiaddr(s) were dialable', err)
        }
        return false
    }

    private checkCapacity(){
        const hasCapacity = this.hasCapacity()
        if(this.running && !hasCapacity) this.stopAutodial()
        if(!this.running && hasCapacity) this.startAutodial()
    }

    private hasCapacity(){
        const connections = this.components.connectionManager.getConnections()
        const maxConnections = this.components.connectionManager.getMaxConnections()
        const connectionsAllowed = maxConnections * this.init.connectionThreshold * 0.01
        const currentConnectionCount = connections.length
        if(currentConnectionCount < connectionsAllowed){
            return true
        }
        const queued = this.queue.queue.find(job => job.status === 'queued')
        return connections.some(connection => {
            const peerId = connection.remotePeer
            const info = this.peerInfos.get(peerId)!
            const queued_options_value = queued?.options.value ?? 0
            return !info.pinned && (info.value === 0 || info.value < queued_options_value)
        })
    }
}
