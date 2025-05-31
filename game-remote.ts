import { LOBBY_PROTOCOL } from './utils/constants'
import { Peer as PBPeer } from './message/peer'
import { type Libp2p, type PeerId, type Stream, type StreamHandler } from '@libp2p/interface'
import * as lp from 'it-length-prefixed'
import { pbStream, type MessageStream } from 'it-protobuf-stream'
import { pipe } from 'it-pipe'
import { LobbyRequestMessage, LobbyNotificationMessage } from './message/lobby'
import { Game } from './game'
import type { Server } from './server'
import { logger } from '@libp2p/logger'

export class RemoteGame extends Game {
    protected log = logger('launcher:game-remote')

    public get canStart(): boolean { return false }

    public static create(node: Libp2p, ownerId: PeerId, server: Server, gameInfo: PBPeer.AdditionalData.GameInfo){
        const game = new RemoteGame(node, ownerId, server)
        game.decodeInplace(gameInfo)
        return game
    }

    public async connect(){
        if(this.connected) return true
        try {
            const connection = await this.node.dial(this.ownerId)
            const stream = await connection.newStream([ LOBBY_PROTOCOL ])
            this.stream = pbStream(stream).pb(LobbyRequestMessage)
            this.handleOutgoingStream({ stream, connection })
            this.connected = true
            return true
        } catch(err) {
            this.log.error(err)
            return false
        }
    }

    private stream?: MessageStream<LobbyRequestMessage, Stream>
    protected async stream_write(req: LobbyRequestMessage){
        try {
            await this.stream?.write(req)
            return true
        } catch(err) {
            this.log.error(err)
            return false
        }
    }
    
    private handleOutgoingStream: StreamHandler = async ({ stream, /*connection*/ }) => {
        //if(!connection.remotePeer.equals(this.id)) return
        try {
            await pipe(
                stream,
                (source) => lp.decode(source),
                async (source) => {
                    for await (const data of source) {
                        const req = LobbyNotificationMessage.decode(data)
                        this.handleResponse(req)
                    }
                }
            )
            this.cleanup()
            this.safeDispatchEvent('kick')
        } catch(err) {
            this.log.error(err)
        }
    }
    
    public disconnect() {
        if(!this.connected) return true
        //try {
            //await this.stream?.write({ ...lmDefaults, leaveRequest: {} })
            /*await*/ this.stream?.unwrap().unwrap().close()
                .catch(err => this.log.error(err))
            this.cleanup()
        //} catch(err) {
        //    this.log.error(err)
        //}
        return true
    }

    protected cleanup() {
        super.cleanup()
        this.stream = undefined
    }
}
