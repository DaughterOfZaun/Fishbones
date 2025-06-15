import type { Libp2p } from "libp2p";
import { LOCALHOST, PROXY_PROTOCOL } from "./constants";
import type { IncomingStreamData, PeerId, Stream } from "@libp2p/interface";
import { logger } from "@libp2p/logger";
import { pipe } from "it-pipe";
import * as lp from 'it-length-prefixed'
import { EventIterator } from 'event-iterator'
import type { Duplex, Source } from 'it-stream-types'
import type { Uint8ArrayList } from 'uint8arraylist'

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

    public constructor(node: Libp2p){
        this.node = node
    }

    public getPort(id: PeerId){
        return this.peers.get(id.toString())?.socket.port
    }

    protected async createPeer(id: PeerId, stream?: Stream, remoteAddress?: SocketAddress){
        const idStr = id.toString()

        const socket = await createSocket(remoteAddress)
        const peer = { socket, stream }
        this.peers.set(idStr, peer)
        return peer
    }

    protected /*async*/ handleStream(id: PeerId, stream: Stream, /*remoteAddress?: SocketAddress*/){
        const idStr = id.toString()

        // eslint-disable-next-line prefer-const
        let peer = this.peers.get(idStr)
        if(!peer){
            return //peer = await createPeer(id, remoteAddress)
        } else {
            // Only one stream per connection is allowed.
            peer.stream?.close().catch(err => log.error(err))
            peer.stream = stream
            //TODO: close pipes
        }

        pipe(
            peer.stream!.source,
            (source) => lp.decode(source),
            peer.socket.stream.sink,
        ).catch(err => log.error(err))

        pipe(
            peer.socket.stream.source,
            (source) => lp.encode(source),
            peer.stream!.sink,
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

    private readonly peerIds = new Map<PeerIdStr, PeerId>()
    private readonly localAddress: SocketAddress = { address: LOCALHOST, port: 0, }
    
    public async start(port: number, peerIds: PeerId[]){

        this.localAddress.port = port
        for(const id of peerIds){
            this.peerIds.set(id.toString(), id)
        }

        await Promise.all(
            peerIds.map(id =>
                this.createPeer(id, undefined, this.localAddress)
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

    private protocolHandler({ stream, connection }: IncomingStreamData){
        const id = connection.remotePeer
        //if(this.peerIds.has(id.toString())){
        if(this.peers.has(id.toString())){
            /*await*/ this.handleStream(id, stream, /*this.localAddress*/)
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
        const peer = await this.node.peerStore.getInfo(id)
        const addrs = peer.multiaddrs.filter(ma => ma.toOptions().transport == 'udp')
        const opts = { force: false, maxOutboundStreams: 1 } //as DialProtocolOptions & { force: boolean }
        const stream = await this.node.dialProtocol(addrs, PROXY_PROTOCOL, opts)
        const peer = await this.createPeer(id, stream)
        this.handleStream(id, stream)
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
