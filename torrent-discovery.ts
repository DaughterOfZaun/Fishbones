import { TypedEventEmitter, peerDiscoverySymbol, serviceCapabilities } from '@libp2p/interface'
import type { ComponentLogger, Libp2pEvents, Logger, PeerDiscovery, PeerDiscoveryEvents, PeerDiscoveryProvider, PeerId, PeerInfo, PeerStore, Startable, TypedEventTarget } from '@libp2p/interface'
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

const VERSION = '2.6.7'
//import { version as VERSION } from 'webtorrent/package.json'
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
    //peerStore: PeerStore
}

export function torrentPeerDiscovery(init: DiscoveryInit): (components: DiscoveryComponents) => DiscoveryClass {
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
        this.log = components.logger.forComponent('libp2p:torrent-discovery')
    }

    readonly [peerDiscoverySymbol] = this
    readonly [Symbol.toStringTag] = 'jinx/discovery'
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
    private onConnect = (event: CustomEvent<PeerId>) => {
        this.drain()
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
        //let ps = this.components.peerStore

        while(
            this.queue.length
            && cm.getConnections().length < cm.getMaxConnections()
            && cm.getDialQueue().length < 500 //TODO: Unhardcode
        ){
            const ipport = this.queue.shift()
            let [ip, port]: [string, number] = addrToIPPort(ipport)
            let peerAddr = ipPortToMultiaddr(ip, port)

            //ps.all({ filters: [peer => peer.addresses.some(addr => addr.multiaddr.equals(peerAddr))], limit: 1 })

            //let peerId = peerIdFromMultihash(identity.digest(text2arr(peer)))
            cm.openConnection(peerAddr)
            .then(connection => this.safeDispatchEvent('peer', { detail: connection.remotePeer }))
            .catch(err => this.log.error('could not dial discovered peer %a', peerAddr, err))
        }
    }
}
  