import { ping, type Ping, type PingComponents, type PingInit } from '@libp2p/ping'
import { type Multiaddr } from '@multiformats/multiaddr'
import { serviceCapabilities, TypedEventEmitter, type AbortOptions, type Connection, type Libp2pEvents, type PeerId, type Startable, type TypedEventTarget } from '@libp2p/interface'
import type { ConnectionManager } from '@libp2p/interface-internal'
import { PeerMap } from '@libp2p/peer-collections'

const HISTORY_MAX_DURATION = 5 * 1000
const HISTORY_MAX_LENGTH = 50
const MAX_PING_PERCENT = 0.9

export type PingResult = {
    peerId: PeerId
    ms: number
}

type PingEvents = {
    ping: CustomEvent<PingResult>
}

type PingService = Ping & Startable & {
    protocol: string
    [Symbol.toStringTag]: string
    [serviceCapabilities]: string[]
    isStarted(): boolean
}

interface PeerPingInfo {
    connections: Map<string, ConnPingInfo>
    minmax?: number
    id: PeerId
}
interface ConnPingInfo {
    history: PingHistoryEntry[]
    max?: number
    id: string
}
interface PingHistoryEntry {
    time: number
    ms: number
}

interface CustomPingComponents extends PingComponents {
    events: TypedEventTarget<Libp2pEvents>
    connectionManager: ConnectionManager
}

class CustomPing extends TypedEventEmitter<PingEvents> implements PingService {

    private readonly peers = new PeerMap<PeerPingInfo>()
    private promisedConnection: Promise<Connection> | undefined

    private readonly pingService: PingService
    private readonly components: CustomPingComponents
    constructor(components: CustomPingComponents, init: PingInit){
        super()
        this.pingService = ping(init)(components) as PingService
        this.components = components

        //HACK:
        const cm = this.components.connectionManager
        const cm_openConnection = cm.openConnection.bind(cm)
        cm.openConnection = (peer, options) => {
            const promise = cm_openConnection(peer, options)
            this.promisedConnection = promise
            return promise
        }
    }

    public get protocol(){ return this.pingService.protocol }
    public get [Symbol.toStringTag](){ return this.pingService[Symbol.toStringTag] }
    public get [serviceCapabilities](){ return this.pingService[serviceCapabilities] }

    public isStarted(){ return this.pingService.isStarted() }
    public async start(){
        this.components.events.addEventListener('connection:open', this.onConnectionOpen)
        this.components.events.addEventListener('connection:close', this.onConnectionClose)
        return this.pingService.start()
    }
    public async stop(){
        this.components.events.removeEventListener('connection:open', this.onConnectionOpen)
        this.components.events.removeEventListener('connection:close', this.onConnectionClose)
        return this.pingService.stop()
    }

    public async ping(peer: PeerId | Multiaddr | Multiaddr[], options?: AbortOptions): Promise<number> {
        const promisedPing = this.pingService.ping(peer, options)
        const connection = await this.promisedConnection
        const ms = await promisedPing
        if(connection){
            const peerId = connection.remotePeer
            this.onRTT(peerId, connection, ms)
        }
        return ms
    }

    private onConnectionOpen = (event: CustomEvent<Connection>) => {
        const connection = event.detail
        const peerId = connection.remotePeer
        this.defineRTT(peerId, connection)
        if('muxer' in connection){
            const muxer = connection.muxer
            if(muxer && typeof muxer === 'object' /*&& muxer.constructor.name == 'YamuxMuxer'*/){
                this.defineRTT(peerId, connection, muxer)
            }
        }
    }

    private onConnectionClose = (event: CustomEvent<Connection>) => {
        const connection = event.detail
        const peerId = connection.remotePeer
        const peer = this.peers.get(peerId)
        if(peer){
            peer.connections.delete(connection.id)
            if(peer.connections.size == 0){
                this.peers.delete(peerId)
            } else {
                this.updatePeer(peer)
            }
        }
    }

    private defineRTT(peerId: PeerId, connection: Connection, obj: { rtt?: number } = connection){
        let rtt = obj.rtt
        this.onRTT(peerId, connection, rtt)
        Object.defineProperty(obj, "rtt", {
            get: () => { return rtt },
            set: (ms: number | undefined) => {
                this.onRTT(peerId, connection, ms)
                rtt = ms
            },
        });
    }

    private onRTT(peerId: PeerId, connection: Connection, ms: number | undefined){
        if(ms === undefined || ms <= 0) return
        
        let peer = this.peers.get(peerId)
        if(!peer){
            peer = {
                connections: new Map(),
                id: peerId,
            }
            this.peers.set(peerId, peer)
        }

        let conn = peer.connections.get(connection.id)
        if(!conn){
            conn = {
                history: [],
                id: connection.id,
            }
            peer.connections.set(connection.id, conn)
        }

        const now = Date.now()
        const history = conn.history = conn.history.filter((entry, i) => {
            return (now - entry.time) <= HISTORY_MAX_DURATION
                && i < HISTORY_MAX_LENGTH
        })
        history.push({ ms, time: now })

        this.updateConn(conn)
        this.updatePeer(peer)
    }

    private updateConn(conn: ConnPingInfo){
        if(conn.history.length == 0) return
        const pingsObserved = conn.history.map(entry => entry.ms).sort()
        conn.max = pingsObserved.at(Math.floor(pingsObserved.length * MAX_PING_PERCENT) - 1)!
        //conn.avg = (pingsObserved.at(0)! + pingsObserved.at(-1)!) * 0.5
    }

    private updatePeer(peer: PeerPingInfo){
        const entries = [...peer.connections.values()]
            .filter(conn => conn.max !== undefined)
            .map(conn => conn.max!)
        let minmax = peer.minmax
        if(entries.length > 0)
            minmax = entries.reduce((a, v) => Math.min(a, v), entries.at(0)!)
        if(peer.minmax != minmax){
            peer.minmax = minmax
            this.safeDispatchEvent('ping', { detail: { peerId: peer.id, ms: minmax } })
        }
    }
    
    public getPing(peerId: PeerId, connId?: string){
        const peer = this.peers.get(peerId)
        return connId ?
            peer?.connections.get(connId)?.max :
            peer?.minmax
    }

    public getMaxPing(peerId: PeerId): number {
        return this.peers.get(peerId)?.minmax ?? 0
    }
}

export function customPing (init: PingInit = {}): (components: CustomPingComponents) => CustomPing {
    return (components) => new CustomPing(components, init)
}
