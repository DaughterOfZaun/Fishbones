import { TypedEventEmitter, peerDiscoverySymbol, serviceCapabilities } from '@libp2p/interface'
import type { ComponentLogger, Libp2pEvents, Logger, PeerDiscovery, PeerDiscoveryEvents, PeerDiscoveryProvider, PeerId, PeerInfo, PeerStore, Startable, TypedEventTarget } from '@libp2p/interface'
import type { AddressManager, ConnectionManager } from '@libp2p/interface-internal'
import { ipPortToMultiaddr } from '@libp2p/utils/ip-port-to-multiaddr'
//@ts-expect-error: Could not find a declaration file for module 'addr-to-ip-port'
import addrToIPPort from 'addr-to-ip-port'
//@ts-expect-error: Could not find a declaration file for module 'torrent-discovery'
import Discovery from 'torrent-discovery'

const VERSION = '2.6.7'
//import { version as VERSION } from 'webtorrent/package.json'
const USER_AGENT = `WebTorrent/${VERSION} (https://webtorrent.io)`

interface DiscoveryInit {
    infoHash: string,
    port: number,
    announce: string[],
    dht: boolean | object,
    dhtPort: number,
    tracker: boolean | object,
    lsd: boolean | object,
}
interface DiscoveryComponents {
    peerId: PeerId
    logger: ComponentLogger
    connectionManager: ConnectionManager
    events: TypedEventTarget<Libp2pEvents>
    peerStore: PeerStore
    addressManager: AddressManager
}

export function torrentPeerDiscovery(init: DiscoveryInit): (components: DiscoveryComponents) => DiscoveryClass {
    return (components: DiscoveryComponents) => new DiscoveryClass(init, components)
}

class DiscoveryClass extends TypedEventEmitter<PeerDiscoveryEvents> implements PeerDiscovery, PeerDiscoveryProvider, Startable {
    
    private discovery: any // eslint-disable-line @typescript-eslint/no-explicit-any
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
        this.log = components.logger.forComponent('libp2p:torrent-discovery')
    }

    readonly [peerDiscoverySymbol] = this
    readonly [Symbol.toStringTag] = '@libp2p/torrent-discovery'
    readonly [serviceCapabilities]: string[] = [
      '@libp2p/peer-discovery'
    ]

    start() {
        if(this.discovery) return
        this.discovery = new Discovery(this.init)
        this.discovery.addListener('peer', this.onPeer)
        this.discovery.addListener('warning', this.onWarning)
        this.discovery.addListener('error', this.onError)
        this.components.events.addEventListener('peer:connect', this.onConnect)
        this.components.events.addEventListener('peer:disconnect', this.onDisconnect)
    }

    private onPeer = async (ipport: string /*| { id: string, ip: string, port: string }*/, source: 'tracker'|'dht'|'lsd') => {
        this.log('discovered peer %s from %s', ipport, source)
        this.queue.push(ipport)
        this.drain()
    }
    private onWarning = (err: Error) => {
        this.log.error('warning', err)
    }
    private onError = (err: Error) => {
        this.log.error('error', err)
    }
    private onConnect = (/*event: CustomEvent<PeerId>*/) => {
        this.drain()
    }
    private onDisconnect = (/*event: CustomEvent<PeerId>*/) => {
        this.drain()
    }

    stop() {
        const discovery = this.discovery
        if(!this.discovery) return
        this.discovery = undefined

        this.components.events.removeEventListener('peer:connect', this.onConnect)
        this.components.events.removeEventListener('peer:disconnect', this.onDisconnect)

        return new Promise<void>(res => discovery.destroy(() => res()))
    }

    private drain(){
        const cm = this.components.connectionManager
        const ps = this.components.peerStore
        const am = this.components.addressManager

        while(
            this.queue.length
            && cm.getConnections().length < cm.getMaxConnections()
            && cm.getDialQueue().length < 500 //TODO: Unhardcode
        ){
            const ipport = this.queue.shift()
            const [ip, port]: [string, number] = addrToIPPort(ipport)
            const peerAddr = ipPortToMultiaddr(ip, port)

            //console.log(peerAddr.toString(), 'vs', am.getAddresses().map(addr => addr.toString()).join(', '))
            if(am.getAddresses().some(addr => addr.equals(peerAddr))) return
            ps.all({ filters: [peer => peer.addresses.some(addr => addr.multiaddr.equals(peerAddr))], limit: 1 })

            cm.openConnection(peerAddr)
            .then(connection => ps.merge(connection.remotePeer, { multiaddrs: [ connection.remoteAddr ] }))
            .then(peer => {
                const detail: PeerInfo = {
                    id: peer.id,
                    multiaddrs: peer.addresses.map(({ multiaddr }) => multiaddr)
                }
                this.safeDispatchEvent('peer', { detail })
            })
            .catch(err => this.log.error('could not dial discovered peer %a', peerAddr, err))
        }
    }
}
  