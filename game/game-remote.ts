import { LOBBY_PROTOCOL } from '../utils/constants'
import { Peer as PBPeer } from '../message/peer'
import { type AbortOptions, type IncomingStreamData, type Stream } from '@libp2p/interface'
import type { LibP2PNode } from '../node/node'
import * as lp from 'it-length-prefixed'
import { pbStream, type MessageStream } from '../utils/pb-stream'
import { pipe } from 'it-pipe'
import { LobbyRequestMessage, LobbyNotificationMessage } from '../message/lobby'
import { Game } from './game'
import type { Server } from './server'
import { logger } from '@libp2p/logger'

export class RemoteGame extends Game {
    protected log = logger('launcher:game-remote')

    public readonly canStart = false

    public static create(node: LibP2PNode, server: Server, gameInfo: PBPeer.AdditionalData.GameInfo){
        const game = new RemoteGame(node, server.id, server)
        game.decodeInplace(gameInfo)
        return game
    }

    public async connect(opts: Required<AbortOptions>){
        if(this.connected) return true
        try {
            const connection = await this.node.dial(this.ownerId, opts) //TODO: Switch to cm.openConnection?
            const stream = await connection.newStream([ LOBBY_PROTOCOL ], opts)
            this.stream = pbStream(stream).pb(LobbyNotificationMessage, LobbyRequestMessage)
            this.handleOutgoingStream({ stream, connection })
            this.connected = true
            return true
        } catch(err) {
            this.log.error(err)
            return false
        }
    }

    private stream?: MessageStream<LobbyNotificationMessage, LobbyRequestMessage, Stream>
    protected stream_write(req: LobbyRequestMessage){
        this.stream?.write(req).catch(err => this.log.error(err))
        return true
    }
    
    //TODO: opts: Required<AbortOptions>
    private handleOutgoingStream = ({ stream, /*connection*/ }: IncomingStreamData) => {
        //if(!connection.remotePeer.equals(this.id)) return
        pipe(
            stream,
            (source) => lp.decode(source),
            async (source) => {
                for await (const data of source) {
                    const req = LobbyNotificationMessage.decode(data)
                    this.handleResponse(req)
                }
            }
        ).catch(err => {
            this.log.error(err)
        }).finally(() => {
            this.cleanup()
            this.safeDispatchEvent('kick')
        })
    }
    
    public disconnect() {
        if(!this.connected) return true
        //try {
            //await this.stream?.write({ ...lmDefaults, leaveRequest: {} })
            this.stream?.unwrap().unwrap().close()
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
