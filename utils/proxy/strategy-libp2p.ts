import type { PeerId, AbortOptions, IncomingStreamData, Stream, Startable, StreamHandler } from "@libp2p/interface"
import { PeerMap } from "@libp2p/peer-collections"
import { logger } from "@libp2p/logger"
import { pipe } from "it-pipe"
import * as lp from 'it-length-prefixed'
import { AbortError, pushable, type Pushable } from 'it-pushable'
import { ConnectionStrategy, Role, type AnySocket } from "./shared"
import type { Registrar } from "@libp2p/interface-internal"

//import { PROXY_PROTOCOL } from "./constants"
const PROXY_PROTOCOL = `/proxy/${0}`

const log = logger('launcher:proxy')

interface ProxyComponents {
    registrar: Registrar
}

export function proxy(){
  return (components: ProxyComponents) => new ProxyService(components)
}

//TODO: ProtocolHandlerService
//TODO: A service that registers protocols in advance and makes handle/unhandle operations synchronous.
class ProxyService implements Startable {
    
    constructor(
        private readonly components: ProxyComponents,
    ){}

    public async start(){
        return this.components.registrar.handle(PROXY_PROTOCOL, this.onStream)
    }
    
    public async stop() {
        return this.components.registrar.unhandle(PROXY_PROTOCOL)
    }

    private onStream = async (data: IncomingStreamData) => {
        return this.handler(data)
    }
    private defaultHandler = async ({ stream }: IncomingStreamData) => {
        return stream.close() //.catch(err => log.error(err))
    }
    private handler: StreamHandler = this.defaultHandler
    public handle(handler: StreamHandler){
        console.assert(this.handler === this.defaultHandler, 'Assertion failed: this.handler != default')
        this.handler = handler
    }
    public unhandle(){
        this.handler = this.defaultHandler
    }
}

export class UseExistingLibP2PConnection extends ConnectionStrategy {

    socketsByPeerId = new PeerMap<AnySocket & {
        onData(data: Buffer, remoteHostPort: string): void
        pushable: Pushable<Buffer>
        stream?: Stream
    }>()

    closeSockets(): void {
        if((this.role & Role.Server) != 0)
            //this.node.unhandle(PROXY_PROTOCOL).catch(err => log.error(err))
            this.node.services.proxy.unhandle()
        for(const socket of this.socketsByPeerId.values())
            socket.close()
        this.socketsByPeerId.clear()
    }
    
    onStreamOpen = new Set<(id: PeerId, stream: Stream) => void>
    // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
    async createMainSocketToRemote(opts: Required<AbortOptions>): Promise<void> {
        if((this.role & Role.Server) != 0){
            //await this.node.handle(PROXY_PROTOCOL, this.onStream, opts)
            this.node.services.proxy.handle(this.onStream)
        }
    }

    onStream = ({ stream, connection }: IncomingStreamData) => {
        const id = connection.remotePeer
        if(this.socketsByPeerId.has(id)){
            this.handleStream(id, stream)
            for(const callback of this.onStreamOpen){
                callback(id, stream)
            }
        } else {
            stream.close().catch(err => log.error(err))
            return
        }
    }

    //// eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
    async createSocketToRemote(id: PeerId, onData: (data: Buffer, remoteHostPort: string) => void, opts: Required<AbortOptions>): Promise<AnySocket> {

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
        
        if(this.role === Role.Client){
            await this.connectToRemote(id, opts)
        }
        
        return socket
    }

    async connectSockets(opts: Required<AbortOptions>){
        return Promise.all(
            [...this.socketsByPeerId.entries()].map(async ([ id ]) => {
                return this.connectToRemote(id, opts)
            })
        )
    }

    async connectToRemote(id: PeerId, opts: Required<AbortOptions>){
        let relativeRole = this.role
        if((this.role & Role.Client) != 0 && (this.role & Role.Server) != 0){
            const a = this.node.peerId.toString()
            const b = id.toString()
            console.assert(a.length === b.length, 'Assertion failed: a.length != b.length')
            relativeRole = (a > b) ? Role.Client : Role.Server
        }
        if((relativeRole & Role.Client) != 0){
            const connections = this.node.getConnections(id)
                .filter(connection => connection.status === 'open' && !connection.limits)
            const connection =
                connections.find(connection => connection.direction === 'outbound') ??
                connections.at(0) ?? await this.node.dial(id, { ...opts, force: false })
            const streams = connection.streams
                .filter(stream => stream.status === 'open' && stream.protocol === PROXY_PROTOCOL)
            const stream =
                streams.find(stream => stream.direction === 'outbound') ??
                streams.at(0) ?? await connection.newStream(PROXY_PROTOCOL, opts)
            this.handleStream(id, stream)
        }
        if((relativeRole & Role.Server) != 0){
            await new Promise<void>((resolve, reject) => {
                const connections = this.node.getConnections(id)
                const connection = connections.at(0)
                const streams = connection?.streams.filter(stream => stream.protocol === PROXY_PROTOCOL)
                const stream = streams?.at(0)
                
                if(stream) return resolve()
                
                // eslint-disable-next-line @typescript-eslint/no-this-alias
                const that = this
                const awaitedId = id

                opts.signal.addEventListener('abort', onAbort)
                function onAbort(){
                    finish(opts.signal.reason as Error)
                }

                this.onStreamOpen.add(onStreamOpen)
                function onStreamOpen(remoteId: PeerId){
                    if(remoteId.equals(awaitedId)){
                        finish()
                    }
                }

                function finish(err?: Error){
                    opts.signal.removeEventListener('abort', onAbort)
                    that.onStreamOpen.delete(onStreamOpen)
                    if(err) reject(err)
                    else resolve()
                }
            })
        }
    }

    protected handleStream(peerId: PeerId, stream: Stream){
        const socket = this.socketsByPeerId.get(peerId)!

        //TODO: Handle multiple streams.
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
