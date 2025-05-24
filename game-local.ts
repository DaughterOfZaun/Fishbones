import { LOBBY_PROTOCOL, Team, ufill, type u } from './utils/constants'
import { Peer as PBPeer } from './message/peer'
import { type Libp2p, type PeerId, type StreamHandler } from '@libp2p/interface'
import * as lp from 'it-length-prefixed'
import { pbStream } from 'it-protobuf-stream'
import { pipe } from 'it-pipe'
import { LobbyRequestMessage, LobbyNotificationMessage, PickRequest } from './message/lobby'
import { publicKeyToProtobuf } from '@libp2p/crypto/keys'
import { Game } from './game'
import type { GamePlayer, PPP } from './game-player'
import { logger } from '@libp2p/logger'
import type { Server } from './server'

export class LocalGame extends Game {
    private log = logger('launcher:game-local')

    public static create(node: Libp2p, server: Server){
        return ufill(new LocalGame(node, server)/*, ['name', 'map', 'mode', 'playersMax', 'password']*/)
    }

    public getData() {
        const data: PBPeer.AdditionalData = {
            name: 'Player',
            serverSettings: this.server.encode(),
            gameInfos: [ this.encode() ],
        }
        return data
    }

    public async join(name: string){
        
        this.joinInternal(this.id, { name, roomId: 0 })

        if(!this.joined){
            this.joined = true
            this.node.handle(LOBBY_PROTOCOL, this.handleProtocol)
        }
        return true
    }
    private handleProtocol: StreamHandler = async ({ stream, connection }) => {
        const peerId = connection.remotePeer
        try {
            await pipe(
                stream,
                (source) => lp.decode(source),
                async (source) => {
                    for await (const data of source) {
                        const req = LobbyRequestMessage.decode(data)
                        let player: u|GamePlayer
                        if(req.joinRequest && (player = this.players_add(peerId))){
                            player.stream = pbStream(stream).pb(LobbyNotificationMessage)
                            this.joinInternal(peerId, req.joinRequest)
                        }
                        //if(req.leaveRequest){
                        //    this.leaveInternal(peerId)
                        //}
                        if(req.pickRequest && (player = this.players.get(peerId))){
                            this.pickInternal(peerId, req.pickRequest)
                        }
                    }
                }
            )
            this.leaveInternal(peerId)
        } catch(err) {
            this.log.error(err)
        }
    }
    private joinInternal(id: PeerId, { name }: LobbyRequestMessage.JoinRequest) {
        
        console.assert(id.publicKey !== undefined)
        
        const playerCounts: number[] = Array(Team.count).fill(0)
        this.players.forEach(player => {
            const i = player.team.value
            if(i != undefined) playerCounts[i]!++
        })
        const minPlayers = playerCounts.reduce((a, c) => Math.min(a, c))
        const team = playerCounts.indexOf(minPlayers)

        const player = this.players_add(id)
        player.name.value = name //TODO:
        player.team.value = team //TODO:
        this.safeDispatchEvent('update')

        if(player.id.equals(this.id)) return

        this.broadcast({
            to: this.players.values(),
            ignore: player,
            peersRequests: [{
                publicKey: publicKeyToProtobuf(player.id.publicKey!),
                joinRequest: { name: player.name.encode(), },
                pickRequest: player.encode('team'),
            }]
        })
        
        this.broadcast({
            to: [ player ],
            peersRequests: [...this.players.values()].map(player => ({
                publicKey: publicKeyToProtobuf(player.id.publicKey!),
                //TODO: publicKey: new UInt8Array(),
                joinRequest: { name: player.name.encode(), },
                pickRequests: player.encode(),
            }))
        })
    }

    private broadcast(msg: LobbyNotificationMessage & { to: Iterable<GamePlayer>, ignore?: GamePlayer }){
        for(const player of msg.to){
            if(player.stream && player !== msg.ignore){
                /* await */ player.stream.write(msg)
                    .catch(err => this.log.error(err))
            }
        }
    }

    public async leave(){
        this.node.unhandle(LOBBY_PROTOCOL)
        for(const player of this.players.values()){
            /*await*/ player?.stream?.unwrap().unwrap().close()
            .catch(err => this.log.error(err))
        }
        this.players.clear()
        this.joined = false
        return true
    }
    private leaveInternal(id: PeerId){
        
        const player = this.players.get(id)
        if(!player) return

        //player?.stream?.unwrap().unwrap().close()
        //    .catch(err => this.log.error(err))
        
        this.players.delete(id)
        this.safeDispatchEvent('update')
        
        this.broadcast({
            to: this.players.values(),
            peersRequests: [{
                publicKey: publicKeyToProtobuf(player.id.publicKey!),
                leaveNotification: true,
            }]
        })
    }

    public get canStart(){ return true }
    public async start(){
        if(!this.started){
            this.started = true
            this.safeDispatchEvent('pick')

            this.broadcast({
                to: this.players.values(),
                startNotification: true,
                peersRequests: [],
            })
        }
        return true
    }

    public async set(prop: PPP, value?: number){
        const player = this.getPlayer()
        if(!player) return false

        if(value !== undefined)
            player[prop].value = value
        
        this.pickInternal(player.id, player.encode(prop))
        return true
    }

    private pickInternal(peerId: PeerId, req: PickRequest){
        this.safeDispatchEvent('update')
        this.broadcast({
            to: this.players.values(),
            startNotification: false,
            peersRequests: [{
                publicKey: publicKeyToProtobuf(peerId.publicKey!),
                pickRequest: req
            }]
        })
    }
}
