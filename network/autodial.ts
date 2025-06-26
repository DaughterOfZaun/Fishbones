//src: @libp2p/circuit-relay-v2/src/transport/discovery.ts
//src: @libp2p/autonat/src/autonat.ts
//src: libp2p/src/connection-manager/connection-pruner.ts

import type { ComponentLogger, Libp2pEvents, Logger, Peer, PeerId, PeerInfo, PeerStore, PeerUpdate, Startable, TypedEventTarget } from "@libp2p/interface"
//import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import type { ConnectionManager } from "@libp2p/interface-internal"
import { PeerQueue } from '@libp2p/utils/peer-queue'
import { setMaxListeners } from 'main-event'
import { anySignal } from 'any-signal'
import { PeerMap } from "@libp2p/peer-collections"
/*
const FloodsubID = '/floodsub/1.0.0'
const GossipsubIDv10 = '/meshsub/1.0.0'
const GossipsubIDv11 = '/meshsub/1.1.0'
const GossipsubIDv12 = '/meshsub/1.2.0'
const multicodecs = [ FloodsubID, GossipsubIDv10, GossipsubIDv11, GossipsubIDv12 ]
*/
interface AutodialInit {
    connectionThreshold?: number
    concurrency?: number
    timeout?: number
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

type PeerValue = {
    value?: number
    valuable?: boolean
    connected?: boolean
    connectedAt?: number
    int?: ReturnType<typeof setTimeout>
}

class Autodial implements Startable {

    readonly [Symbol.toStringTag] = '@libp2p/autodial'

    private readonly log: Logger
    private readonly init: Required<AutodialInit>
    private readonly components: AutodialComponents
    // Perfectly diable but not dialed
    private readonly queueToRediscover = new PeerMap<{ detail: PeerInfo }>
    private readonly queue: PeerQueue

    private started = false
    private running = false
    private abortController?: AbortController

    constructor(init: AutodialInit, components: AutodialComponents) {
        this.log = components.logger.forComponent('libp2p:autodial')
        this.components = components
        this.init = {
            connectionThreshold: init.connectionThreshold ?? 80,
            concurrency: init.concurrency ?? 10,
            timeout: init.timeout ?? 10_000,
        }
        this.queue = new PeerQueue({
            concurrency: this.init.concurrency
        })
        this.dialPeer = this.dialPeer.bind(this)
        this.onPeer = this.onPeer.bind(this)
        this.onPeerConnect = this.onPeerConnect.bind(this)
        this.onPeerUpdate = this.onPeerUpdate.bind(this)
        this.onPeerDisconnect = this.onPeerDisconnect.bind(this)
        //this.startAutodialAsync = this.startAutodialAsync.bind(this)
    }

    start() {
        if (this.started) return
        this.started = true

        this.components.events.addEventListener('peer:connect', this.onPeerConnect)
        this.components.events.addEventListener('peer:update', this.onPeerUpdate)
        this.components.events.addEventListener('peer:disconnect', this.onPeerDisconnect)
        this.startAutodial()
    }

    stop() {
        if (!this.started) return
        this.started = false

        this.components.events.removeEventListener('peer:connect', this.onPeerConnect)
        this.components.events.removeEventListener('peer:update', this.onPeerUpdate)
        this.components.events.removeEventListener('peer:disconnect', this.onPeerDisconnect)
        this.stopAutodial()

        this.peerValues.forEach(peerValue => clearTimeout(peerValue.int))
    }

    peerValues = new PeerMap<PeerValue>()
    peerValues_get(id: PeerId): PeerValue {
        let peerValue = this.peerValues.get(id)
        if(!peerValue){
            peerValue = {}
            this.peerValues.set(id, peerValue)
        }
        return peerValue
    }

    onPeerConnect({ detail: peerId }: CustomEvent<PeerId>){
        const now = Date.now()

        this.queueToRediscover.delete(peerId)

        const peerValue = this.peerValues_get(peerId)
        peerValue.connectedAt = now
        peerValue.connected = true

        peerValue.int = setTimeout(
            this.reevaluatePeer.bind(this, peerId, peerValue, now + this.init.timeout, 'timeout'),
            this.init.timeout
        )

        this.reevaluatePeer(peerId, peerValue, now, 'connect')
    }

    onPeerUpdate({ detail: { peer } }: CustomEvent<PeerUpdate>){
        
        if(this.queueToRediscover.has(peer.id)){
            this.queueToRediscover.set(peer.id, {
                detail: {
                    id: peer.id,
                    multiaddrs: peer.addresses.map(addr => addr.multiaddr)
                }
            })
        }

        //peerValues.set(peer.id, sumPeerTags(peer))
        const peerValue = this.peerValues_get(peer.id)
        //peerValue.value = +multicodecs.some(codec => peer.protocols.includes(codec))
        peerValue.value = sumPeerTags(peer)

        this.reevaluatePeer(peer.id, peerValue, Date.now(), `update`)
    }

    onPeerDisconnect({ detail: peerId }: CustomEvent<PeerId>){

        this.queueToRediscover.delete(peerId)

        const peerValue = this.peerValues_get(peerId)
        peerValue.connected = false

        clearTimeout(peerValue.int)

        this.reevaluatePeer(peerId, peerValue, Date.now(), 'disconnect')
    }

    reevaluatePeer(peerId: PeerId, peerValue: PeerValue, now: number, reason: string){
        const valuable = this.isValuable(peerId, now)
        //this.valuableConnectionsCount += valuable - (peerValue.valuable ?? 0)
        peerValue.valuable = valuable

        const capacity = this.hasCapacity()
        //if(reason == 'timeout' || reason == 'disconnect'){
            const connections = this.components.connectionManager.getConnections()
            const currentConnectionCount = connections.length 
            const valuableConnections = 240 - this.getConnectionCapacity()
            //this.log('reevaluatePeer %p', peerId, 'reason', reason, 'value', peerValue.value, 'valuable', valuable, 'capacity', capacity)
            this.log('reevaluatePeer %p', peerId, 'reason', reason, 'value', peerValue.value, 'valuable connections', valuableConnections, 'of', 240, 'of', currentConnectionCount, capacity)
        //}
        if(this.running && !capacity) this.stopAutodial()
        if(!this.running && capacity) this.startAutodial()
    }

    //valuableConnectionsCount = 0
    isValuable(peerId: PeerId, now: number): boolean {
        const peerValue = this.peerValues.get(peerId)
        if(!peerValue /*|| !peerValue.connected*/) return false
        const timeSinceConnection = peerValue.connectedAt ? (now - peerValue.connectedAt) : Infinity
        return (timeSinceConnection < this.init.timeout) || (peerValue.value ?? 0) > 0
    }

    startAutodial() {
        if(this.running) return
        this.running = true
        this.log('start autodial')

        this.abortController = new AbortController()
        setMaxListeners(Infinity, this.abortController.signal)
        this.components.events.addEventListener('peer:discovery', this.onPeer)

        //Promise.resolve().then(this.startAutodialAsync)
        for(const [id, evt] of [...this.queueToRediscover.entries()]){
            this.queueToRediscover.delete(id)
            this.onPeer(evt)
        }
    }

    /*
    async startAutodialAsync(){
        const capacity = this.getConnectionCapacity()
        if(!capacity){
            this.stopAutodial()
            return
        }
        try {
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
        } catch(err) {
            this.log.error('error rediscovering peers - %e', err)
        }
    }
    */

    stopAutodial() {
        if (!this.running) return
        this.running = false
        this.log('stop autodial')

        this.abortController?.abort()
        this.components.events.removeEventListener('peer:discovery', this.onPeer)
        this.queue.clear()
    }

    onPeer({ detail: peer }: { detail: PeerInfo }): void {
        //this.log('maybe dialing discovered peer %p', peer.id)
        this.maybeDialPeer(peer).catch(err => {
            this.log('error dialing discovered peer %p - %e', peer.id, err)
        })
    }

    async maybeDialPeer(info: PeerInfo): Promise<void> {
        const { id: peerId, multiaddrs } = info

        if (this.queue.has(peerId)) {
            this.log('discovered peer %p was already in queue', peerId)
        } else if (this.components.connectionManager.getConnections(peerId)?.length > 0) {
            this.log('discovered peer %p was already connected', peerId)
        } else if (!(await this.components.connectionManager.isDialable(multiaddrs))) {
            this.log('discovered peer %p was not dialable', peerId, multiaddrs.map(ma => ma.toString()))
        } else if (!this.hasCapacity(info.id)) {
            this.log('discovered peer %p is skipped because we are too close to the connection limit', peerId)
            this.queueToRediscover.set(info.id, { detail: info })
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

    //TODO: Specify connection type.
    private hasCapacity(peerId?: PeerId): boolean {
        const connections = this.components.connectionManager.getConnections()
        const maxConnections = this.components.connectionManager.getMaxConnections()
        const connectionsAllowed = maxConnections * this.init.connectionThreshold * 0.01
        const currentConnectionCount = connections.length

        if(currentConnectionCount < connectionsAllowed){
            //this.log('hasCapacity', 'current', currentConnectionCount, '/', 'allowed', connectionsAllowed)
            return true
        }
        
        const peerAValue = peerId ? this.peerValues.get(peerId) : null
        const peerAValue_value = peerAValue?.value ?? 0

        if(peerAValue && !peerAValue_value){
            // Skipping a useless peer.
            //TODO: Handle failures.
            return false
        }

        return connections.some(connection => {
            const peerBId = connection.remotePeer
            const peerBValue = this.peerValues.get(peerBId)
            const peerBValue_value = peerBValue?.value ?? 0
            const ret = peerBValue?.valuable !== true || peerAValue_value > peerBValue_value
            //if(ret) this.log('hasCapacity', peerId?.toString(), 'B.valuable', peerBValue?.valuable, 'A.value', peerAValue_value, 'B.value', peerBValue_value)
            return ret
        })
    }
    
    private getConnectionCapacity(): number {
        const connections = this.components.connectionManager.getConnections()
        //const currentConnectionCount = connections.length
        //const now = Date.now()
        const currentConnectionCount = connections
            .reduce((acc, connection) => {
                const peerId = connection.remotePeer
                const peerValue = this.peerValues.get(peerId)
                //return acc + +this.isValuable(peerId, now)
                return acc + (peerValue?.valuable ? 1 : 0)
            }, 0)
        const maxConnections = this.components.connectionManager.getMaxConnections()
        const connectionsAllowed = maxConnections * this.init.connectionThreshold * 0.01

        //this.log('getConnectionCapacity', 'current', currentConnectionCount, 'max', maxConnections, 'allowed', connectionsAllowed)

        //return ((currentConnectionCount / maxConnections) * 100) < this.init.connectionThreshold
        return Math.max(0, connectionsAllowed - currentConnectionCount)
    }
    
    /*
    private async getConnectionCapacityAsync(options?: AbortOptions): Promise<number> {
        const connections = this.components.connectionManager.getConnections()
        //const currentConnectionCount = connections.length
        const maxConnections = this.components.connectionManager.getMaxConnections()
        const connectionsAllowed = maxConnections * this.init.connectionThreshold * 0.01

        //if(currentConnectionCount < connectionsAllowed)
        //    return connectionsAllowed - currentConnectionCount

        const peerValues = new PeerMap<number>()
        for (const connection of connections) {
            const remotePeer = connection.remotePeer
            if (peerValues.has(remotePeer)) continue
            peerValues.set(remotePeer, 0)
            try {
                const peer = await this.components.peerStore.get(remotePeer, options)
                peerValues.set(remotePeer, sumPeerTags(peer))
            } catch (err) {
                if ((err as Error).name !== 'NotFoundError') {
                    this.log.error('error loading peer tags', err)
                }
            }
        }
        const currentConnectionCount = [...peerValues.values()].reduce((acc, curr) => {
            return acc + +(curr > 0)
        }, 0)
        
        //return ((currentConnectionCount / maxConnections) * 100) < this.init.connectionThreshold
        return Math.max(0, connectionsAllowed - currentConnectionCount)
    }
    */
}
/*
function getLastDial(peer: Peer): number {
    const lastDial = peer.metadata.get('last-dial-success')
    return (lastDial == null) ? 0 : new Date(uint8ArrayToString(lastDial)).getTime()
}
*/
function sumPeerTags(peer: Peer) {
    return [...peer.tags.values()].reduce((acc, curr) => {
        return acc + curr.value
    }, 0)
}
