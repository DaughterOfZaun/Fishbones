import type { Libp2p } from "libp2p";
import { LOCALHOST, PROXY_PROTOCOL } from "./constants";
import type { IncomingStreamData, PeerId } from "@libp2p/interface";
import { logger } from "@libp2p/logger";
import { pipe } from "it-pipe";
import * as lp from 'it-length-prefixed'
import { EventIterator } from 'event-iterator'
import type { Duplex, Source } from 'it-stream-types'
import type { Uint8ArrayList } from 'uint8arraylist'
import type { Queue } from 'event-iterator/lib/event-iterator'
import { duplexPair } from 'it-pair/duplex'
import type { Multiaddr, MultiaddrObject } from "@multiformats/multiaddr";

const log = logger('launcher:proxy')

type BaseStream = Duplex<
    AsyncGenerator<Uint8ArrayList | Uint8Array>,
    Source<Uint8ArrayList | Uint8Array>,
    Promise<void>
> & { close: () => Promise<void> }

type Socket = Bun.udp.Socket<'uint8array'>
type SocketData = Uint8Array<ArrayBufferLike>
type SocketStream =
    Duplex<AsyncIterable<SocketData>, Source<Uint8ArrayList>, Promise<void>>
    & { close: () => void }
type SocketAddress = { hostname: string, port: number }
type CustomizedSocket = Socket & {
    stream: SocketStream
    remoteAddr?: SocketAddress
    queue: Queue<SocketData>
}

const socketHandler = {
    data: (socket: CustomizedSocket, data: SocketData, port: number, address: string) => {
        socket.remoteAddr ||= { port, hostname: address }
        if(socket.remoteAddr.port == port && socket.remoteAddr.hostname == address)
            socket.queue.push(data)
    },
    //drain: (socket: CustomizedSocket) => {},
    error: (socket: CustomizedSocket, error: Error) => {
        socket.queue.fail(error)
    },
}

const socketSink = async function sink(this: CustomizedSocket, source: Source<Uint8ArrayList>){
    for await (const list of source) {
        if(!this.remoteAddr) continue
        const { port, hostname: address } = this.remoteAddr
        for(const data of list){
            this.send(data, port, address)
        }
    }
}

const socketClose = function close(this: CustomizedSocket){
    this.queue.stop()
}

export async function createSocket(remoteAddr?: SocketAddress): Promise<CustomizedSocket> {
    
    const socket = await Bun.udpSocket({
        binaryType: 'uint8array' as const,
        hostname: LOCALHOST, port: 0,
        //connect: remoteAddr,
        socket: socketHandler,
    }) as CustomizedSocket

    let queue!: Queue<SocketData>
    return Object.assign(socket, {
        stream: {
            source: new EventIterator<SocketData>(inner_queue => {
                socket.queue = queue = inner_queue
            }),
            sink: socketSink.bind(socket),
            close: socketClose.bind(socket),
        },
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

    protected async createPeer(id: PeerId, stream?: BaseStream, remoteAddr?: SocketAddress){
        const socket = await createSocket(remoteAddr)
        const peer = { socket, stream }
        this.peers.set(id.toString(), peer)
        return peer
    }

    public handleLocal(stream: BaseStream){
        const id = this.node.peerId
        const peer = this.peers.get(id.toString())!
        this.handleStream(peer, stream)
    }

    protected handleStream(peer: PeerData, stream: BaseStream){
        
        peer.stream?.close().catch(err => log.error(err))
        peer.stream = stream
        
        pipe(
            peer.stream, //!.source,
            (source) => lp.decode(source),
            peer.socket.stream, //.sink,
        ).catch(err => log.error(err))

        pipe(
            peer.socket.stream, //.source,
            (source) => lp.encode(source),
            peer.stream, //!.sink,
        ).catch(err => log.error(err))
    }

    protected disconnect(){
        for(const peer of this.peers.values()){
            peer.stream?.close().catch(err => log.error(err))
            peer.socket.stream.close()
            peer.socket.close()
        }
        this.peers.clear()
    }
}


type PeerIdStr = string
type PeerData = { socket: CustomizedSocket, stream?: BaseStream }
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
    public async connect(id: PeerId, proxyServer: undefined|ProxyServer){
        this.serverId = id
        
        const peer = await this.createPeer(id, undefined)
        if(id.equals(this.node.peerId) && proxyServer){
            const [d0, d1] = duplexPair<Uint8ArrayList | Uint8Array>().map(d => Object.assign(d, { close: () => Promise.resolve() }))
            proxyServer.handleLocal(d0!)
            this.handleStream(peer, d1!)
        } else {
            const peerInfo = await this.node.peerStore.getInfo(id)
            const addrs = peerInfo.multiaddrs
                .map(ma => [ma, ma.toOptions()] as [Multiaddr, MultiaddrObject])
                .sort(([,a], [,b]) => +(b.transport == 'udp') - +(a.transport == 'udp'))
                .map(([ma,]) => ma)
                .map(ma => ma.encapsulate(`/p2p/${id}`))
            const opts = { force: false, maxOutboundStreams: 1 } //as DialProtocolOptions & { force: boolean }
            const stream = await this.node.dialProtocol(addrs, PROXY_PROTOCOL, opts)
            this.handleStream(peer, stream)
        }
    }
    public disconnect(){
        this.serverId = undefined
        super.disconnect()
    }
    public getPort(id = this.serverId){
        console.assert(!id || id.equals(this.serverId), '!id || id.equals(this.serverId)')
        return id && super.getPort(id)
    }
}
