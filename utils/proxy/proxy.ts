import type { Libp2p } from "libp2p"
import type { PeerId, AbortOptions } from "@libp2p/interface"
import { logger } from "@libp2p/logger"
import { UseExistingLibP2PConnection } from "./strategy-libp2p"
import { Role, type AnySocket, type ConnectionStrategy } from "./shared"
import { Wrapped } from '../../message/proxy'
import Queue from 'yocto-queue'

//import { LOCALHOST } from "./constants"
const LOCALHOST = "127.0.0.1"

const log = logger('launcher:proxy')

type u = undefined
type PeerIdStr = string

interface PeerData {
    peerId: PeerId,
    socketToRemote: AnySocket,
    socketToProgram: SocketToProgram,
}

type SocketToProgram = AnySocket & { port: number }

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
        //openSockets.add(peer.socketToProgram)

        log('created internal socket for peer %p at %s', peer.peerId, peer.socketToProgram.sourceHostPort)

        this.peersByPeerId.set(peer.peerId.toString(), peer)

        opts.signal.throwIfAborted()
        
        return peer
    }

    protected async createSocketToProgram(programHost: string, programPort: number, onData: (data: Buffer, programHostPort: string) => void, opts: Required<AbortOptions>): Promise<SocketToProgram> {
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
                if(socket.closed){
                    log.error('attempting to send data through a closed socket')
                    return false
                }
                return socket.send(data, programPortLastUsed, programHostLastUsed)
            },
        }
    }

    protected closeSockets(){
        this.strategy.closeSockets()
        for(const peer of this.peersByPeerId.values()){
            log('closing socket for peer %p at %s', peer.peerId, peer.socketToProgram.sourceHostPort)
            //openSockets.delete(peer.socketToProgram)
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

type Task = {
    time: number
    callback: (...args: unknown[]) => void,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args: any[]
}
class Scheduler {
    
    private interval: ReturnType<typeof setInterval> | undefined
    private queue = new Queue<Task>()

    public stop(){
        clearInterval(this.interval)
        this.queue.clear()
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public enqueue<T extends (...args: any[]) => void>(time: number, callback: T, ...args: Parameters<T>){
        const task = { time, callback, args }
        this.queue.enqueue(task)
        if(!this.interval){
            this.interval = setInterval(this.onInterval, 1)
        }
    }
    private onInterval = () => {
        while(true){
            const task = this.queue.peek()
            if(!task){
                clearInterval(this.interval)
                this.interval = undefined
                break
            }
            if(task.time <= Date.now()){
                task.callback.apply(null, task.args)
                this.queue.dequeue()
                continue
            }
            break
        }
    }
}

const INPUT_DELAY = 150

export class ClientServerProxy extends Proxy {

    private scheduler = new Scheduler()
    private socketToClient: SocketToProgram | null = null
    private ownPeer: PeerData | null = null

    public constructor(node: Libp2p){
        super(node, Role.ClientServer)
    }

    public async start(serverPort: number, peerIds: PeerId[], opts: Required<AbortOptions>){
        const programHost: string = LOCALHOST
        const clientPort = 0

        for(const peerId of peerIds){
            const peer: PeerData = {
                peerId,
                socketToRemote: undefined!,
                socketToProgram: undefined!,
            }
            this.peersByPeerId.set(peerId.toString(), peer)
        }

        this.ownPeer = this.peersByPeerId.get(this.node.peerId.toString())!
        console.assert(this.ownPeer)

        await Promise.all([
            this.strategy.createMainSocketToRemote(opts),
            (async () => {
                const peer = this.ownPeer!
                this.socketToClient = await this.createSocketToProgram(
                    programHost, clientPort, this.onClientData.bind(this, peer), opts
                )
            })(),
            ...this.peersByPeerId.values().map(async (peer) => {
                peer.socketToProgram = await this.createSocketToProgram(
                    programHost, serverPort, this.onServerData.bind(this, peer), opts
                )
            }),
        ])
    }

    public async connect(opts: Required<AbortOptions>){
        await Promise.all(this.peersByPeerId.values().map(async (peer) => {
            if(peer === this.ownPeer) return
            peer.socketToRemote = await this.strategy.createSocketToRemote(
                peer.peerId, this.onRemoteData.bind(this, peer), opts
            )
        }))
    }

    private onClientData = (peer: PeerData, data: Buffer) => {
        //console_log('onClientData')

        const time = Date.now()
        const wrapped = Buffer.from(Wrapped.encode({ time, data }))
        for(const peer of this.peersByPeerId.values()){
            if(peer === this.ownPeer){
                this.onRemoteDataUnwrapped(peer, time, data)
            } else {
                peer.socketToRemote.send(wrapped)
            }
        }
    }

    private onRemoteData = (peer: PeerData, data: Buffer) => {
        //console_log('onRemoteData')

        const unwrapped = Wrapped.decode(data)
        const unwrapped_data = Buffer.from(unwrapped.data)
        this.onRemoteDataUnwrapped(peer, unwrapped.time, unwrapped_data)
    }

    private onRemoteDataUnwrapped = (peer: PeerData, time: number, data: Buffer) => {
        //console_log('onRemoteDataUnwrapped')

        const socket = peer.socketToProgram
        this.scheduler.enqueue(time + INPUT_DELAY, socketSend, socket, data)
    }

    private onServerData = (peer: PeerData, data: Buffer) => {
        //console_log('onServerData')

        if(peer === this.ownPeer){
            this.socketToClient!.send(data)
        }
    }

    public getClientPort(){
        return this.socketToClient?.port
    }

    public stop(){
        this.scheduler.stop()
        this.closeSockets()
        this.socketToClient = null
        this.ownPeer = null
    }
}

function socketSend(socket: SocketToProgram, data: Buffer){
    //console_log('socketSend')

    socket.send(data)
}
