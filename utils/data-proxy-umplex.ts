import type { Libp2p } from "libp2p"
import { LOCALHOST } from "./constants"
import type { PeerId } from "@libp2p/interface"
import { logger } from "@libp2p/logger"
import { isENet, type BunSocket } from "../network/umplex"
import * as uMplex from '../network/umplex'
import { UTPMatcher } from "../network/tcp"

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
        return hostports.sort()
    }

    protected async createMainSocket(){
        this.external = await uMplex.udpSocket({
            binaryType: 'buffer',
            socket: {
                filter: isENet,
                data: (_, data, port, address) => {
                    const hostport = `${address}:${port}`
                    const peer = this.peersByHostport.get(hostport)
                    if(!peer){
                        log('got pkt from unknown addr %s', hostport)
                    } else if(!this.host || !this.port){
                        log('dropping pkt because internal addr is unknown')
                    } else {
                        peer.internal.send(data, this.port, this.host)
                        peer.host = address
                        peer.port = port
                    }
                },
            }
        })
    }

    protected async createPeer(id: PeerId){
        
        let host = LOCALHOST, port = 0,
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
                socket: {
                    data: (_, data, port, address) => {
                        //if(!this.host || !this.port){
                        //    log('setting internal addr to %s:%d', address, port)
                        //} else if(this.host !== address || this.port !== port){
                        //    log('got pkt from unexpected addr %s:%d', address, port)
                        //} else {
                            peer.external ??= this.external!
                            console.log(data, peer.port, peer.host)
                            peer.external.send(data, peer.port, peer.host)
                            this.host = address
                            this.port = port
                        //}
                    },
                }
            })
        }

        this.peersByPeerId.set(peer.id.toString(), peer)
        for(const hostport of peer.hostports)
            this.peersByHostport.set(hostport, peer)
        //console.log('hostports for', peer.id, peer.host, peer.port, peer.hostports.values().toArray())

        return peer
    }

    protected closeSockets(){
        for(const peer of this.peersByPeerId.values())
            peer.internal.close()
        this.external?.close()
    }
}

export class ProxyServer extends Proxy {

    public async start(port: number, peerIds: PeerId[]) {
        this.host = LOCALHOST
        this.port = port
        await Promise.all([
            this.createMainSocket(),
            peerIds.map(id => this.createPeer(id)),
        ])
    }
    
    public stop(){
        this.closeSockets()
    }
}

export class ProxyClient extends Proxy {
    
    private serverId: u|PeerId
    public async connect(id: PeerId, proxyServer: u|ProxyServer) {
        this.serverId = id
        if(id.equals(this.node.peerId) && proxyServer){
            const proxyClient = this as ProxyClient
            const serverSidePeer = proxyServer.getPeer(id)!
            const clientSidePeer = await proxyClient.createPeer(id)
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
            await Promise.all([
                this.createMainSocket(),
                this.createPeer(id),
            ])
        }
    }
    
    public disconnect(){
        this.serverId = undefined
        this.closeSockets()
    }

    public getPort(id = this.serverId){
        console.assert(id && id.equals(this.serverId), 'id && id.equals(this.serverId)')
        return super.getPort(id!)
    }
}
