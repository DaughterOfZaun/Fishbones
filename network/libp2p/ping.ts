import { ping, type Ping, type PingComponents, type PingInit } from '@libp2p/ping'
import { type Multiaddr } from '@multiformats/multiaddr'
import { isPeerId, serviceCapabilities, TypedEventEmitter, type AbortOptions, type Libp2pEvents, type PeerId, type Startable, type TypedEventTarget } from '@libp2p/interface'
import { PeerMap } from '@libp2p/peer-collections'

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
    ms?: number
}

interface CustomPingComponents extends PingComponents {
    events: TypedEventTarget<Libp2pEvents>
}

class CustomPing extends TypedEventEmitter<PingEvents> implements PingService {

    private readonly pingService: PingService
    //private readonly components: CustomPingComponents
    constructor(components: CustomPingComponents, init: PingInit){
        super()
        this.pingService = ping(init)(components) as PingService
        //this.components = components
    }
    public get protocol(){ return this.pingService.protocol }
    public get [Symbol.toStringTag](){ return this.pingService[Symbol.toStringTag] }
    public get [serviceCapabilities](){ return this.pingService[serviceCapabilities] } 
    public isStarted(){ return this.pingService.isStarted() }
    public async start(){
        //this.components.events.addEventListener('peer:disconnect', this.onPeerDisconnect)
        return this.pingService.start()
    }
    public async stop(){
        //this.components.events.removeEventListener('peer:disconnect', this.onPeerDisconnect)
        return this.pingService.stop()
    }

    //onPeerDisconnect = (event: CustomEvent<PeerId>) => {
    //    const peerId = event.detail
    //    const entry = this.cache.get(peerId)
    //}

    private readonly cache = new PeerMap<CacheEntry>()
    private cache_get(peerId: PeerId){
        let entry = this.cache.get(peerId)
        if(!entry){
            entry = {}
            this.cache.set(peerId, entry)
        }
        return entry
    }
    
    public async ping(peer: PeerId | Multiaddr | Multiaddr[], options: AbortOptions = {}): Promise<number> {
        const ms = await this.pingService.ping(peer, options)
        if(isPeerId(peer)){
            const peerId = peer
            this.safeDispatchEvent('ping', { detail: { peerId, ms } })
            const entry = this.cache_get(peerId)
            entry.ms = ms
        }
        return ms
    }
    
    public getPing(peerId: PeerId){
        const entry = this.cache_get(peerId)
        return entry.ms
    }
}

export function customPing (init: PingInit = {}): (components: CustomPingComponents) => CustomPing {
    return (components) => new CustomPing(components, init)
}
