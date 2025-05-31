import { LOBBY_PROTOCOL, ufill } from './utils/constants'
import { type Libp2p, type PeerId, type StreamHandler } from '@libp2p/interface'
import * as lp from 'it-length-prefixed'
import { pipe } from 'it-pipe'
import { LobbyRequestMessage, LobbyNotificationMessage, KickReason } from './message/lobby'
import { Game, type BroadcastOpts } from './game'
import { logger } from '@libp2p/logger'
import type { Server } from './server'
import type { PlayerId } from './game-player'
import { PeerMap } from '@libp2p/peer-collections'
import { pbStream } from 'it-protobuf-stream'

export class LocalGame extends Game {
    protected log = logger('launcher:game-local')

    public get canStart(){ return true }

    public static create(node: Libp2p, server: Server){
        return ufill(new LocalGame(node, server))
    }
    
    private readonly playerId: PlayerId
    protected constructor(node: Libp2p, server: Server){
        super(node, node.peerId, server)
        this.playerId = this.peerIdToPlayerId(node.peerId)
    }

    public startListening(){
        if(this.connected) return true
        this.node.handle(LOBBY_PROTOCOL, this.handleIncomingStream)
        this.connected = true
        return true
    }

    private handleIncomingStream: StreamHandler = async ({ stream, connection }) => {
        const peerId = connection.remotePeer
        const playerId = this.peerIdToPlayerId(peerId)
        let reason = KickReason.UNDEFINED
        let passedCheck = false
        try {
            await pipe(
                stream,
                (source) => lp.decode(source),
                async (source) => {
                    for await (const data of source) {
                        const req = LobbyRequestMessage.decode(data)
                        const wrapped = pbStream(stream).pb(LobbyNotificationMessage)
                        if(req.joinRequest){
                            if(!this.isJoinable()){
                                reason = KickReason.MAX_PLAYERS
                            } else if(this.password.isSet && this.password.encode() != req.joinRequest.password){
                                reason = KickReason.WRONG_PASSWORD
                            } else {
                                passedCheck = true
                            }
                        }
                        if(reason != KickReason.UNDEFINED){
                            try { await wrapped.write({ kickRequest: reason, peersRequests: [] }) }
                            catch(err) { this.log.error(err) }
                        }
                        if(passedCheck){
                            this.handleRequest(playerId, req, wrapped)
                        } else {
                            try { await stream.close() }
                            catch(err) { this.log.error(err) }
                            break
                        }
                    }
                }
            )
            this.freePlayerId(peerId, playerId)
            this.handleRequest(playerId, { leaveRequest: true }, undefined)
        } catch(err) {
            this.log.error(err)
        }
    }

    protected async stream_write(req: LobbyRequestMessage){
        this.handleRequest(this.playerId, req, undefined)
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

    public stopListening(){
        if(!this.connected) return true
        this.connected = false
        
        this.node.unhandle(LOBBY_PROTOCOL)
        for(const player of this.players.values()){
            /*await*/ player?.stream?.unwrap().unwrap().close()
            .catch(err => this.log.error(err))
        }
        this.cleanup()
        return true
    }

    private playerIds = new Set<PlayerId>()
    private peerIdToPlayerIdMap = new PeerMap<PlayerId>()
    protected peerIdToPlayerId(peerId: PeerId){
        let playerId = this.peerIdToPlayerIdMap.get(peerId)
        if(!playerId){
            do {
                playerId = ((Math.random() * (2 ** 31)) | 0) as PlayerId
            } while(!playerId || this.playerIds.has(playerId));
            this.playerIds.add(playerId)
            this.peerIdToPlayerIdMap.set(peerId, playerId)
        }
        return playerId
    }
    protected freePlayerId(peerId: PeerId, playerId: PlayerId){
        this.peerIdToPlayerIdMap.delete(peerId)
        this.playerIds.delete(playerId)
    }
}
