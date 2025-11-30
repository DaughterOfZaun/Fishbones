import type { LibP2PNode } from "../../node/node"
import type { PeerId, AbortOptions } from "@libp2p/interface"
import { UseExistingLibP2PConnection } from "./strategy-libp2p"
import { Role, type AnySocket } from "./shared"
import { Wrapped } from '../../message/proxy'
import Queue from 'yocto-queue'
import { Peer } from "./peer"

//import { LOCALHOST } from "./constants"
const LOCALHOST = "127.0.0.1"

import { logger } from "@libp2p/logger"
const log = logger('launcher:proxy')

//import { logger as ourLogger } from "../log"
//const ourLog = () => ourLogger.log.bind(logger, 'PROXY')
const ourLog = (...args: Parameters<typeof console['log']>) => console.log(...args)
const formatPeer = (peer: { peerId: PeerId }) => peer.peerId.toString().slice(-8)
const formatData = (data: Buffer) => Bun.hash(data).toString(36)

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
class Scheduler {
    
    private interval: ReturnType<typeof setInterval> | undefined
    private queue = new Queue<Task>()

    public stop(){
        clearInterval(this.interval)
        this.interval = undefined
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
        while(this.interval){
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
    private peerToClient: Peer | null = null
    private socketToClient: SocketToProgram | null = null
    private ownPeer: PeerData | null = null

    public constructor(node: LibP2PNode){
        super(node, Role.ClientServer)
    }

    public async start(peerIds: PeerId[], opts: Required<AbortOptions>){
        ourLog(this.node.peerId.toString(), 'start', JSON.stringify(peerIds.map(id => id.toString()), null, 4))

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
            
            ...this.peersByPeerId.values().map(async (peer) => {
                peer.socketToProgram = await this.createSocketToProgram(
                    LOCALHOST, serverPort, this.onServerData.bind(this, peer), opts
                )
            }),
            
            this.strategy.createMainSocketToRemote(opts),

            ...this.peersByPeerId.values().filter(peer => peer != this.ownPeer).map(async (peer) => {
                peer.socketToRemote = await this.strategy.createSocketToRemote(
                    peer.peerId, this.onRemoteData.bind(this, peer), opts
                )
            }),
        ])

        await Bun.sleep(1000) //HACK: By this time the main socket should be created on all machines.
        await this.strategy.connectSockets(opts)
    }

    public afterStart(serverPort: number){
        ourLog(formatPeer(this.node), 'afterStart', serverPort)

        this.peerToClient = new Peer('peerToClient')
        this.peerToClient.onsend = (data) => {
            this.socketToClient!.send(data)
        }

        for(const peer of this.peersByPeerId.values()){
            peer.socketToProgram.setPort(serverPort)

            //if(peer === this.ownPeer) continue
            
            peer.peerToProgram = new Peer('peerToProgram')
            peer.peerToProgram.onsend = (data) => {
               peer.socketToProgram.send(data)
            }
            peer.peerToProgram.connect()
        }
    }

    //// eslint-disable-next-line @typescript-eslint/no-unused-vars
    private onClientData = (peer: PeerData, rawdata: Buffer, hostport: string) => {
        const time = Date.now()
        
        ourLog(formatPeer(this.node), 'onClientData', formatData(rawdata), 'from', formatPeer(peer) + '/' + hostport)

        //ourLog(formatPeer(this.node), 'Delaying', formatData(data), 'to', peer.socketToProgram.targetHostPort)        
        //this.scheduler.enqueue(time + INPUT_DELAY, peerSend, this.node, peer, data)
        
        //const message = readPacket(this.peerToClient!.name, data)
        const message = this.peerToClient!.receive(rawdata)!
        //if(message && message.data && this.peersByPeerId.size > 1){
        if(message && message.data){
            const { data, body: { channelID } } = message
            //const channelID = message.body.channelID
            const wrapped = Buffer.from(Wrapped.encode({ time, data, channelID }))
            for(const peer of this.peersByPeerId.values()){
                if(peer === this.ownPeer){
                    //ourLog(formatPeer(this.node), 'Delaying', formatData(data), 'to', peer.socketToProgram.targetHostPort)
                    //this.scheduler.enqueue(time + INPUT_DELAY, peerSendUnreliable, this.node, peer, data, channelID)
                    ourLog(formatPeer(this.node), 'Sending', formatData(data), 'to', 'localhost')
                    this.onRemoteData(peer, wrapped, 'localhost')
                } else {
                    ourLog(formatPeer(this.node), 'Sending', formatData(data), 'to', peer.socketToRemote.targetHostPort)
                    peer.socketToRemote.send(wrapped)
                }
            }
        }
    }

    //// eslint-disable-next-line @typescript-eslint/no-unused-vars
    private onRemoteData = (peer: PeerData, rawdata: Buffer, hostport: string) => {
        const unwrapped = Wrapped.decode(rawdata)
        const { time, channelID } = unwrapped
        const data = Buffer.from(unwrapped.data)

        ourLog(formatPeer(this.node), 'onRemoteData', formatData(data), 'from', formatPeer(peer) + '/' + hostport)
        ourLog(formatPeer(this.node), 'Delaying', formatData(data), 'to', peer.socketToProgram.targetHostPort)

        this.scheduler.enqueue(time + INPUT_DELAY, peerSendUnreliable, this.node, peer, data, channelID)
    }

    //// eslint-disable-next-line @typescript-eslint/no-unused-vars
    private onServerData = (peer: PeerData, data: Buffer, hostport: string) => {
        ourLog(formatPeer(this.node), 'onServerData', formatData(data), 'from', formatPeer(peer) + '/' + hostport)

        //const message = readPacket(peer.peerToProgram!.name, data)
        //if(message && peer === this.ownPeer){
        //    ourLog(formatPeer(this.node), 'Sending', formatData(data), 'to', this.socketToClient!.targetHostPort)
        //    this.socketToClient!.send(data)
        //}
        
        const message = peer.peerToProgram!.receive(data)
        if(message && message.data && peer === this.ownPeer){
            const { data, body: { channelID } } = message
            ourLog(formatPeer(this.node), 'Sending', formatData(data), 'to', this.socketToClient!.targetHostPort)
            this.peerToClient!.sendReliable(channelID, data)
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
//    const socket = peer.socketToProgram
//    ourLog(formatPeer(this_node), 'Sending', formatData(data), 'to', socket.targetHostPort)
//    socket.send(data)
//}

function peerSendUnreliable(this_node: LibP2PNode, peer: PeerData, data: Buffer, channelID: number){
    const socket = peer.socketToProgram
    ourLog(formatPeer(this_node), 'Sending', formatData(data), 'to', socket.targetHostPort)
    peer.peerToProgram!.sendReliable(channelID, data)
}
