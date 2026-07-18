import type { PeerId, AbortOptions, Stream, Startable, StreamHandler, Connection } from "@libp2p/interface"
import { PeerMap } from "@libp2p/peer-collections"
import { logger } from "@libp2p/logger"
import { AbortError, pushable as createPushable, type Pushable } from 'it-pushable'
import { ConnectionStrategy, DEFAULT_REMOTE_STREAM_INDEX, Role, type OnDataFromRemote, type RemoteStreamIndex, type SocketToRemote } from "./shared"
import type { Registrar } from "@libp2p/interface-internal"
import { lpStream } from "@libp2p/utils"
import { iter } from "../pb-stream"

//import { PROXY_PROTOCOL } from "./constants"
const PROXY_PROTOCOL = `/proxy/${0}`

const log = logger('launcher:proxy')

export class UseExistingLibP2PConnection extends ConnectionStrategy {

    socketsByPeerId = new PeerMap<SocketToRemote & {
        onData: OnDataFromRemote
        pushables: Pushable<Buffer>[]
        streams: Stream[]
    }>()

    closeSockets(): void {
        if((this.role & Role.Server) != 0)
            //this.node.unhandle(PROXY_PROTOCOL).catch(err => log.error(err))
            this.node.services.handler.unhandle(PROXY_PROTOCOL)
        for(const socket of this.socketsByPeerId.values())
            socket.close()
        this.socketsByPeerId.clear()
    }
    
    onStreamOpen = new Set<(id: PeerId, stream: Stream) => void>
    // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
    async createMainSocketToRemote(opts: Required<AbortOptions>): Promise<void> {
        if((this.role & Role.Server) != 0){
            //await this.node.handle(PROXY_PROTOCOL, this.onStream, opts)
            this.node.services.handler.handle(PROXY_PROTOCOL, this.onStream)
        }
    }

    onStream = (stream: Stream, connection: Connection) => {
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
    async createSocketToRemote(id: PeerId, streamsCount: number, onData: OnDataFromRemote, opts: Required<AbortOptions>): Promise<SocketToRemote> {

        const socket = {
            
            sourceHostPort: this.node.peerId.toString(),
            targetHostPort: id.toString(),
            
            onData,
            streams: [] as Stream[],
            pushables: [] as Pushable<Buffer>[],
            send(data: Buffer, streamIdx: number){
                let pushable = this.pushables[streamIdx]
                    pushable ??= this.pushables[DEFAULT_REMOTE_STREAM_INDEX]
                pushable?.push(data)
                return true
            },
            
            //get connected(){ return this.stream?.status === 'open' },
            //get opened(){ return this.stream?.status === 'open' },

            close(){
                for(let streamIdx = 0; streamIdx < this.pushables.length; streamIdx++)
                    this.pushables[streamIdx]!.end(new AbortError())
                for(let streamIdx = 0; streamIdx < this.streams.length; streamIdx++)
                    this.streams[streamIdx]!.close().catch(err => log.error(err))
            }
        }

        this.socketsByPeerId.set(id, socket)
        
        if(this.role === Role.Client){
            await this.connectToRemote(id, streamsCount, opts)
        }
        
        return socket
    }

    async connectSockets(opts: Required<AbortOptions>){
        return Promise.all(
            [...this.socketsByPeerId.entries()].map(async ([ id ]) => {
                return this.connectToRemote(id, 1, opts)
            })
        )
    }

    async connectToRemote(id: PeerId, streamsCount: number, opts: Required<AbortOptions>){
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
                .sort((a, b) => +(a.direction == 'outbound') - +(b.direction == 'outbound'))
            await Promise.all(
                Array(streamsCount).fill(undefined).map(async (_, i) => {
                    const stream = streams[i] ?? await connection.newStream(PROXY_PROTOCOL, opts)
                    this.handleStream(id, stream)
                })
            )
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
        const pushable = createPushable<Buffer>({ objectMode: false })

        const i = socket.pushables.push(pushable) 
        const streamIdx = socket.streams.push(stream) as RemoteStreamIndex
        console.assert(i == streamIdx, 'Assertion failed: i == streamIdx')

        //console.log(Role[this.role], 'handleStream', streamIdx)
        
        const wrapped = lpStream(stream)

        Promise.resolve().then(async () => {
            for await (const chunk of iter(stream, wrapped)){
                const data = Buffer.from(chunk.slice())
                socket.onData(data, streamIdx, peerId.toString())
            }
        }).catch(err => log.error(err))

        Promise.resolve().then(async () => {
            for await (const data of pushable){
                wrapped.write(data)
            }
        }).catch(err => log.error(err))
    }
}
