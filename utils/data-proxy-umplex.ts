import type { Libp2p } from "libp2p"
//import { LOCALHOST, PROXY_PROTOCOL } from "./constants"
const LOCALHOST = "127.0.0.1", PROXY_PROTOCOL = `/proxy/${0}`
import type { PeerId, AbortOptions, IncomingStreamData, Stream } from "@libp2p/interface"
import { logger } from "@libp2p/logger"
import { isENet, type BunSocket } from "../network/umplex"
import * as uMplex from '../network/umplex'
import { UTPMatcher } from "../network/tcp"
//import { registerShutdownHandler } from "./data-process"
import { PeerMap, PeerSet } from "@libp2p/peer-collections"
import { pipe } from "it-pipe"
import * as lp from 'it-length-prefixed'
import { AbortError, pushable, type Pushable } from 'it-pushable'

const log = logger('launcher:proxy')

type u = undefined
type PeerIdStr = string
type HostPortStr = string
//type HostPortObj = { host: string, port: number }
//type HostPort = string & HostPortObj
interface PeerData {
    peerId: PeerId,
    socketToRemote: AnySocket,
    socketToProgram: SocketToProgram,
}

type AnySocket = {
    sourceHostPort: string // Only used for logging.
    targetHostPort: string // Only used for logging.
    connected: boolean
    send(data: Buffer): boolean
    opened: boolean
    close(): void
}
type SocketToProgram = AnySocket & { port: number }

type Closable = { close(): void }
const openSockets = new Set<Closable>()
/*
registerShutdownHandler(() => {
    for(const socket of openSockets)
        socket.close()
    openSockets.clear()
})
*/
enum Role { Server, Client }
abstract class ConnectionStrategy {
    
    protected readonly role: Role
    protected readonly node: Libp2p
    public constructor(node: Libp2p, role: Role){
        this.node = node
        this.role = role
    }

    abstract createMainSocketToRemote(opts: Required<AbortOptions>): Promise<void>
    abstract createSocketToRemote(id: PeerId, onData: (data: Buffer, remoteHostPort: string) => void, opts: Required<AbortOptions>): Promise<AnySocket>
    abstract closeSockets(): void
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
class UseExistingLibP2PConnection extends ConnectionStrategy {

    peersAllowed = new PeerSet()
    socketsByPeerId = new PeerMap<AnySocket & {
        onData(data: Buffer, remoteHostPort: string): void
        pushable: Pushable<Buffer>
        stream?: Stream
    }>()

    closeSockets(): void {
        if(this.role === Role.Server)
            this.node.unhandle(PROXY_PROTOCOL).catch(err => log.error(err))
        for(const socket of this.socketsByPeerId.values())
            socket.close()
        this.socketsByPeerId.clear()
        this.peersAllowed.clear()
    }
    
    async createMainSocketToRemote(opts: Required<AbortOptions>): Promise<void> {
        if(this.role === Role.Server){
            await this.node.handle(PROXY_PROTOCOL, ({ stream, connection }: IncomingStreamData) => {
                const id = connection.remotePeer
                if(this.peersAllowed.has(id)){
                    this.handleStream(id, stream)
                } else {
                    stream.close().catch(err => log.error(err))
                    return
                }
            }, opts)
        }
    }

    async createSocketToRemote(id: PeerId, onData: (data: Buffer, remoteHostPort: string) => void): Promise<AnySocket> {

        const socket = {
            stream: undefined! as u|Stream,

            sourceHostPort: this.node.peerId.toString(),
            targetHostPort: id.toString(),
            
            onData,
            pushable: pushable<Buffer>({ objectMode: false }),
            send(data: Buffer){
                this.pushable.push(data)
                return true
            },
            
            get connected(){ return this.stream?.status === 'open' },
            get opened(){ return this.stream?.status === 'open' },
            close(){
                this.pushable.end(new AbortError())
                this.stream?.close().catch(err => log.error(err))
            }
        }

        this.socketsByPeerId.set(id, socket)
        this.peersAllowed.add(id)
        
        if(this.role === Role.Client){
            const stream = await this.node.dialProtocol(id, PROXY_PROTOCOL)
            this.handleStream(id, stream)
        }
        
        return socket
    }

    protected handleStream(peerId: PeerId, stream: Stream){
        const socket = this.socketsByPeerId.get(peerId)!

        socket.stream = stream

        pipe(
            stream.source,
            source => lp.decode(source),
            async source => {
                for await (const chunk of source) {
                    const data = Buffer.from(chunk.slice())
                    socket.onData(data, peerId.toString())
                }
            },
        ).catch(err => log.error(err))

        pipe(
            socket.pushable,
            source => lp.encode(source),
            stream.sink,
        ).catch(err => log.error(err))
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
class ShareSocketWithExistingUTPConnection extends ConnectionStrategy {
    
    protected mainSocketToRemote: u|BunSocket
    protected readonly socketsByRemoteHostPort = new Map<HostPortStr, AnySocket & {
        onData(data: Buffer, remotePort: number, remoteHost: string): void
    }>()

    private getRemoteHostPorts(id: PeerId): HostPortStr[] {

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

    public async createMainSocketToRemote(opts: Required<AbortOptions>){

        log('creating external socket')

        const socket = await uMplex.udpSocket({
            binaryType: 'buffer',
            socket: {
                filter: isENet,
                data: (_, data, remotePort, remoteHost) => {
                    const remoteHostPort = `${remoteHost}:${remotePort}`
                    const socket = this.socketsByRemoteHostPort.get(remoteHostPort)
                    if(!socket){
                        log.error('external socket: ignoring pkt from unknown addr %s:%d', remoteHost, remotePort)
                    } else {
                        socket.onData(data, remotePort, remoteHost)
                    }
                },
            }
        })
    
        log('created external socket at %s:%d', socket.hostname, socket.port)
        this.mainSocketToRemote = socket
        openSockets.add(socket)

        opts.signal.throwIfAborted()
    }

    // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
    public async createSocketToRemote(id: PeerId, onData: (data: Buffer, remoteHostPort: string) => void, opts: Required<AbortOptions>): Promise<AnySocket> {
        
        let remoteHostLastUsed = '',
            remotePortLastUsed = 0,
            remoteHostPorts: HostPortStr[] = []
        
        console.assert(!this.node.peerId.equals(id), '!this.node.peerId.equals(id)')

        remoteHostPorts = this.getRemoteHostPorts(id)
        if(!remoteHostPorts.length){
            log('peer %p is not connected.', id)
        } else {
            //remoteHost = remoteHostPorts[0]!.host
            //remotePort = remoteHostPorts[0]!.port
            const remoteHostPort = remoteHostPorts[0]!
            const index = remoteHostPort.lastIndexOf(':')
            remotePortLastUsed = parseInt(remoteHostPort.slice(index + 1))
            remoteHostLastUsed = remoteHostPort.slice(0, index)
        }

        const main = () => this.mainSocketToRemote!
        const socket = {
            close(): void { /* Ignore */ },
            get opened(){ return !main().closed },
            get sourceHostPort(){ return `${main().hostname}:${main().port}` },
            get targetHostPort(){ return `${remoteHostLastUsed}:${remotePortLastUsed}` },
            get connected(){ return !!(remoteHostLastUsed && remotePortLastUsed) },
            send(data: Buffer): boolean {
                return main().send(data, remotePortLastUsed, remoteHostLastUsed)
            },
            onData(data: Buffer, remotePort: number, remoteHost: string){
                const remoteHostPort = `${remoteHost}:${remotePort}`
                remoteHostLastUsed = remoteHost
                remotePortLastUsed = remotePort
                onData(data, remoteHostPort)
            },
        }

        for(const remoteHostPort of remoteHostPorts)
            this.socketsByRemoteHostPort.set(remoteHostPort, socket)

        return socket
    }

    public closeSockets(){
        if(this.mainSocketToRemote){
            log('closing socket at %s:%d', this.mainSocketToRemote.hostname, this.mainSocketToRemote.port)
            openSockets.delete(this.mainSocketToRemote)
            this.mainSocketToRemote.close()
            this.mainSocketToRemote = undefined
        }
        this.socketsByRemoteHostPort.clear()
    }
}

class Proxy {
    
    protected readonly strategy: ConnectionStrategy
    protected readonly peersByPeerId = new Map<PeerIdStr, PeerData>()

    protected readonly role: Role
    protected readonly node: Libp2p
    protected constructor(node: Libp2p, role: Role){
        this.strategy = new UseExistingLibP2PConnection(node, role)
        this.node = node
        this.role = role
    }

    public getPeer(id: PeerId){
        return this.peersByPeerId.get(id.toString())
    }

    public getPort(id: PeerId){
        return this.getPeer(id)?.socketToProgram.port
    }

    protected async createPeer(id: PeerId, programHost: string, programPort: number, opts: Required<AbortOptions>){
        
        log('creating internal socket for peer %p', id)

        const peer: PeerData = {
            peerId: id,
            socketToRemote: this.node.peerId.equals(id) ? undefined! : await this.strategy.createSocketToRemote(id, (data: Buffer, remoteHostPort: string) => {
                log.trace('external socket: redirecting pkt from %s through %s to %s', remoteHostPort, peer.socketToProgram.sourceHostPort, peer.socketToProgram.targetHostPort)
                peer.socketToProgram.send(data)
            }, opts),
            socketToProgram: await this.createSocketToProgram(programHost, programPort, (data: Buffer, programHostPort: string) => {
                log.trace('internal socket: redirecting pkt from %s through %s to %s', programHostPort, peer.socketToRemote.sourceHostPort, peer.socketToRemote.targetHostPort)
                peer.socketToRemote.send(data)
            }, opts)
        }
        openSockets.add(peer.socketToProgram)

        log('created internal socket for peer %p at %s', peer.peerId, peer.socketToProgram.sourceHostPort)

        this.peersByPeerId.set(peer.peerId.toString(), peer)

        opts.signal.throwIfAborted()
        
        return peer
    }

    private async createSocketToProgram(programHost: string, programPort: number, onData: (data: Buffer, programHostPort: string) => void, opts: Required<AbortOptions>): Promise<SocketToProgram> {
        let programHostLastUsed: string = programHost
        let programPortLastUsed: number = programPort
        const socket = await Bun.udpSocket({
            hostname: LOCALHOST,
            socket: {
                data: (_, data, programPort, programHost) => {
                    if(!programPortLastUsed || !programPortLastUsed){
                        log('internal socket: setting internal addr to %s:%d', programHost, programPort)
                    } else if(programHostLastUsed !== programHost || programPortLastUsed !== programPort){
                        log.error('internal socket: got pkt from unexpected addr %s:%d', programHost, programPort)
                    }
                    const programHostPort = `${programHost}:${programPort}`
                    programHostLastUsed = programHost
                    programPortLastUsed = programPort
                    onData(data, programHostPort)
                },
            }
        })
        
        opts.signal.throwIfAborted()

        return {
            close(): void { socket.close() },
            get port(){ return socket.port },
            get opened(){ return !socket.closed },
            get sourceHostPort(){ return `${socket.hostname}:${socket.port}` },
            get targetHostPort(){ return `${programHostLastUsed}:${programPortLastUsed}` },
            get connected(){ return !!(programHostLastUsed && programPortLastUsed) },
            send(data: Buffer): boolean {
                return socket.send(data, programPortLastUsed, programHostLastUsed)
            },
        }
    }

    protected closeSockets(){
        this.strategy.closeSockets()
        for(const peer of this.peersByPeerId.values()){
            log('closing socket for peer %p at %s', peer.peerId, peer.socketToProgram.sourceHostPort)
            openSockets.delete(peer.socketToProgram)
            peer.socketToProgram.close()
        }
        this.peersByPeerId.clear()
    }
}

export class ProxyServer extends Proxy {

    public constructor(node: Libp2p){
        super(node, Role.Server)
    }

    public async start(programPort: number, peerIds: PeerId[], opts: Required<AbortOptions>) {
        
        log('starting proxy server at %s:%d', LOCALHOST, programPort)

        await Promise.all([
            this.strategy.createMainSocketToRemote(opts),
            // eslint-disable-next-line @typescript-eslint/await-thenable
            peerIds.map(async (id) => this.createPeer(id, LOCALHOST, programPort, opts)),
        ])
    }
    
    public stop(){
        log('stopping proxy server')
        this.closeSockets()
    }
}

export class ProxyClient extends Proxy {
    
    public constructor(node: Libp2p){
        super(node, Role.Client)
    }

    private serverId: u|PeerId
    public async connect(id: PeerId, proxyServer: u|ProxyServer, opts: Required<AbortOptions>) {
        this.serverId = id
        if(id.equals(this.node.peerId) && proxyServer){

            log('connecting to local server peer %p', id)

            const proxyClient = this as ProxyClient
            const serverSidePeer = proxyServer.getPeer(id)!
            const clientSidePeer = await proxyClient.createPeer(id, LOCALHOST, 0, opts)
            clientSidePeer.socketToRemote = serverSidePeer.socketToProgram
            serverSidePeer.socketToRemote = clientSidePeer.socketToProgram

        } else {

            log('connecting to remote server peer %p', id)

            await Promise.all([
                this.strategy.createMainSocketToRemote(opts),
                this.createPeer(id, LOCALHOST, 0, opts),
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
