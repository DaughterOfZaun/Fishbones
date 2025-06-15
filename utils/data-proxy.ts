import type { Libp2p } from "libp2p";
import { LOCALHOST, PROXY_PROTOCOL } from "./constants";
import type { IncomingStreamData, PeerId, Stream } from "@libp2p/interface";
import { logger } from "@libp2p/logger";
import { pipe } from "it-pipe";
import * as lp from 'it-length-prefixed'
import { EventIterator } from 'event-iterator'
import type { Duplex, Source } from 'it-stream-types'
import type { Uint8ArrayList } from 'uint8arraylist'
import type { Multiaddr } from "@multiformats/multiaddr";

const log = logger('launcher:proxy')

type Socket = Bun.udp.Socket<'uint8array'>
type SocketData = Uint8Array<ArrayBufferLike>
type SocketStream = Duplex<AsyncIterable<SocketData>, Source<Uint8ArrayList>, Promise<void>>
type SocketAddress = { address: string, port: number }
type CustomizedSocket = Socket & {
    stream: SocketStream
    remoteAddress?: SocketAddress
    send(data: SocketData): boolean
}

async function createSocket(remoteAddress?: SocketAddress): Promise<CustomizedSocket> {
    
    const opts = {
        binaryType: 'uint8array' as const,
        hostname: LOCALHOST,
        connect: remoteAddress,
    }
    if(!remoteAddress) delete opts.connect
    const socket = await Bun.udpSocket(opts)

    const originalSend = socket.send
    const send = function send(this: CustomizedSocket, data: SocketData): boolean {
        if(!this.remoteAddress) return false
        const { port, address } = this.remoteAddress
        return originalSend.call(this, data, port, address)
    }
    
    const source = new EventIterator<SocketData>(queue => {
        socket.reload({
            data: (socket: CustomizedSocket, data, port, address) => {
                if(!socket.remoteAddress){
                    socket.remoteAddress = { port, address }
                }
                //if(socket.remoteAddress.port == port && socket.remoteAddress.address == address)
                    queue.push(data)
            },
            //drain: (socket: CustomizedSocket) => {},
            error: (socket: CustomizedSocket, error) => {
                queue.fail(error)
            },
        })
    })
    const sink = async (source: Source<Uint8ArrayList>) => {
        for await (const list of source) {
            for(const array of list){
                (socket as CustomizedSocket)
                .send(array)
            }
        }
    }
    
    return Object.assign(socket, {
        stream: { sink, source },
        remoteAddress,
        send,
    })
}

class Proxy {
    
    protected readonly peers = new Map<PeerIdStr, PeerData>()
    protected readonly node: Libp2p

    protected constructor(node: Libp2p){
        this.node = node
    }

    protected async handleStream(id: PeerId, stream: Stream, remoteAddress?: SocketAddress){
        const idStr = id.toString()

        let peer = this.peers.get(idStr)
        if(!peer){
            const socket = await createSocket(remoteAddress)
            peer = { socket, stream }
            this.peers.set(idStr, peer)
        } else {
            // Only one stream per connection is allowed.
            peer.stream.close().catch(err => log.error(err))
            peer.stream = stream
            //TODO: close pipes
        }

        pipe(
            peer.stream.source,
            (source) => lp.decode(source),
            peer.socket.stream.sink,
        ).catch(err => log.error(err))

        pipe(
            peer.socket.stream.source,
            (source) => lp.encode(source),
            peer.stream.sink,
        ).catch(err => log.error(err))
    }

    protected disconnect(){
        for(const peer of this.peers.values()){
            peer.stream.close().catch(err => log.error(err))
            //TODO: peer.socket.stream.close()
            peer.socket.close()
            //TODO: close pipes
        }
        this.peers.clear()
    }
}


type PeerIdStr = string
type PeerData = { socket: CustomizedSocket, stream: Stream }
export class ProxyServer extends Proxy {

    private readonly peerIds = new Map<PeerIdStr, PeerId>()
    private readonly localAddress: SocketAddress

    constructor(node: Libp2p, peerIds: PeerId[], port: number) {
        super(node)
        for(const id of peerIds)
            this.peerIds.set(id.toString(), id)
        this.localAddress = { port, address: LOCALHOST }
    }
    
    public start(){
        this.node.handle(PROXY_PROTOCOL, this.protocolHandler, {
            maxInboundStreams: 1,
            maxOutboundStreams: 1,
        })
    }
    
    public stop(){
        this.node.unhandle(PROXY_PROTOCOL)
        this.disconnect()
    }

    private protocolHandler({ stream, connection }: IncomingStreamData){
        const id = connection.remotePeer
        if(this.peerIds.has(id.toString())){
            /*await*/ this.handleStream(id, stream, this.localAddress)
        } else {
            stream.close().catch(err => log.error(err))
            return
        }
    }
}

export class ProxyClient extends Proxy {
    constructor(node: Libp2p){
        super(node)
    }
    public async connect(id: PeerId, addr: Multiaddr){
        const stream = await this.node.dialProtocol(addr, PROXY_PROTOCOL, { maxOutboundStreams: 1 })
        this.handleStream(id, stream)
    }
    public disconnect(){
        super.disconnect()
    }
}
