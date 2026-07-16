import { LOBBY_PROTOCOL, type u } from '../utils/constants'
import { type AbortOptions, type PeerId, type StreamHandler } from '@libp2p/interface'
import type { LibP2PNode } from '../node/node'
import { LobbyRequestMessage, LobbyNotificationMessage, KickReason } from '../message/lobby'
import { Game } from './game'
import { logger } from '@libp2p/logger'
import type { GamePlayer, PlayerId, PPP } from './game-player'
import { PeerMap } from '@libp2p/peer-collections'
import { pbStream } from '../utils/pb-stream'
import { combinations_find } from '../utils/data/constants/client-server-combinations'
import { bwPkg } from '../utils/data/packages' //TODO: Unhardcode.
//import { logger as myLogger } from '../utils/log'
import { tr } from '../utils/translation'
import { Team } from '../tui/lobby/lobby'

export class LocalGame extends Game {
    protected log = logger('launcher:game-local')

    //public readonly canStart = true
    public isPrivate: boolean = false
    
    private readonly peerId: PeerId
    private readonly playerId: PlayerId
    public constructor(node: LibP2PNode){
        super(node, node.peerId)
        this.playerId = this.peerIdToPlayerId(node.peerId)
        this.commit.value = bwPkg.gitRevision
        this.peerId = node.peerId
    }

    public async startListening(opts: Required<AbortOptions>){
        if(this.connected) return true
        await this.node.handle(LOBBY_PROTOCOL, this.handleIncomingStream, opts)
        this.connected = true
        return true
    }

    public autofill(){
        const teams = [ Team.Blue, Team.Purple ]
        const players = this.getPlayers()
        const playerCounts = teams.map(team => players.filter(player => player.team.value == team).length)
        const playersMax = Math.max(...playerCounts, this.playersMax.value ?? 0)
        const countsToAdd = playerCounts.map(playersCount => Math.max(0, playersMax - playersCount))
        this.addBots(countsToAdd)
    }

    public addBot(team: number){
        const a = []; a[team] = 1
        this.addBots(a)
    }

    public addBots(counts: number[]){

        const existingBots = [...this.players.values()]
            .filter(player => player.isBot && player.champion.value !== undefined)
            .map(player => player.champion.value!)


        const combo = combinations_find(this.clientVersion, this.serverVersion)!
        const map = combo.maps.get(this.map.value!)!
        const allBots = [...map.bots.keys(), ...combo.bots.keys()]
        const bots = [...(new Set(allBots).difference(new Set(existingBots))).values()]
        const peersRequests: LobbyNotificationMessage.PeerRequests[] = []

        counts.forEach((count, team) => {
            for(let i = 0; i < count; i++){
                const playerId = this.takePlayerId()
                const bot = this.players_add(playerId, undefined)
                
                if(bots.length === 0)
                    bots.push(...allBots)
                const champion = (bots.length > 0) ?
                    bots.splice(Math.floor(Math.random() * bots.length), 1)[0] :
                    undefined

                bot.name.value = tr('Bot')
                bot.team.value = team
                //this.assignTeamTo(bot)
                bot.champion.value = champion
                bot.difficulty.value = 0 //HACK: Newbie.

                peersRequests.push({
                    playerId,
                    joinRequest: {
                        name: bot.name.encode(),
                        icon: bot.icon.encode(),
                    },
                    pickRequest: {
                        team: bot.team.encode(),
                        champion: bot.champion.encode(),
                        difficulty: bot.difficulty.encode(),
                        talents: undefined!
                    }
                })
            }
        })
        this.broadcast({ peersRequests }, this.players.values())
    }

    public setBot(prop: PPP, value: number, playerId: PlayerId){
        const bot = this.getPlayer(playerId)
        if(!bot) return false
        
        bot[prop].value = value
        
        this.broadcast(
            {
                peersRequests: [{
                    playerId,
                    pickRequest: bot.encode(prop),
                }]
            },
            this.players.values()
        )
    }

    private handleIncomingStream: StreamHandler = async (stream, connection) => {
        const wrapped = pbStream(stream).pb(LobbyRequestMessage, LobbyNotificationMessage)

        let checkPassed = false
        let kickReason = KickReason.UNDEFINED
        let firstReq: u|LobbyRequestMessage = undefined
        try {
            firstReq = await wrapped.read()
            if(firstReq.joinRequest){
                const { password, version } = firstReq.joinRequest
                kickReason = this.getKickReason(true, password, version)
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
            for(;;){
                const req = await wrapped.read()
                this.handleRequest(playerId, req, wrapped, peerId)
            }
        } catch(err) {
            this.log.error(err)
        } finally {
            this.freePlayerId(playerId, peerId)
            this.handleRequest(playerId, { leaveRequest: true }, undefined, peerId)
        }
    }

    public kick(player: GamePlayer){
        
        const wrapped = player.stream
        const stream = player.stream?.unwrap().unwrap()
        const playerId = player.id
        const peerId = player.peerId

        const promise = Promise.resolve()
        if(wrapped)
            promise.then(async () => wrapped.write({ kickRequest: KickReason.MAKER_DECISION, peersRequests: [] }), err => this.log.error(err))
        if(stream)
            promise.then(async () => stream.close(), err => this.log.error(err))
        if(this.playerIds.has(playerId))
            this.freePlayerId(playerId, peerId)
        if(this.players.has(playerId))
            this.handleRequest(playerId, { leaveRequest: true }, undefined, peerId)
    }

    protected stream_write(req: LobbyRequestMessage): boolean {
        //myLogger.log(inspect({ method: 'stream_write', from: this.player?.id, req }))
        this.handleRequest(this.playerId, req, undefined, this.peerId)
        return true
    }
    protected broadcast(msg: LobbyNotificationMessage, to: Iterable<GamePlayer>, ignore?: GamePlayer): void {
        //myLogger.log(inspect({ method: 'broadcast', from: this.player?.id, to: [...to].map(player => player.id), ignore: ignore?.id, msg }))
        for(const player of to){
            if(player === ignore) continue
            if(player.id === this.playerId){
                this.handleResponse(msg)
            } else if(player.stream){
                player.stream.write(msg)
                    .catch(err => this.log.error(err))
            }
        }
    }

    public stopListening(){
        if(!this.connected) return true
        this.connected = false
        
        this.node.unhandle(LOBBY_PROTOCOL).catch(err => {
            this.log.error(tr('An error occurred while unhandling the protocol: %e'), err)
        })
        for(const player of this.players.values()){
            player.stream?.unwrap().unwrap().close()
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
            playerId = this.takePlayerId()
            this.peerIdToPlayerIdMap.set(peerId, playerId)
        }
        return playerId
    }
    private takePlayerId(){
        let playerId
        do {
            playerId = ((Math.random() * (2 ** 31)) | 0) as PlayerId
        } while(!playerId || this.playerIds.has(playerId));
        this.playerIds.add(playerId)
        return playerId
    }
    private freePlayerId(playerId: PlayerId, peerId?: PeerId){
        if(peerId)
            this.peerIdToPlayerIdMap.delete(peerId)
        this.playerIds.delete(playerId)
    }
}
