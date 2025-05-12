const Discovery = await import('torrent-discovery'!)

import { TypedEventEmitter, peerDiscoverySymbol, serviceCapabilities } from '@libp2p/interface'
import type { ComponentLogger, Logger, PeerDiscovery, PeerDiscoveryEvents, PeerDiscoveryProvider, PeerId, PeerInfo, Startable } from '@libp2p/interface'
import { multiaddr, type Multiaddr } from '@multiformats/multiaddr'
import { identity } from 'multiformats/hashes/identity'
import { peerIdFromMultihash } from '@libp2p/peer-id'
import { text2arr } from 'uint8-util'

interface DiscoveryInit {
    infoHash: string,
    port: number,
    announce: string[],
    dht: boolean | any,
    dhtPort: number,
    userAgent: string,
    tracker: boolean | any,
    lsd: boolean | any,
}
interface DiscoveryComponents {
    peerId: PeerId
    logger: ComponentLogger
}

class DiscoveryClass extends TypedEventEmitter<PeerDiscoveryEvents> implements PeerDiscovery, PeerDiscoveryProvider, Startable {
    private discovery: any
    private readonly init: DiscoveryInit & { peerId: string }
    private readonly components: DiscoveryComponents
    private readonly log: Logger
    
    constructor(init: DiscoveryInit, components: DiscoveryComponents){
        super()
        this.components = components
        this.init = Object.assign({
            peerId: this.components.peerId.toString()
        }, init)
        this.log = components.logger.forComponent('libp2p:discovery')
    }
    get [peerDiscoverySymbol]() {
        return this
    }
    start() {
        if(this.discovery) return
        this.discovery = new Discovery(this.init)
        this.discovery.on('peer', (peer: string /*| { id: string, host: string, port: string }*/, source: 'tracker'|'dht'|'lsd') => {
            let [host, port] = peer.split(':')
            let peerInfo: PeerInfo = {
                id: peerIdFromMultihash(identity.digest(text2arr(peer))),
                multiaddrs: [ multiaddr(`/ip4/${host}/tcp/${port}`) ]
            }
            this.safeDispatchEvent('peer', { detail: peerInfo })
        })
        this.discovery.on('warning', (err: Error) => {
            this.log.error('warning', err)
        })
        this.discovery.on('error', (err: Error) => {
            this.log.error('error', err)
        })
    }
    stop() {
        return new Promise<void>((res) => {
            this.discovery.destroy(() => {
                this.discovery = undefined
                res()
            })
        })
    }
}

export function discovery(init: DiscoveryInit): (components: DiscoveryComponents) => DiscoveryClass {
    return (components: DiscoveryComponents) => new DiscoveryClass(init, components)
}
  