import type { Libp2p } from "libp2p";
import { LOCALHOST, PROXY_PROTOCOL } from "./constants";
import type { IncomingStreamData, PeerId, Stream } from "@libp2p/interface";
import { logger } from "@libp2p/logger";
import { pipe } from "it-pipe";
import * as lp from 'it-length-prefixed'
import { EventIterator } from 'event-iterator'
import type { Duplex, Source } from 'it-stream-types'
import type { Uint8ArrayList } from 'uint8arraylist'
import type { Queue } from "event-iterator/lib/event-iterator";

const log = logger('launcher:proxy')

type Socket = Bun.udp.Socket<'uint8array'>
type SocketData = Uint8Array<ArrayBufferLike>
type SocketStream = Duplex<AsyncIterable<SocketData>, Source<Uint8ArrayList>, Promise<void>>
type SocketAddress = { hostname: string, port: number }
type CustomizedSocket = Socket & {
    stream: SocketStream
    remoteAddr?: SocketAddress
    //send(data: SocketData): boolean
    queue: Queue<SocketData>
}

const socketHandler = {
    data: (socket: CustomizedSocket, data: SocketData, port: number, address: string) => {

        //console.log('recv', address, port, 'to', socket.hostname, socket.port, ':', data.toString())

        socket.remoteAddr ||= { port, hostname: address }
        if(socket.remoteAddr.port == port && socket.remoteAddr.hostname == address)
            socket.queue.push(data)
    },
    //drain: (socket: CustomizedSocket) => {},
    error: (socket: CustomizedSocket, error: Error) => {
        socket.queue.fail(error)
    },
}

export async function createSocket(remoteAddr?: SocketAddress): Promise<CustomizedSocket> {
    
    const opts = {
        binaryType: 'uint8array' as const,
        hostname: LOCALHOST, port: 0,
        //connect: remoteAddr,
        socket: socketHandler,
    }
    //if(!remoteAddr) delete opts.connect
    const socket = await Bun.udpSocket(opts)

    const originalSend = socket.send
    const send = function send(this: CustomizedSocket, data: SocketData): boolean {

        //console.log('send', 'from', this.hostname, this.port, 'to', this.remoteAddr?.hostname, this.remoteAddr?.port, ':', data.toString())

        if(!this.remoteAddr) return false
        const { port, hostname: address } = this.remoteAddr
        return originalSend.call(this, data, port, address)
    }
    
    let queue!: Queue<SocketData>
    const source = new EventIterator<SocketData>(inner_queue => {
        queue = inner_queue
    })
    const sink = async (source: Source<Uint8ArrayList>) => {
        
        //console.log('sink')

        for await (const list of source) {
            for(const array of list){
                send.call(socket as CustomizedSocket, array)
            }
        }
    }
    
    return Object.assign(socket, {
        stream: { sink, source },
        remoteAddr,
        //send,
        queue,
    })
}

class Proxy {
    
    protected readonly peers = new Map<PeerIdStr, PeerData>()
    protected readonly node: Libp2p

    public constructor(node: Libp2p){
        this.node = node
    }

    public getPort(id: PeerId){
        const peer = this.peers.get(id.toString())
        return peer?.socket.port
    }

    protected async createPeer(id: PeerId, stream?: Stream, remoteAddr?: SocketAddress){
        const socket = await createSocket(remoteAddr)
        const peer = { socket, stream }
        this.peers.set(id.toString(), peer)
        return peer
    }

    protected handleStream(peer: PeerData, stream: Stream){
        
        peer.stream?.close().catch(err => log.error(err))
        peer.stream = stream
        
        pipe(
            peer.stream, //!.source,
            /*async function * (source){
                for await (const chunk of source){
                    console.log('recv from stream', chunk.subarray().toString())
                    yield chunk
                }
            },*/
            (source) => lp.decode(source),
            peer.socket.stream, //.sink,
        ).catch(err => log.error(err))

        pipe(
            peer.socket.stream, //.source,
            /*async function*(source){
                for await(const chunk of source){
                    console.log('recv from socket', chunk.subarray().toString())
                    yield chunk
                }
            },*/
            (source) => lp.encode(source),
            peer.stream, //!.sink,
        ).catch(err => log.error(err))
    }

    protected disconnect(){
        for(const peer of this.peers.values()){
            peer.stream?.close().catch(err => log.error(err))
            //TODO: peer.socket.stream.close()
            peer.socket.close()
            //TODO: close pipes
        }
        this.peers.clear()
    }
}


type PeerIdStr = string
type PeerData = { socket: CustomizedSocket, stream?: Stream }
export class ProxyServer extends Proxy {

    private readonly localAddr: SocketAddress = { hostname: LOCALHOST, port: 0, }

    public async start(port: number, peerIds: PeerId[]){
        this.localAddr.port = port
        await Promise.all(
            peerIds.map(id =>
                this.createPeer(id, undefined, this.localAddr)
            )
        )
        this.node.handle(PROXY_PROTOCOL, this.protocolHandler, {
            maxInboundStreams: 1,
            maxOutboundStreams: 1,
        })
    }
    
    public stop(){
        this.node.unhandle(PROXY_PROTOCOL)
        this.disconnect()
    }

    private protocolHandler = ({ stream, connection }: IncomingStreamData) => {
        const id = connection.remotePeer
        const peer = this.peers.get(id.toString())
        if(peer){
            this.handleStream(peer, stream)
        } else {
            stream.close().catch(err => log.error(err))
            return
        }
    }
}

export class ProxyClient extends Proxy {
    private serverId?: PeerId
    public async connect(id: PeerId){
        this.serverId = id
        const peerInfo = await this.node.peerStore.getInfo(id)
        const addrs = peerInfo.multiaddrs
            .filter(ma => ma.toOptions().transport == 'udp')
            .map(ma => ma.encapsulate(`/p2p/${id}`))
        const opts = { force: false, maxOutboundStreams: 1 } //as DialProtocolOptions & { force: boolean }
        const stream = await this.node.dialProtocol(addrs, PROXY_PROTOCOL, opts)
        const peer = await this.createPeer(id, undefined)
        this.handleStream(peer, stream)
    }
    public disconnect(){
        this.serverId = undefined
        super.disconnect()
    }
    public getPort(id = this.serverId){
        console.assert(!id || id.equals(this.serverId))
        return id && super.getPort(id)
    }
}
