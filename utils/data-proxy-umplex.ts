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
interface PeerData {
    peerId: PeerId,
    remoteHostLastUsed: string,
    remotePortLastUsed: number,
    socketToRemote: u|AnySocket,
    socketToProgram: BunSocket,
}

type AnySocket = {
    hostname: string // Bound external host. Only used for logging.
    port: number // Bound external port. Only used for logging.
    send(data: Buffer, remotePort: number, remoteHost: string): boolean
    closed: boolean
    close(): void
}

type Closable = { close(): void }
const openSockets = new Set<Closable>()
registerShutdownHandler(() => {
    for(const socket of openSockets)
        socket.close()
    openSockets.clear()
})

class Proxy {
    
    protected readonly peersByPeerId = new Map<PeerIdStr, PeerData>()
    protected readonly peersByRemoteHostPort = new Map<HostPortStr, PeerData>()
    public programHost: u|string
    public programPort: u|number
    protected defaultSocketToRemote: u|AnySocket

    protected readonly node: Libp2p
    public constructor(node: Libp2p){
        this.node = node
    }

    public getPeer(id: PeerId){
        return this.peersByPeerId.get(id.toString())
    }

    public getPort(id: PeerId){
        return this.getPeer(id)?.socketToProgram.port
    }
    
    protected getRemoteHostPorts(id: PeerId): HostPortStr[] {

        let remoteHostPorts = this.node.getConnections(id)
            .filter(connection => UTPMatcher.exactMatch(connection.remoteAddr))
            .map(connection => {
                const { host, port } = connection.remoteAddr.toOptions()
                return `${host}:${port}`
            })
        remoteHostPorts = new Set(remoteHostPorts).values().toArray()
        remoteHostPorts = remoteHostPorts.sort()

        log('hostports for peer %p are', id, remoteHostPorts)
        
        return remoteHostPorts
    }

    protected async createDefaultSocketToRemote(opts: Required<AbortOptions>){

        log('creating external socket')

        this.defaultSocketToRemote = await uMplex.udpSocket({
            binaryType: 'buffer',
            socket: {
                filter: isENet,
                data: (_, data, remotePort, remoteHost) => {
                    const remoteHostPort = `${remoteHost}:${remotePort}`
                    const peer = this.peersByRemoteHostPort.get(remoteHostPort)
                    if(!peer){
                        log.error('external socket: ignoring pkt from unknown addr %s:%d', remoteHost, remotePort)
                    } else {
                        if(!this.programHost || !this.programPort){
                            log.error('external socket: dropping pkt from %s:%d because internal addr is unknown', remoteHost, remotePort)
                        } else if(peer.socketToProgram.closed){
                            log.error('external socket: dropping pkt from %s:%d because internal socket is closed', remoteHost, remotePort)
                        } else {
                            log.trace('external socket: redirecting pkt from %s:%d through %s:%d to %s:%d', remoteHost, remotePort, peer.socketToProgram.hostname, peer.socketToProgram.port, this.programHost, this.programPort)
                            peer.socketToProgram.send(data, this.programPort, this.programHost)
                        }
                        peer.remoteHostLastUsed = remoteHost
                        peer.remotePortLastUsed = remotePort
                    }
                },
            }
        })
        openSockets.add(this.defaultSocketToRemote)

        log('created external socket at %s:%d', this.defaultSocketToRemote.hostname, this.defaultSocketToRemote.port)

        opts.signal.throwIfAborted()
    }

    protected async createPeer(id: PeerId, opts: Required<AbortOptions>){
        
        log('creating internal socket for peer %p', id)

        let remoteHost = '', remotePort = 0,
            remoteHostPorts: HostPortStr[] = []
        if(!this.node.peerId.equals(id)){
            remoteHostPorts = this.getRemoteHostPorts(id)
            if(!remoteHostPorts.length){
                log('peer %p is not connected.', id)
            } else {
                //remoteHost = remoteHostPorts[0]!.host
                //remotePort = remoteHostPorts[0]!.port
                const remoteHostPort = remoteHostPorts[0]!
                const index = remoteHostPort.lastIndexOf(':')
                remotePort = parseInt(remoteHostPort.slice(index + 1))
                remoteHost = remoteHostPort.slice(0, index)
            }
        }
        
        const peer: PeerData = {
            peerId: id,
            remoteHostLastUsed: remoteHost,
            remotePortLastUsed: remotePort,
            socketToRemote: this.defaultSocketToRemote,
            socketToProgram: await Bun.udpSocket({
                hostname: LOCALHOST,
                socket: {
                    data: (_, data, programPort, programHost) => {
                        peer.socketToRemote ??= this.defaultSocketToRemote!

                        if(!this.programHost || !this.programPort){
                            log('internal socket: setting internal addr to %s:%d', programHost, programPort)
                        } else if(this.programHost !== programHost || this.programPort !== programPort){
                            log.error('internal socket: got pkt from unexpected addr %s:%d', programHost, programPort)
                        }
                        if(peer.socketToRemote.closed){
                            log.error('internal socket: dropping pkt from %s:%d because external socket is closed', programHost, programPort)
                        } else /*if(peer.port && peer.host)*/ {
                            log.trace('internal socket: redirecting pkt from %s:%d through %s:%d to %s:%d', programHost, programPort, peer.socketToRemote.hostname, peer.socketToRemote.port, peer.remoteHostLastUsed, peer.remotePortLastUsed)
                            peer.socketToRemote.send(data, peer.remotePortLastUsed, peer.remoteHostLastUsed)
                        }
                        this.programHost = programHost
                        this.programPort = programPort
                    },
                }
            })
        }
        openSockets.add(peer.socketToProgram)

        log('created internal socket for peer %p at %s:%d', peer.peerId, peer.socketToProgram.hostname, peer.socketToProgram.port)

        for(const remoteHostPort of remoteHostPorts)
            this.peersByRemoteHostPort.set(remoteHostPort, peer)
        this.peersByPeerId.set(peer.peerId.toString(), peer)

        opts.signal.throwIfAborted()
        
        return peer
    }

    protected closeSockets(){
        for(const peer of this.peersByPeerId.values()){
            log('closing socket for peer %p at %s:%d', peer.peerId, peer.socketToProgram.hostname, peer.socketToProgram.port)
            openSockets.delete(peer.socketToProgram)
            peer.socketToProgram.close()
        }
        if(this.defaultSocketToRemote){
            log('closing socket at %s:%d', this.defaultSocketToRemote.hostname, this.defaultSocketToRemote.port)
            openSockets.delete(this.defaultSocketToRemote)
            this.defaultSocketToRemote.close()
        }
        this.peersByPeerId.clear()
        this.peersByRemoteHostPort.clear()
        this.defaultSocketToRemote = undefined
        this.programHost = undefined
        this.programPort = undefined
    }
}

export class ProxyServer extends Proxy {

    public async start(programPort: number, peerIds: PeerId[], opts: Required<AbortOptions>) {
        this.programHost = LOCALHOST
        this.programPort = programPort
        
        log('starting proxy server at %s:%d', this.programHost, this.programPort)

        await Promise.all([
            this.createDefaultSocketToRemote(opts),
            // eslint-disable-next-line @typescript-eslint/await-thenable
            peerIds.map(async (id) => this.createPeer(id, opts)),
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
            clientSidePeer.socketToRemote = serverSidePeer.socketToProgram
            serverSidePeer.socketToRemote = clientSidePeer.socketToProgram
            Object.defineProperties(serverSidePeer, {
                remoteHostLastUsed: { get: () => proxyClient.programHost },
                remotePortLastUsed: { get: () => proxyClient.programPort },
            })
            Object.defineProperties(clientSidePeer, {
                remoteHostLastUsed: { get: () => proxyServer.programHost },
                remotePortLastUsed: { get: () => proxyServer.programPort },
            })
        } else {

            log('connecting to remote server peer %p', id)

            await Promise.all([
                this.createDefaultSocketToRemote(opts),
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
