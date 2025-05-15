import { TypedEventEmitter, peerDiscoverySymbol, serviceCapabilities } from '@libp2p/interface'
import type { ComponentLogger, Libp2pEvents, Logger, PeerDiscovery, PeerDiscoveryEvents, PeerDiscoveryProvider, PeerId, PeerInfo, Startable, TypedEventTarget } from '@libp2p/interface'
import { multiaddr, type Multiaddr } from '@multiformats/multiaddr'
import { identity } from 'multiformats/hashes/identity'
import { peerIdFromMultihash } from '@libp2p/peer-id'
import { text2arr } from 'uint8-util'
import type { ConnectionManager } from '@libp2p/interface-internal'
import { ipPortToMultiaddr } from '@libp2p/utils/ip-port-to-multiaddr'
//@ts-ignore
import addrToIPPort from 'addr-to-ip-port'
//@ts-ignore
import Discovery from 'torrent-discovery'

import { version as VERSION } from 'webtorrent/package.json'
const USER_AGENT = `WebTorrent/${VERSION} (https://webtorrent.io)`

interface DiscoveryInit {
    infoHash: string,
    port: number,
    announce: string[],
    dht: boolean | any,
    dhtPort: number,
    tracker: boolean | any,
    lsd: boolean | any,
}
interface DiscoveryComponents {
    peerId: PeerId
    logger: ComponentLogger
    connectionManager: ConnectionManager
    events: TypedEventTarget<Libp2pEvents>
}

export function discovery(init: DiscoveryInit): (components: DiscoveryComponents) => DiscoveryClass {
    return (components: DiscoveryComponents) => new DiscoveryClass(init, components)
}

class DiscoveryClass extends TypedEventEmitter<PeerDiscoveryEvents> implements PeerDiscovery, PeerDiscoveryProvider, Startable {
    
    private discovery: any
    private readonly init: DiscoveryInit & { peerId: string, userAgent: string }
    private readonly components: DiscoveryComponents
    private readonly log: Logger
    private readonly queue: string[] = []
    
    constructor(init: DiscoveryInit, components: DiscoveryComponents){
        super()
        
        this.components = components
        this.init = Object.assign({
            peerId: this.components.peerId.toString(),
            userAgent: USER_AGENT
        }, init)
        this.log = components.logger.forComponent('libp2p:discovery')
    }

    readonly [peerDiscoverySymbol] = this
    readonly [Symbol.toStringTag] = 'jinx/discovery'
    readonly [serviceCapabilities]: string[] = [
      '@libp2p/peer-discovery'
    ]

    start() {
        if(this.discovery) return
        this.discovery = new Discovery(this.init)
        this.discovery.addEventListener('peer', this.onPeer)
        this.discovery.addEventListener('warning', this.onWarning)
        this.discovery.addEventListener('error', this.onError)
        this.components.events.addEventListener('peer:disconnect', this.onDisconnect)
    }

    private onPeer = async (ipport: string /*| { id: string, ip: string, port: string }*/, source: 'tracker'|'dht'|'lsd') => {
        this.queue.push(ipport)
        this.drain()
    }
    private onWarning = (err: Error) => {
        this.log.error('warning', err)
    }
    private onError = (err: Error) => {
        this.log.error('error', err)
    }
    private onDisconnect = (event: CustomEvent<PeerId>) => {
        this.drain()
    }

    stop() {
        this.components.events.removeEventListener('peer:disconnect', this.onDisconnect)
        return new Promise<void>((res) => {
            this.discovery.destroy(() => {
                this.discovery = undefined
                res()
            })
        })
    }

    private drain(){
        let cm = this.components.connectionManager
        while(this.queue.length && cm.getConnections().length >= cm.getMaxConnections()){
            const ipport = this.queue.shift()
            let [ip, port]: [string, number] = addrToIPPort(ipport)
            let peerAddr = ipPortToMultiaddr(ip, port)
            //let peerId = peerIdFromMultihash(identity.digest(text2arr(peer)))
            cm.openConnection(peerAddr)
            //.then(connection => this.safeDispatchEvent('peer', { detail: connection.remotePeer }))
            .catch(err => this.log.error('could not dial discovered peer', err)) //TODO: Log addr
        }
    }
}
  