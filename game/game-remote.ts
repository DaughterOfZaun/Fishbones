import { logger } from '@libp2p/logger'
//import { logger as myLogger } from '../utils/log'
import type { AbortOptions, PeerId, Stream } from '@libp2p/interface'
import { pbStream, type ReadonlyMessageStream, type WriteonlyMessageStream } from '../utils/pb-stream'
import { LobbyRequestMessage, LobbyNotificationMessage } from '../message/lobby'
import { obtainConnection, type LibP2PNode } from '../node/node'
import { LOBBY_PROTOCOL } from '../utils/constants'
import { Game } from './game'

export class RemoteGame extends Game {
    protected log = logger('launcher:game-remote')

    //public readonly canStart = false

    public constructor(node: LibP2PNode, ownerId: PeerId){
        super(node, ownerId)
    }

    public async connect(opts: Required<AbortOptions>){
        if(this.connected) return true
        try {
            const connection = await obtainConnection(this.node, this.ownerId, opts)
            const stream = await connection.newStream([ LOBBY_PROTOCOL ], { ...opts, runOnLimitedConnection: false })
            const wrapped = pbStream(stream).pb(LobbyNotificationMessage, LobbyRequestMessage)
            this.handleIncomingStream(stream, wrapped)
            this.stream = wrapped
            this.connected = true
            return true
        } catch(err) {
            this.log.error(err)
            return false
        }
    }

    private stream?: WriteonlyMessageStream<LobbyRequestMessage>
    protected stream_write(req: LobbyRequestMessage){
        //myLogger.log(inspect({ method: 'stream_write', from: this.player?.id, req }))
        this.stream?.write(req).catch(err => this.log.error(err))
        return true
    }
    
    //TODO: opts: Required<AbortOptions>
    private handleIncomingStream(stream: Stream, wrapped: ReadonlyMessageStream<LobbyNotificationMessage>){
        Promise.resolve().then(async () => {
            for await (const req of wrapped.iter()){
                this.handleResponse(req)
            }
        }).catch(err => {
            this.log.error(err)
        }).finally(() => {
            this.emit('kick', new CustomEvent('kick'))
            this.cleanup()
        })
    }
    
    public async disconnect() {
        if(!this.connected) return true
        try {
            await this.stream?.write({ leaveRequest: true })
        } catch(err) {
            this.log.error(err)
        } finally {
            try {
                await this.stream?.unwrap().unwrap().close()
            } catch(err) {
                this.log.error(err)
            }
            this.cleanup()
        }
        return true
    }

    protected cleanup() {
        super.cleanup()
        this.stream = undefined
    }
}
