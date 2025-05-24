import { LOBBY_PROTOCOL, ufill } from './utils/constants'
import { Peer as PBPeer } from './message/peer'
import { type Libp2p, type StreamHandler } from '@libp2p/interface'
import * as lp from 'it-length-prefixed'
import { pipe } from 'it-pipe'
import { LobbyRequestMessage, LobbyNotificationMessage } from './message/lobby'
import { Game, type BroadcastOpts } from './game'
import { logger } from '@libp2p/logger'
import type { Server } from './server'

export class LocalGame extends Game {
    protected log = logger('launcher:game-local')

    public get canStart(){ return true }

    public static create(node: Libp2p, server: Server){
        return ufill(new LocalGame(node, node.peerId, server)/*, ['name', 'map', 'mode', 'playersMax', 'password']*/)
    }

    public encodeData() {
        const data: PBPeer.AdditionalData = {
            name: 'Player',
            serverSettings: this.server.encode(),
            gameInfos: [ this.encode() ],
        }
        return data
    }

    public listen(){
        if(this.connected) return true
        this.node.handle(LOBBY_PROTOCOL, this.handleIncomingStream)
        this.connected = true
        return true
    }

    private handleIncomingStream: StreamHandler = async ({ stream, connection }) => {
        const peerId = connection.remotePeer
        try {
            await pipe(
                stream,
                (source) => lp.decode(source),
                async (source) => {
                    for await (const data of source) {
                        const req = LobbyRequestMessage.decode(data)
                        this.handleRequest(peerId, req, stream)
                    }
                }
            )
            this.handleRequest(peerId, { leaveRequest: true }, undefined)
        } catch(err) {
            this.log.error(err)
        }
    }

    protected async stream_write(req: LobbyRequestMessage){
        this.handleRequest(this.node.peerId, req, undefined)
        return true
    }
    protected broadcast(msg: LobbyNotificationMessage & BroadcastOpts){
        for(const player of msg.to){
            if(player == msg.ignore) continue
            if(player.stream){
                /* await */ player.stream.write(msg)
                    .catch(err => this.log.error(err))
            } else {
                this.handleResponse(msg)
            }
        }
    }

    public async stop(){
        if(!this.connected) return true
        
        this.node.unhandle(LOBBY_PROTOCOL)
        for(const player of this.players.values()){
            /*await*/ player?.stream?.unwrap().unwrap().close()
            .catch(err => this.log.error(err))
        }
        this.cleanup()
        return true
    }

    private cleanup(){
        this.players.clear()
        this.connected = false
        this.joined = false
        this.started = false
    }
}
