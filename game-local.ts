import { LOBBY_PROTOCOL, ufill, type u } from './utils/constants'
import { type Libp2p, type PeerId, type StreamHandler } from '@libp2p/interface'
import * as lp from 'it-length-prefixed'
import { pipe } from 'it-pipe'
import { LobbyRequestMessage, LobbyNotificationMessage, KickReason } from './message/lobby'
import { Game, type BroadcastOpts } from './game'
import { logger } from '@libp2p/logger'
import type { Server } from './server'
import type { PlayerId } from './game-player'
import { PeerMap } from '@libp2p/peer-collections'
import { pbStream } from './utils/pb-stream'

export class LocalGame extends Game {
    protected log = logger('launcher:game-local')

    public get canStart(){ return true }

    public static create(node: Libp2p, server: Server, port: number){
        return ufill(new LocalGame(node, server, port))
    }
    
    private readonly peerId: PeerId
    private readonly playerId: PlayerId
    protected constructor(node: Libp2p, server: Server, port: number){
        super(node, node.peerId, server, port)
        this.playerId = this.peerIdToPlayerId(node.peerId)
        this.peerId = node.peerId
    }

    public startListening(){
        if(this.connected) return true
        this.node.handle(LOBBY_PROTOCOL, this.handleIncomingStream)
        this.connected = true
        return true
    }

    private handleIncomingStream: StreamHandler = async ({ stream, connection }) => {
        const wrapped = pbStream(stream).pb(LobbyRequestMessage, LobbyNotificationMessage)

        let kickReason = KickReason.UNDEFINED
        let checkPassed = false
        let firstReq: u|LobbyRequestMessage = undefined
        try {
            firstReq = await wrapped.read()
            if(firstReq.joinRequest){
                kickReason = this.getKickReason(firstReq.joinRequest.password)
                checkPassed = kickReason === KickReason.UNDEFINED
            }
            if(kickReason != KickReason.UNDEFINED){
                await wrapped.write({ kickRequest: kickReason, peersRequests: [] })
            }
        } catch(err) {
            this.log.error(err)
        }

        if(!checkPassed || !firstReq){
            stream.close().catch(err => this.log.error(err))
            return
        }

        const peerId = connection.remotePeer
        const playerId = this.peerIdToPlayerId(peerId)

        this.handleRequest(playerId, firstReq, wrapped, peerId)

        try {
            await pipe(
                stream,
                (source) => lp.decode(source),
                async (source) => {
                    for await (const data of source) {
                        const req = LobbyRequestMessage.decode(data)
                        this.handleRequest(playerId, req, wrapped, peerId)
                    }
                }
            )
            this.freePlayerId(peerId, playerId)
            this.handleRequest(playerId, { leaveRequest: true }, undefined, peerId)
        } catch(err) {
            this.log.error(err)
        }
    }

    protected async stream_write(req: LobbyRequestMessage){
        this.handleRequest(this.playerId, req, undefined, this.peerId)
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
    private peerIdToPlayerId(peerId: PeerId){
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
    private freePlayerId(peerId: PeerId, playerId: PlayerId){
        this.peerIdToPlayerIdMap.delete(peerId)
        this.playerIds.delete(playerId)
    }
}
