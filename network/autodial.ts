//src: @libp2p/circuit-relay-v2/src/transport/discovery.ts
//src: @libp2p/autonat/src/autonat.ts
//src: libp2p/src/connection-manager/connection-pruner.ts
//src: libp2p/src/connection-manager/dial-queue.ts

import { isPeerId, type ComponentLogger, type Connection, type Libp2pEvents, type Logger, type PeerId, type PeerInfo, type PeerStore, type PeerUpdate, type Startable, type TypedEventTarget } from "@libp2p/interface"
import type { ConnectionManager, TransportManager } from "@libp2p/interface-internal"
//import { setMaxListeners } from 'main-event'
//import { anySignal } from 'any-signal'
import { PeerMap } from "@libp2p/peer-collections"
import { CODE_P2P, type AbortOptions, type Multiaddr } from "@multiformats/multiaddr"
import { Queue, type Job, type QueueInit } from "@libp2p/utils/queue"
import type { TorrentPeerDiscovery } from "./torrent-discovery"

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
    torrentPeerDiscovery?: TorrentPeerDiscovery
}

export function autodial(init: AutodialInit = {}): (components: AutodialComponents) => Autodial {
    return (components: AutodialComponents) => new Autodial(init, components)
}

type u = undefined
type DialTarget = PeerId | Multiaddr
type DialJobOptions = AbortOptions & DialTargetInfo
class DialTargetInfo {
    public readonly target: DialTarget
    public beenInQueue: boolean = false
    public lastPeerInfo?: AutodialPeerInfo
    public connectionToReplace?: Connection // Temporary value holder.
    constructor(target: DialTarget){
        this.target = target
    }
}
class AutodialPeerInfo {
    public readonly id: PeerId
    
    public value: number = 0
    public pinned: boolean = false
    public unpinTimeout: u|ReturnType<typeof setTimeout>

    public connections?: Connection[] // Temporary value holder.

    constructor(id: PeerId){
        this.id = id
    }

    public pin(unpinTimeout: number /*= Infinity*/, onunpin: () => void){
        if(this.pinned) return
        this.pinned = true
        clearTimeout(this.unpinTimeout)
        this.unpinTimeout = Number.isFinite(unpinTimeout) ?
        setTimeout(() => { this.unpin(); onunpin() }, unpinTimeout) :
        undefined
    }

    public unpin(){
        if(!this.pinned) return
        this.pinned = false
        clearTimeout(this.unpinTimeout)
        this.unpinTimeout = undefined
    }
}

type JobChecker<JobOptions extends AbortOptions, JobReturnType> = (job: Job<JobOptions, JobReturnType>) => boolean
class CheckingQueue<JobReturnType = unknown, JobOptions extends AbortOptions = AbortOptions> extends Queue<JobReturnType, JobOptions> {
    private readonly check: JobChecker<JobOptions, JobReturnType>
    constructor (init: QueueInit<JobReturnType, JobOptions> & {
        check?: JobChecker<JobOptions, JobReturnType>
    }){
        super(init)
        this.check = init.check ?? (() => true)
        const tryToStartAnother = this['tryToStartAnother'] as () => boolean
        this['tryToStartAnother'] = () => {
            let allowed = true
            if(this.size !== 0 && this.running < this.concurrency){
                const job = this.queue.find(j => j.status === 'queued')
                if(job != null){
                    allowed = this.check(job)
                }
            }
            return allowed && tryToStartAnother.call(this)
        }
    }
    public kick(){
        const tryToStartAnother = this['tryToStartAnother']
        return tryToStartAnother.call(this)
    }
}

class Autodial implements Startable {

    readonly [Symbol.toStringTag] = '@libp2p/autodial'

    private readonly log: Logger
    private readonly init: Required<AutodialInit>
    private readonly components: AutodialComponents

    private started = false

    private readonly queue: CheckingQueue<void, DialJobOptions>
    private readonly queue_findIndex = (target: DialTarget) => {
        return this.queue.queue.findIndex(job => {
            return job.options.target && job.options.target.toString() === target.toString()
        })
    }
    private readonly queue_delete = (target: DialTarget) => {
        const index = this.queue_findIndex(target)
        if(index !== -1){
            this.queue.queue.splice(index, 1)
            return true
        }
        return false
    }

    private readonly targetInfos = new PeerMap<DialTargetInfo>() as unknown as Map<DialTarget, DialTargetInfo>
    private readonly targetInfos_getset = (id: DialTarget) => {
        let info = this.targetInfos.get(id)
        if(!info){
            info = new DialTargetInfo(id)
            this.targetInfos.set(id, info)
        }
        return info
    }

    private readonly peerInfos = new PeerMap<AutodialPeerInfo>() 
    private readonly peerInfos_getset = (id: PeerId): AutodialPeerInfo => {
        let info = this.peerInfos.get(id)
        if(!info){
            info = new AutodialPeerInfo(id)
            this.peerInfos.set(id, info)
        }
        return info
    }

    constructor(init: AutodialInit, components: AutodialComponents){
        this.log = components.logger.forComponent('libp2p:autodial')
        this.components = components
        this.init = {
            connectionThreshold: init.connectionThreshold ?? 80,
            concurrency: init.concurrency ?? 10,
            unpinTimeout: init.unpinTimeout ?? 30_000,
        }
        this.queue = new CheckingQueue({
            concurrency: this.init.concurrency,
            maxSize: Infinity,
            sort: (a, b) => {
                if(a.status === 'queued' && b.status === 'queued'){
                    const a_options_value = a.options.lastPeerInfo?.value ?? 0
                    const b_options_value = b.options.lastPeerInfo?.value ?? 0
                    if(a_options_value > b_options_value) return -1
                    if(a_options_value < b_options_value) return +1
                }
                else if(a.status === 'queued') return +1
                else if(b.status === 'queued') return -1
                return 0
            },
            check: this.checkCapacity
        })
    }

    start(){
        if(this.started) return
        this.started = true

        //TODO: Load peers from PeerStore.

        this.components.torrentPeerDiscovery?.addEventListener('addr', this.onPeerAddress)

        this.components.events.addEventListener('peer:discovery', this.onPeerDiscovery)
        this.components.events.addEventListener('peer:connect', this.onPeerConnect)
        this.components.events.addEventListener('peer:update', this.onPeerUpdate)
        this.components.events.addEventListener('peer:disconnect', this.onPeerDisconnect)

        this.queue.kick()
    }

    stop(){
        if(!this.started) return
        this.started = false

        this.peerInfos.forEach(peerValue => clearTimeout(peerValue.unpinTimeout))

        this.components.torrentPeerDiscovery?.removeEventListener('addr', this.onPeerAddress)

        this.components.events.removeEventListener('peer:discovery', this.onPeerDiscovery)
        this.components.events.removeEventListener('peer:connect', this.onPeerConnect)
        this.components.events.removeEventListener('peer:update', this.onPeerUpdate)
        this.components.events.removeEventListener('peer:disconnect', this.onPeerDisconnect)

        this.queue.abort()
    }

    private readonly onPeerAddress = ({ detail: multiaddr }: CustomEvent<Multiaddr>) => {
        
        this.log.trace('peer:discovery:address', multiaddr)

        // It is assumed that the Multiaddr does not contain a PeerId.
        // Otherwise, the discovery mechanism would have announced PeerInfo.
        
        const info = this.targetInfos_getset(multiaddr)
        const multiaddrs = [ multiaddr ]
        
        this.maybeQueueTarget(undefined, info, multiaddrs)
        this.queue.kick()
    }

    private readonly onPeerDiscovery = ({ detail: peer }: CustomEvent<PeerInfo>) => {
        const { id: peerId } = peer

        this.log.trace('peer:discovery', peerId)

        const info = this.targetInfos_getset(peerId)
        const multiaddrs = peer.multiaddrs.map(ma => ma.decapsulateCode(CODE_P2P))
        
        this.maybeQueueTarget(peerId, info, multiaddrs)
        this.queue.kick()
    }
    private readonly onPeerConnect = ({ detail: peerId }: CustomEvent<PeerId>) => {

        this.log.trace('peer:connect', peerId)
        
        const info = this.peerInfos_getset(peerId)
        info.pin(this.init.unpinTimeout, () => this.queue.kick())
        
        this.queue_delete(peerId)
        this.queue.kick()
    }
    private readonly onPeerUpdate = ({ detail: { peer } }: CustomEvent<PeerUpdate>) => {
        const { id: peerId } = peer

        this.log.trace('peer:update', peerId)

        const tinfo = this.targetInfos_getset(peerId)
        const multiaddrs = peer.addresses.map(addr => addr.multiaddr)

        const pinfo = this.peerInfos_getset(peerId)
        pinfo.value = Math.max(pinfo.value, [...peer.tags.values()].reduce((acc, curr) => {
            return acc + curr.value
        }, 0))
        
        // If the peer has changed its address and is now dialable.
        this.maybeQueueTarget(peerId, tinfo, multiaddrs)
        this.queue.kick()
    }
    private readonly onPeerDisconnect = ({ detail: peerId }: CustomEvent<PeerId>) => {
        
        this.log.trace('peer:disconnect', peerId)

        const info = this.peerInfos_getset(peerId)
        info.unpin()

        this.queue_delete(peerId) // Just in case.
        this.queue.kick()
    }

    private maybeQueueTarget(peerId: u|PeerId, info: DialTargetInfo, multiaddrs: Multiaddr[]){
        const cm = this.components.connectionManager
        try {
            //if(peerId && this.queue_has(peerId)){
            if(info.beenInQueue){
                //this.log.trace('peer %p was already in queue', peerId)
                return false
            } else if(peerId && cm.getConnections(peerId)?.length > 0){
                //this.log.trace('peer %p was already connected', peerId)
                return false
            } else if(!this.components_connectionManager_isDialableSync(multiaddrs)){
                //this.log.trace('peer %p was not dialable', peerId)
                return false
            } else {
                info.beenInQueue = true
                this.log.trace('adding peer %p to dial queue', peerId)
                this.queue.add(this.dialPeer, info).catch(err => {
                    this.log.error('error opening connection to peer %p - %e', peerId, err)
                })
                return true
            }
        } catch(err){
            this.log.trace('error adding peer %p to queue - %e', peerId, err)
        }
        return false
    }

    private readonly dialPeer = async (info: DialJobOptions): Promise<void> => {
        const { target, /*signal,*/ connectionToReplace } = info
        const cm = this.components.connectionManager

        //const combinedSignal = anySignal([AbortSignal.timeout(5_000), signal])
        //setMaxListeners(Infinity, combinedSignal)
        //try {
            if(connectionToReplace){
                //info.connectionToReplace = undefined
                const peerId = connectionToReplace.remotePeer
                this.log.trace('closing connection to peer %p', peerId)
                await connectionToReplace.close()
            }
            if(isPeerId(target)){
                const peerId = target
                this.log.trace('opening connection to peer %p', peerId)
                const connection = await cm.openConnection(peerId, /*{ signal: combinedSignal }*/)
                
                const multiaddr = connection.remoteAddr.decapsulateCode(CODE_P2P)
                this.merge(peerId, multiaddr)
            } else {
                const multiaddr1 = target
                this.log.trace('opening connection to addr %a', multiaddr1)
                const connection = await cm.openConnection(multiaddr1, /*{ signal: combinedSignal }*/)
                //TODO: Close if already have connection to that peer.
                
                const peerId = connection.remotePeer
                //const multiaddr2 = connection.remoteAddr.decapsulateCode(CODE_P2P)
                this.merge(peerId, multiaddr1)
                //this.merge(peerId, multiaddr2)
            }
        //} finally {
        //    combinedSignal.clear()
        //}
    }

    private merge(peerId: PeerId, multiaddr: Multiaddr){
        const ps = this.components.peerStore

        this.log.trace('merging peer %p with addr %a', peerId, multiaddr)

        const pinfo = this.peerInfos_getset(peerId)
        const tinfo = this.targetInfos_getset(multiaddr)
        tinfo.beenInQueue = true
        tinfo.lastPeerInfo = pinfo
        
        this.queue_delete(peerId)
        this.queue_delete(multiaddr)
        
        ps.merge(peerId, {
            multiaddrs: [ multiaddr ]
        }).catch(err => {
            this.log.error('failed to add addr %a to peer %p - %e', multiaddr, peerId, err)
        })
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
        } catch(err){
            this.log.trace('error calculating if multiaddr(s) were dialable', err)
        }
        return false
    }

    private checkCapacity({ options: queued }: typeof this.queue.queue[0]): boolean {
        
        const cm = this.components.connectionManager
        const connections = cm.getConnections()
        const maxConnections = cm.getMaxConnections()
        const connectionsAllowed = maxConnections * this.init.connectionThreshold * 0.01
        const currentConnectionCount = connections.length + this.queue.running

        this.log.trace(`capacity ${connections.length}/${currentConnectionCount}/${connectionsAllowed}/${maxConnections}`)

        if(currentConnectionCount < connectionsAllowed){
            return true
        }
        
        const info = [...cm.getConnectionsMap().entries()]
        .map(([peerId, connections]) => {
            const info = this.peerInfos.get(peerId)!
            info.connections = connections
            return info
        })
        .filter(info => {
            return !info.pinned
        })
        .reduce((accum: u|AutodialPeerInfo, info) => {
            return (accum && accum.value < info.value) ? accum : info
        }, undefined)

        const { target } = queued
        const queued_value = queued.lastPeerInfo?.value ?? 0
        if(info && (info.value === 0 || info.value < queued_value)){
            this.log.trace('connection to peer %p will be replaced with', info.id)
            if(isPeerId(target)) this.log.trace('connection to peer %p', target)
            else                 this.log.trace('connection to addr %a', target)
            queued.connectionToReplace = info.connections![0]!
            return true
        }
        return false
    }
}
