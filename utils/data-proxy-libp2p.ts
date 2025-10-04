import type { PeerId, AbortOptions, IncomingStreamData, Stream } from "@libp2p/interface"
import { PeerMap, PeerSet } from "@libp2p/peer-collections"
import { logger } from "@libp2p/logger"
import { pipe } from "it-pipe"
import * as lp from 'it-length-prefixed'
import { AbortError, pushable, type Pushable } from 'it-pushable'
import { ConnectionStrategy, Role, type AnySocket } from "./data-proxy-shared"

//import { PROXY_PROTOCOL } from "./constants"
const PROXY_PROTOCOL = `/proxy/${0}`

const log = logger('launcher:proxy')

export class UseExistingLibP2PConnection extends ConnectionStrategy {

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
            stream: undefined! as Stream | undefined,

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
