import { ping, type Ping, type PingComponents, type PingInit } from '@libp2p/ping'
import { type Multiaddr } from '@multiformats/multiaddr'
import { isPeerId, serviceCapabilities, TypedEventEmitter, type AbortOptions, type Connection, type Libp2pEvents, type PeerId, type Startable, type TypedEventTarget } from '@libp2p/interface'
import { PeerMap } from '@libp2p/peer-collections'

//const HISTORY_DURATION = 10 * 60 * 1000
const HISTORY_LENGTH = 50

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

interface CacheEntry {
    time: number
    ms: number
}

interface CustomPingComponents extends PingComponents {
    events: TypedEventTarget<Libp2pEvents>
}

class CustomPing extends TypedEventEmitter<PingEvents> implements PingService {

    private readonly pingService: PingService
    private readonly components: CustomPingComponents
    constructor(components: CustomPingComponents, init: PingInit){
        super()
        this.pingService = ping(init)(components) as PingService
        this.components = components
    }
    public get protocol(){ return this.pingService.protocol }
    public get [Symbol.toStringTag](){ return this.pingService[Symbol.toStringTag] }
    public get [serviceCapabilities](){ return this.pingService[serviceCapabilities] } 
    public isStarted(){ return this.pingService.isStarted() }
    public async start(){
        this.components.events.addEventListener('connection:open', this.onConnectionOpen)
        return this.pingService.start()
    }
    public async stop(){
        this.components.events.removeEventListener('connection:open', this.onConnectionOpen)
        return this.pingService.stop()
    }

    private onConnectionOpen = (event: CustomEvent<Connection>) => {
        const connection = event.detail
        const peerId = connection.remotePeer
        this.defineRTT(peerId, connection)
        if('muxer' in connection){
            const muxer = connection.muxer
            if(muxer && typeof muxer === 'object' /*&& muxer.constructor.name == 'YamuxMuxer'*/){
                this.defineRTT(peerId, muxer)
            }
        }
    }

    private defineRTT(peerId: PeerId, obj: { rtt?: number }){
        let rtt: number | undefined
        this.dispatchEventAndCacheValue(peerId, obj.rtt, false)
        Object.defineProperty(obj, "rtt", {
            get: () => { return rtt },
            set: (ms: number | undefined) => {
                this.dispatchEventAndCacheValue(peerId, ms)
                rtt = ms
            },
        });
    }

    private dispatchEventAndCacheValue(peerId: PeerId, ms: number | undefined, dispatch = true){
        if(ms === undefined || ms <= 0) return
        if(dispatch) this.safeDispatchEvent('ping', { detail: { peerId, ms } })
        
        const entries = this.history_get(peerId)
        if(entries.length > HISTORY_LENGTH){
            entries.splice(0, entries.length - HISTORY_LENGTH)
        }
        const time = Date.now()
        entries.push({ ms, time })
    }

    private readonly history = new PeerMap<CacheEntry[]>()
    private history_get(peerId: PeerId): CacheEntry[] {
        let entries = this.history.get(peerId)
        if(!entries){
            entries = []
            this.history.set(peerId, entries)
        }
        return entries
    }
    
    public async ping(peer: PeerId | Multiaddr | Multiaddr[], options: AbortOptions = {}): Promise<number> {
        const ms = await this.pingService.ping(peer, options)
        if(isPeerId(peer)){
            this.dispatchEventAndCacheValue(peer, ms)
        }
        return ms
    }
    
    public getPing(peerId: PeerId){
        const entries = this.history_get(peerId)
        const entry = entries.at(-1)
        return entry?.ms
    }

    public getMaxPing(peerId: PeerId): number {
        const entries = this.history_get(peerId)
        return entries.reduce((v, entry) => {
            return Math.max(v, entry.ms)
        }, 0)
    }
}

export function customPing (init: PingInit = {}): (components: CustomPingComponents) => CustomPing {
    return (components) => new CustomPing(components, init)
}
