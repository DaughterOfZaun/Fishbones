import type { Libp2p } from "libp2p"
import { LOCALHOST } from "./constants"
import type { PeerId, AbortOptions } from "@libp2p/interface"
import { logger } from "@libp2p/logger"
import { isENet, type BunSocket } from "../network/umplex"
import * as uMplex from '../network/umplex'
import { UTPMatcher } from "../network/tcp"
import { registerShutdownHandler } from "./data-process"

const log = logger('launcher:proxy')

type u = undefined
type PeerIdStr = string
type HostPortStr = string
//type HostPortObj = { host: string, port: number }
//type HostPort = string & HostPortObj
type PeerData = {
    id: PeerId,
    host: string, port: number,
    hostports: HostPortStr[],
    external: BunSocket|u,
    internal: BunSocket,
}

const openSockets = new Set<BunSocket>()
registerShutdownHandler(() => {
    for(const socket of openSockets)
        socket.close()
    //openSockets.clear()
})

class Proxy {
    
    protected readonly peersByPeerId = new Map<PeerIdStr, PeerData>()
    protected readonly peersByHostport = new Map<HostPortStr, PeerData>()
    public host: u|string
    public port: u|number
    protected external: u|BunSocket

    protected readonly node: Libp2p
    public constructor(node: Libp2p){
        this.node = node
    }

    public getPeer(id: PeerId){
        return this.peersByPeerId.get(id.toString())
    }

    public getPort(id: PeerId){
        return this.getPeer(id)?.internal.port
    }
    
    protected getHostPorts(id: PeerId): HostPortStr[] {

        let hostports = this.node.getConnections(id)
            .filter(connection => UTPMatcher.exactMatch(connection.remoteAddr))
            .map(connection => {
                const { host, port } = connection.remoteAddr.toOptions()
                return `${host}:${port}`
            })
        hostports = new Set(hostports).values().toArray()
        hostports = hostports.sort()

        log('hostports for peer %p are', id, hostports)
        
        return hostports
    }

    protected async createMainSocket(opts: Required<AbortOptions>){

        log('creating external socket')

        this.external = await uMplex.udpSocket({
            binaryType: 'buffer',
            socket: {
                filter: isENet,
                data: (_, data, port, address) => {
                    const hostport = `${address}:${port}`
                    const peer = this.peersByHostport.get(hostport)
                    if(!peer){
                        log.error('external socket: ignoring pkt from unknown addr %s:%d', address, port)
                    } else {
                        if(!this.host || !this.port){
                            log.error('external socket: dropping pkt from %s:%d because internal addr is unknown', address, port)
                        } else if(peer.internal.closed){
                            log.error('external socket: dropping pkt from %s:%d because internal socket is closed', address, port)
                        } else {
                            log.trace('external socket: redirecting pkt from %s:%d through %s:%d to %s:%d', address, port, peer.internal.hostname, peer.internal.port, this.host, this.port)
                            peer.internal.send(data, this.port, this.host)
                        }
                        peer.host = address
                        peer.port = port
                    }
                },
            }
        })
        openSockets.add(this.external)

        log('created external socket at %s:%d', this.external.hostname, this.external.port)

        opts.signal.throwIfAborted()
    }

    protected async createPeer(id: PeerId, opts: Required<AbortOptions>){
        
        log('creating internal socket for peer %p', id)

        let host = '', port = 0,
            hostports: HostPortStr[] = []
        if(!this.node.peerId.equals(id)){
            hostports = this.getHostPorts(id)
            if(!hostports.length){
                log('peer %p is not connected.', id)
            } else {
                //host = hostports[0]!.host
                //port = hostports[0]!.port
                const hostport = hostports[0]!
                const index = hostport.lastIndexOf(':')
                port = parseInt(hostport.slice(index + 1))
                host = hostport.slice(0, index)
            }
        }
        
        const peer: PeerData = {
            id,
            host, port,
            hostports,
            external: this.external,
            internal: await Bun.udpSocket({
                hostname: LOCALHOST,
                socket: {
                    data: (_, data, port, address) => {
                        peer.external ??= this.external!

                        if(!this.host || !this.port){
                            log('internal socket: setting internal addr to %s:%d', address, port)
                        } else if(this.host !== address || this.port !== port){
                            log.error('internal socket: got pkt from unexpected addr %s:%d', address, port)
                        }
                        if(peer.external.closed){
                            log.error('internal socket: dropping pkt from %s:%d because external socket is closed', address, port)
                        } else {
                            log.trace('internal socket: redirecting pkt from %s:%d through %s:%d to %s:%d', address, port, peer.external.hostname, peer.external.port, peer.host, peer.port)
                            peer.external.send(data, peer.port, peer.host)
                        }
                        this.host = address
                        this.port = port
                    },
                }
            })
        }
        openSockets.add(peer.internal)

        log('created internal socket for peer %p at %s:%d', peer.id, peer.internal.hostname, peer.internal.port)

        this.peersByPeerId.set(peer.id.toString(), peer)
        for(const hostport of peer.hostports)
            this.peersByHostport.set(hostport, peer)

        opts.signal.throwIfAborted()
        
        return peer
    }

    protected closeSockets(){
        for(const peer of this.peersByPeerId.values()){
            log('closing socket for peer %p at %s:%d', peer.id, peer.internal.hostname, peer.internal.port)
            openSockets.delete(peer.internal)
            peer.internal.close()
        }
        if(this.external){
            log('closing socket at %s:%d', this.external.hostname, this.external.port)
            openSockets.delete(this.external)
            this.external.close()
        }
        this.peersByPeerId.clear()
        this.peersByHostport.clear()
        this.external = undefined
        this.host = undefined
        this.port = undefined
    }
}

export class ProxyServer extends Proxy {

    public async start(port: number, peerIds: PeerId[], opts: Required<AbortOptions>) {
        this.host = LOCALHOST
        this.port = port
        
        log('starting proxy server at %s:%d', this.host, this.port)

        await Promise.all([
            this.createMainSocket(opts),
            peerIds.map(id => this.createPeer(id, opts)),
        ])
    }
    
    public stop(){
        log('stopping proxy server')
        this.closeSockets()
    }
}

export class ProxyClient extends Proxy {
    
    private serverId: u|PeerId
    public async connect(id: PeerId, proxyServer: u|ProxyServer, opts: Required<AbortOptions>) {
        this.serverId = id
        if(id.equals(this.node.peerId) && proxyServer){

            log('connecting to local server peer %p', id)

            const proxyClient = this as ProxyClient
            const serverSidePeer = proxyServer.getPeer(id)!
            const clientSidePeer = await proxyClient.createPeer(id, opts)
            clientSidePeer.external = serverSidePeer.internal
            serverSidePeer.external = clientSidePeer.internal
            Object.defineProperties(serverSidePeer, {
                host: { get: () => proxyClient.host },
                port: { get: () => proxyClient.port },
            })
            Object.defineProperties(clientSidePeer, {
                host: { get: () => proxyServer.host },
                port: { get: () => proxyServer.port },
            })
        } else {

            log('connecting to remote server peer %p', id)

            await Promise.all([
                this.createMainSocket(opts),
                this.createPeer(id, opts),
            ])
        }
    }
    
    public disconnect(){
        
        log('disconnecting from server peer %p', this.serverId)

        this.serverId = undefined
        this.closeSockets()
    }

    public getPort(id = this.serverId){
        console.assert(id && id.equals(this.serverId), 'id && id.equals(this.serverId)')
        return super.getPort(id!)
    }
}
