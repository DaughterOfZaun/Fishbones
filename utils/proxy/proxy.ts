import type { LibP2PNode } from "../../node/node"
import type { PeerId, AbortOptions } from "@libp2p/interface"
import { UseExistingLibP2PConnection } from "./strategy-libp2p"
import { Role, type AnySocket } from "./shared"
import { Wrapped } from '../../message/proxy'
import Queue from 'yocto-queue'
import { Peer, type WrappedPacket } from "./peer"

//import { LOCALHOST } from "./constants"
const LOCALHOST = "127.0.0.1"

import { logger } from "@libp2p/logger"
const log = logger('launcher:proxy')

//import { logger as ourLogger } from "../log"
//const ourLog = () => ourLogger.log.bind(logger, 'PROXY')
//const ourLog = (...args: Parameters<typeof console['log']>) => console.log(...args)
//const formatPeer = (peer: { peerId: PeerId }) => peer.peerId.toString().slice(-8)
//const formatData = (data: Buffer) => `${Bun.hash(data).toString(36)} (${data.length})`

type u = undefined
type PeerIdStr = string

interface PeerData {
    peerId: PeerId,
    socketToRemote: AnySocket,
    socketToProgram: SocketToProgram,
    peerToProgram?: Peer,
}

type SocketToProgram = AnySocket & {
    setPort(port: number): void
    port: number
}

class Proxy {
    
    protected readonly strategy: UseExistingLibP2PConnection
    protected readonly peersByPeerId = new Map<PeerIdStr, PeerData>()

    protected readonly role: Role
    protected readonly node: LibP2PNode
    protected constructor(node: LibP2PNode, role: Role){
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
            setPort(port: number){ programPortLastUsed = port },
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

    public constructor(node: LibP2PNode){
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
    
    public constructor(node: LibP2PNode){
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
type TimeSource = { now(): number }
class Scheduler {
    
    private interval: ReturnType<typeof setInterval> | undefined
    private queue = new Queue<Task>()

    constructor(
        private readonly timeSource: TimeSource,
    ){}

    public stop(){
        clearInterval(this.interval)
        this.interval = undefined
        this.queue.clear()
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public enqueue<T extends (...args: any[]) => void>(time: number, callback: T, ...args: Parameters<T>){
        if(time <= this.timeSource.now()){
            callback(...args)
            return
        }
        const task = { time, callback, args }
        this.queue.enqueue(task)
        if(!this.interval){
            this.interval = setInterval(this.onInterval, 1)
        }
    }
    private onInterval = () => {
        while(this.interval){
            const task = this.queue.peek()
            if(!task){
                clearInterval(this.interval)
                this.interval = undefined
                break
            }
            if(task.time <= this.timeSource.now()){
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

    private scheduler: Scheduler
    private timeSource: TimeSource
    private peerToClient: Peer | null = null
    private socketToClient: SocketToProgram | null = null
    private ownPeer: PeerData | null = null

    public constructor(node: LibP2PNode){
        super(node, Role.ClientServer)
        this.timeSource = node.services.time
        this.scheduler = new Scheduler(this.timeSource)
    }

    public async start(peerIds: PeerId[], opts: Required<AbortOptions>){
        //ourLog(this.node.peerId.toString(), 'start', JSON.stringify(peerIds.map(id => id.toString()), null, 4))

        for(const peerId of peerIds){
            const peer: PeerData = {
                peerId,
                socketToRemote: undefined!,
                socketToProgram: undefined!,
            }
            this.peersByPeerId.set(peerId.toString(), peer)
        }

        this.ownPeer = this.peersByPeerId.get(this.node.peerId.toString())!
        console.assert(this.ownPeer, 'Assertion failed: typeof this.ownPeer != "object"')

        const clientPort = 0
        const serverPort = 0
        
        await Promise.all([
            
            (async () => {
                const peer = this.ownPeer!
                this.socketToClient = await this.createSocketToProgram(
                    LOCALHOST, clientPort, this.onClientData.bind(this, peer), opts
                )
            })(),
            
            ...this.peersByPeerId.values()
                .map(async (peer) => {
                    peer.socketToProgram = await this.createSocketToProgram(
                        LOCALHOST, serverPort, this.onServerData.bind(this, peer), opts
                    )
                }),
            
            this.strategy.createMainSocketToRemote(opts),

            ...this.peersByPeerId.values()
                .filter(peer => peer != this.ownPeer)
                .map(async (peer) => {
                    peer.socketToRemote = await this.strategy.createSocketToRemote(
                        peer.peerId, this.onRemoteData.bind(this, peer), opts
                    )
                }),
        ])

        await Bun.sleep(1000) //HACK: By this time the main socket should be created on all machines.
        await this.strategy.connectSockets(opts)
    }

    public afterStart(serverPort: number){
        //ourLog(formatPeer(this.node), 'afterStart', serverPort)

        this.peerToClient = new Peer('peerToClient')
        this.peerToClient.onsend = (data) => {
            //console.log('peerToClient', 'send', this.peerToClient!.readPackets(data))
            try {
                this.socketToClient!.send(data)
            } catch(error) {
                const errno = error as ErrnoException
                if(errno.syscall === 'send' && errno.errno === -22 && errno.code === "EINVAL"){ /* Ignore. */ }
                else console.log(error)
            }
        }

        for(const peer of this.peersByPeerId.values()){
            peer.socketToProgram.setPort(serverPort)

            //if(peer === this.ownPeer) continue
            
            peer.peerToProgram = new Peer('peerToProgram')
            peer.peerToProgram.onsend = (data) => {
                //console.log('peerToProgram', 'send', peer.peerToProgram!.readPackets(data))
                peer.socketToProgram.send(data)
            }
            peer.peerToProgram.connect()
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private onClientData = (peer: PeerData, rawdata: Buffer, hostport: string) => {
        //ourLog(formatPeer(this.node), 'onClientData', formatData(rawdata), 'from', formatPeer(peer) + '/' + hostport)

        const packets = this.peerToClient!.receivePackets(rawdata)
        if(packets.length === 0) return

        const wrapped = Buffer.from(Wrapped.encode({ time: this.timeSource.now(), packets }))
        for(const peer of this.peersByPeerId.values()){
            if(peer === this.ownPeer){
                //ourLog(formatPeer(this.node), 'Sending', formatData(packets[0]!.data), 'to', 'localhost')
                this.onRemoteData(peer, wrapped, 'localhost')
            } else {
                //ourLog(formatPeer(this.node), 'Sending', formatData(packets[0]!.data), 'to', peer.socketToRemote.targetHostPort)
                peer.socketToRemote.send(wrapped)
            }
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private onRemoteData = (peer: PeerData, rawdata: Buffer, hostport: string) => {
        //ourLog(formatPeer(this.node), 'onRemoteData', formatData(rawdata), 'from', formatPeer(peer) + '/' + hostport)
        
        const unwrapped = Wrapped.decode(rawdata)
        const time = unwrapped.time
        const packets = unwrapped.packets.map(packet => ({
            fragment: packet.fragment,
            channelID: packet.channelID,
            data: Buffer.from(packet.data),
        }))

        //ourLog(formatPeer(this.node), 'Delaying', formatData(packets[0]!.data), 'to', peer.socketToProgram.targetHostPort)
        this.scheduler.enqueue(time + INPUT_DELAY, peerSendUnreliable, this.node, peer, packets)
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private onServerData = (peer: PeerData, rawdata: Buffer, hostport: string) => {
        //ourLog(formatPeer(this.node), 'onServerData', formatData(rawdata), 'from', formatPeer(peer) + '/' + hostport)
        
        const packets = peer.peerToProgram!.receivePackets(rawdata)
        if(packets.length === 0) return

        if(peer === this.ownPeer){
            //ourLog(formatPeer(this.node), 'Sending', formatData(packets[0]!.data), 'to', this.socketToClient!.targetHostPort)
            this.peerToClient!.sendUnreliable(packets)
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

//function peerSend(this_node: LibP2PNode, peer: PeerData, data: Buffer){
//    ourLog(formatPeer(this_node), 'Sending', formatData(data), 'to', peer.socketToProgram.targetHostPort)
//    peer.socketToProgram.send(data)
//}

function peerSendUnreliable(this_node: LibP2PNode, peer: PeerData, packets: WrappedPacket[]){
    //ourLog(formatPeer(this_node), 'Sending', formatData(packets[0]!.data), 'to', peer.socketToProgram.targetHostPort)
    peer.peerToProgram!.sendUnreliable(packets)
}
