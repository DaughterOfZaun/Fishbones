//src: @libp2p/circuit-relay-v2/src/transport/discovery.ts
//src: @libp2p/autonat/src/autonat.ts
//src: libp2p/src/connection-manager/connection-pruner.ts
//src: libp2p/src/connection-manager/dial-queue.ts

import { isPeerId, type ComponentLogger, type Connection, type Libp2pEvents, type Logger, type PeerId, type PeerInfo, type PeerStore, type PeerUpdate, type Startable, type TypedEventTarget } from "@libp2p/interface"
import type { ConnectionManager, TransportManager } from "@libp2p/interface-internal"
//import { setMaxListeners } from 'main-event'
//import { anySignal } from 'any-signal'
import { PeerMap, PeerSet } from "@libp2p/peer-collections"
import { CODE_P2P_CIRCUIT, type AbortOptions, type Multiaddr } from "@multiformats/multiaddr"
import { Queue, type Job, type QueueInit } from "@libp2p/utils/queue"
import { peerIdFromString } from "@libp2p/peer-id"

interface AutodialInit {
    connectionThreshold?: number
    concurrency?: number
    unpinTimeout?: number
    //derive: DeriveFunc
}
interface AutodialComponents {
    logger: ComponentLogger
    connectionManager: ConnectionManager
    events: TypedEventTarget<Libp2pEvents>
    peerStore: PeerStore
    transportManager: TransportManager
}

export function autodial(init: AutodialInit = {}): (components: AutodialComponents) => Autodial {
    return (components: AutodialComponents) => new Autodial(init, components)
}

type u = undefined
//type HostPort = { host: string, port: number }
//type DeriveFunc = ({ host, port }: HostPort) => Multiaddr[]
type AddrId = string & { __brand: 'addr-id' }
// The function should always return the same values for addresses that we are sure belong to the same peer.
const idFromMultiaddr = (ma: Multiaddr): DialTarget => {
    // It may not be compatible with all transports.
    if(ma.getComponents().some(c => c.code === CODE_P2P_CIRCUIT)){
        const peerIdStr = ma.getPeerId()
        console.assert(peerIdStr != null)
        return peerIdFromString(peerIdStr!)
    }
    const { host, port, transport, family: v } = ma.toOptions()
    return `/ip${v}/${host}/${transport}/${port}` as AddrId
}
type DialTarget = PeerId | AddrId
type DialJobOptions = AbortOptions & DialTargetInfo
type DialTargetInfoMultiaddr = DialTargetInfo & { target: AddrId }
type DialTargetInfoPeerId = DialTargetInfo & { target: PeerId, info: AutodialPeerInfo }
class DialTargetInfo {
    public readonly target: DialTarget
    public multiaddrs = new PeerSet() as unknown as Set<Multiaddr>
    public beenInQueue: boolean = false
    public info?: AutodialPeerInfo
    public connected: number = 0
    public connectionToReplace?: Connection // Temporary value holder.
    public constructor(target: DialTarget){
        this.target = target
    }
    private string: u|string
    public toString(){
        return this.string ?? (
            this.string = isPeerId(this.target) ?
            `peer ${this.target.toString()}` :
            `addr ${this.target.toString()}`
        )
    }
}
class AutodialPeerInfo {
    public readonly id: PeerId
    
    public value: number = 0
    public pinned: boolean = false
    public unpinTimeout: u|ReturnType<typeof setTimeout>

    public connected: boolean = false
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
type JobFilter<JobOptions extends AbortOptions, JobReturnType> = (job: Job<JobOptions, JobReturnType>, running: Job<JobOptions, JobReturnType>[]) => boolean
class CheckingQueue<JobReturnType = unknown, JobOptions extends AbortOptions = AbortOptions> extends Queue<JobReturnType, JobOptions> {
    private readonly check: JobChecker<JobOptions, JobReturnType>
    private readonly filter: JobFilter<JobOptions, JobReturnType>
    constructor (init: QueueInit<JobReturnType, JobOptions> & {
        filter?: JobFilter<JobOptions, JobReturnType>
        check?: JobChecker<JobOptions, JobReturnType>
    }){
        super(init)
        this.filter = init.check ?? (() => true)
        this.check = init.check ?? (() => true)
        const tryToStartAnother = this['tryToStartAnother'] as () => boolean
        this['tryToStartAnother'] = () => {
            let allowed = true
            if(this.size !== 0 && this.running < this.concurrency){
                const running = []
                for(const job of this.queue){
                    if(job.status === 'running'){
                        running.push(job)
                    } else if(job.status.startsWith('queued')){
                        if(this.filter(job, running)){
                            job.status = 'queued'
                            allowed = this.check(job)
                            break
                        } else {
                            job.status = 'queued-x2' as 'queued'
                            continue
                        }
                    }
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

const sort = <T>(acc: -1 | 0 | 1, a: T, b: T, dir: 'asc' | 'dsc', by: (x: T) => number|boolean): -1 | 0 | 1 => {
    if(acc != 0) return acc
    const av = by(a), bv = by(b)
    return +(av != bv)
        * ((av > bv) ? +1 : -1)
        * (+(dir == 'asc') * 2 - 1) as -1 | 0 | 1
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
            return job.status === 'queued'
                && job.options.target.toString() === target.toString()
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
    private targetInfos_getset(id: PeerId): DialTargetInfoPeerId
    private targetInfos_getset(id: AddrId): DialTargetInfoMultiaddr
    private targetInfos_getset(id: DialTarget): DialTargetInfo
    private targetInfos_getset(id: DialTarget): DialTargetInfo {
        let tinfo = this.targetInfos.get(id)
        if(!tinfo){
            tinfo = new DialTargetInfo(id)
            if(isPeerId(id)){
                tinfo.info = this.peerInfos_getset(id)
            }
            this.targetInfos.set(id, tinfo)
        }
        return tinfo
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
            //derive: init.derive,
        }
        this.queue = new CheckingQueue({
            concurrency: this.init.concurrency,
            maxSize: Infinity,
            sort: (a, b) => {
                let acc: -1 | 0 | 1 = 0
                acc = sort(acc, a, b, 'asc', x => x.status === 'queued')
                //acc = sort(acc, a, b, 'asc', x => isPeerId(x.id))
                acc = sort(acc, a, b, 'dsc', x => x.options.info?.value ?? 0)
                return acc
            },
            filter: (job, running) => {
                return !running.some(j => j.options.multiaddrs.intersection(job.options.multiaddrs))
            },
            check: (job) => this.checkCapacity(job.options),
        })
    }

    start(){
        if(this.started) return
        this.started = true

        //TODO: Load peers from PeerStore.

        ////@ts-expect-error Argument of type A is not assignable to parameter of type B.
        //this.components.events.addEventListener('addr:discovery', this.onAddressDiscovery)
        //this.components.events.addEventListener('peer:discovery', this.onPeerDiscovery)
        this.components.events.addEventListener('peer:connect', this.onPeerConnect)
        this.components.events.addEventListener('peer:update', this.onPeerUpdate)
        this.components.events.addEventListener('peer:disconnect', this.onPeerDisconnect)
        this.components.events.addEventListener('connection:open', this.onConnectionOpen)
        this.components.events.addEventListener('connection:close', this.onConnectionClose)

        this.queue.kick()
    }

    stop(){
        if(!this.started) return
        this.started = false

        this.peerInfos.forEach(peerValue => clearTimeout(peerValue.unpinTimeout))

        ////@ts-expect-error Argument of type A is not assignable to parameter of type B.
        //this.components.events.removeEventListener('addr:discovery', this.onAddressDiscovery)
        //this.components.events.removeEventListener('peer:discovery', this.onPeerDiscovery)
        this.components.events.removeEventListener('peer:connect', this.onPeerConnect)
        this.components.events.removeEventListener('peer:update', this.onPeerUpdate)
        this.components.events.removeEventListener('peer:disconnect', this.onPeerDisconnect)
        this.components.events.removeEventListener('connection:open', this.onConnectionOpen)
        this.components.events.removeEventListener('connection:close', this.onConnectionClose)

        this.queue.abort()
    }

    public readonly onAddressDiscovery = ({ detail: derived }: CustomEvent<Multiaddr[]>) => {
        
        this.log.trace('peer:discovery:address', derived.map(ma => ma.toString()))

        // It is assumed that the Multiaddr does not contain a PeerId.
        // Otherwise, the discovery mechanism would have announced PeerInfo.
        /*
        for(const multiaddr of derived){
            const addrId = idFromMultiaddr(multiaddr)
            const info = this.targetInfos_getset(addrId)
            info.multiaddrs.add(multiaddr)
            this.maybeQueueTarget(info)
        }
        */
        if(derived.length === 0) return
        const addrId = idFromMultiaddr(derived[0]!)
        //console.assert(derived.every(ma => idFromMultiaddr(ma) === addrId))
        const info = this.targetInfos_getset(addrId)
        for(const multiaddr of derived)
            info.multiaddrs.add(multiaddr)
        
        if(this.maybeQueueTarget(info))
            this.queue.kick()
    }

    public readonly onPeerDiscovery = ({ detail: peer }: CustomEvent<PeerInfo>) => {
        const { id: peerId } = peer

        this.log.trace('peer:discovery', peerId)

        const info = this.targetInfos_getset(peerId)
        for(const multiaddr of peer.multiaddrs)
            info.multiaddrs.add(multiaddr)
        
        if(this.maybeQueueTarget(info))
            this.queue.kick()
    }
    private readonly onPeerConnect = ({ detail: peerId }: CustomEvent<PeerId>) => {

        this.log.trace('peer:connect', peerId)
        
        const info = this.peerInfos_getset(peerId)
        info.pin(this.init.unpinTimeout, () => this.queue.kick())
        info.connected = true
        
        if(this.queue_delete(peerId))
            this.queue.kick()
    }
    private readonly onPeerUpdate = ({ detail: { peer } }: CustomEvent<PeerUpdate>) => {
        const { id: peerId } = peer

        this.log.trace('peer:update', peerId)

        const tinfo = this.targetInfos_getset(peerId)
        for(const multiaddr of peer.addresses.map(addr => addr.multiaddr))
            tinfo.multiaddrs.add(multiaddr)

        //const pinfo = this.peerInfos_getset(peerId)
        const pinfo = tinfo.info
        pinfo.value = Math.max(pinfo.value, [...peer.tags.values()].reduce((acc, curr) => {
            return acc + curr.value
        }, 0))
        
        // If the peer has changed its address and is now dialable.
        //if(this.maybeQueueTarget(tinfo))
        //    this.queue.kick()
    }
    private readonly onPeerDisconnect = ({ detail: peerId }: CustomEvent<PeerId>) => {
        
        this.log.trace('peer:disconnect', peerId)

        const info = this.peerInfos_getset(peerId)
        info.connected = false
        info.unpin()

        if(this.queue_delete(peerId)) // Just in case.
            this.queue.kick()
    }

    private maybeQueueTarget(/*peerId: u|PeerId,*/ info: DialTargetInfo, /*multiaddrs: Multiaddr[]*/){
        //const cm = this.components.connectionManager
        const multiaddrs = [...info.multiaddrs.values()]
        try {
            //if(peerId && this.queue_has(peerId)){
            if(info.beenInQueue){
                this.log.trace(`${info.toString()} was already in queue`)
                return false
            //} else if(peerId && cm.getConnections(peerId)?.length > 0){
            } else if(info.connected || info.info?.connected){
                this.log.trace(`${info.toString()} was already connected`)
                return false
            } else if(!this.components_connectionManager_isDialableSync(multiaddrs)){
                this.log.trace(`${info.toString()} was not dialable`)
                return false
            } else {
                info.beenInQueue = true
                this.log.trace(`adding ${info.toString()} to dial queue`)
                this.queue.add(this.dialPeer, info).catch(err => {
                    this.log.error(`error opening connection to ${info.toString()} - %e`, err)
                })
                return true
            }
        } catch(err){
            this.log.error(`error adding ${info.toString()} to queue - %e`, err)
        }
        return false
    }

    private readonly dialPeer = async (info: DialJobOptions): Promise<void> => {
        const { target, connectionToReplace } = info
        const multiaddrs = [...info.multiaddrs.values()]
        const cm = this.components.connectionManager
        const ps = this.components.peerStore

        //const combinedSignal = anySignal([AbortSignal.timeout(5_000), signal])
        //setMaxListeners(Infinity, combinedSignal)
        //try {
            if(connectionToReplace){
                //info.connectionToReplace = undefined
                const peerId = connectionToReplace.remotePeer
                this.log('closing connection to peer %p', peerId)
                await connectionToReplace.close()
            }
            if(isPeerId(target)){
                const peerId = target
                this.log('opening connection to peer %p', peerId)
                /*const connection =*/ await cm.openConnection(peerId, /*{ signal: combinedSignal }*/)
            } else {
                this.log('opening connection to addr %a', target)
                const connection = await cm.openConnection(multiaddrs, /*{ signal: combinedSignal }*/)

                //TODO: Close if already have connection to that peer.
                
                const peerId = connection.remotePeer
                const multiaddr = connection.remoteAddr
                ps.merge(peerId, { multiaddrs: [ multiaddr ] }).catch(err => {
                    this.log.error('failed merge peer %p with addr %a - %e', peerId, target, err)
                })
            }
        //} finally {
        //    combinedSignal.clear()
        //}
    }

    private readonly onConnectionOpen = ({ detail: connection }: CustomEvent<Connection>) => {
        
        this.log.trace('connection:open', connection.remoteAddr)

        const peerId = connection.remotePeer
        const multiaddr = connection.remoteAddr//.decapsulateCode(CODE_P2P)
        const addrId = idFromMultiaddr(multiaddr)
        
        const tinfo1 = this.targetInfos_getset(peerId)
        tinfo1.beenInQueue = true
        tinfo1.connected++
        this.queue_delete(tinfo1.target)
        
        if(peerId.toString() != addrId.toString()){
            
            this.log('merging peer %p with addr %a', peerId, addrId)

            const tinfo2 = this.targetInfos_getset(addrId)
            tinfo2.beenInQueue = true
            tinfo2.info = tinfo1.info
            tinfo2.connected++
            this.queue_delete(tinfo2.target)
        }
        
        this.queue.kick()
    }

    private readonly onConnectionClose = ({ detail: connection }: CustomEvent<Connection>) => {

        this.log.trace('connection:close', connection.remoteAddr)

        const peerId = connection.remotePeer
        const multiaddr = connection.remoteAddr//.decapsulateCode(CODE_P2P)
        const addrId = idFromMultiaddr(multiaddr)

        const tinfo1 = this.targetInfos_getset(peerId)
        tinfo1.connected--

        if(peerId.toString() != addrId.toString()){
            const tinfo2 = this.targetInfos_getset(addrId)
            tinfo2.connected--
        }

        this.queue.kick()
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
            this.log.error('error calculating if multiaddr(s) were dialable', err)
        }
        return false
    }

    private checkCapacity(queued: DialJobOptions): boolean {
        
        const cm = this.components.connectionManager
        const connections = cm.getConnections()
        const maxConnections = cm.getMaxConnections()
        const connectionsAllowed = maxConnections * this.init.connectionThreshold * 0.01
        const currentConnectionCount = connections.length + this.queue.running

        this.log(`capacity ${connections.length}/${currentConnectionCount}/${connectionsAllowed}/${maxConnections}`)

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

        const { target } = queued // For log output only.
        const queued_value = queued.info?.value ?? 0
        if(info && (info.value === 0 || info.value < queued_value)){
            this.log('connection to peer %p will be replaced with', info.id)
            if(isPeerId(target)) this.log('connection to peer %p', target)
            else                 this.log('connection to addr %a', target)
            queued.connectionToReplace = info.connections![0]!
            return true
        }
        return false
    }
}
