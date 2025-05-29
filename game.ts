import { blowfishKey, GameMap as GameMap, GameMode as GameMode, Name, Password, PlayerCount, Rank, runes, talents, Team, type u } from './utils/constants'
import { TypedEventEmitter, type Libp2p, type PeerId, type Stream } from '@libp2p/interface'
import { GamePlayer, type PlayerId, type PPP } from './game-player'
import type { Peer as PBPeer } from './message/peer'
import type { Server } from './server'
import { LobbyNotificationMessage, PickRequest, State, type LobbyRequestMessage } from './message/lobby'
import { pbStream } from 'it-protobuf-stream'
import { arr2text, text2arr } from 'uint8-util'
import type { GameInfo } from './data'
import * as Data from './data'

type GameEvents = {
    update: CustomEvent,
    kick: CustomEvent,
    start: CustomEvent,
    wait: CustomEvent,
    launch: CustomEvent,
    stop: CustomEvent,
}
/*
enum State {
    Disconnected,
    Connected,
    Joined,
    Started,
    Launched,
}
*/
export type BroadcastOpts = { to: Iterable<GamePlayer>, ignore?: GamePlayer }

export abstract class Game extends TypedEventEmitter<GameEvents> {
    
    protected readonly node: Libp2p
    public readonly server: Server
    public readonly ownerId: PeerId
    
    public readonly name = new Name(`Custom Game`)
    public readonly map = new GameMap(1, () => this.server.maps)
    public readonly mode = new GameMode(0, () => this.server.modes)
    public readonly playersMax = new PlayerCount(5)
    public readonly password = new Password()

    protected player?: GamePlayer
    public getPlayer(){
        return this.player
    }
    
    protected players = new Map<PlayerId, GamePlayer>()
    protected players_count: number = 0
    protected players_add(id: PlayerId): GamePlayer {
        let player = this.players.get(id)
        if(!player){
            player = new GamePlayer(this, id)
            this.players.set(id, player)
        }
        return player
    }
    public getPlayers(){
        return [...this.players.values()]
    }
    public getPlayersCount(){
        return this.joined ? this.players.size : this.players_count
    }

    protected constructor(node: Libp2p, ownerId: PeerId, server: Server){
        super()
        this.node = node
        this.server = server
        this.ownerId = ownerId
    }

    public connected = false
    public joined = false
    public started = false
    public launched = false

    public abstract get canStart(): boolean
    //public abstract get canKick(): boolean

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected stream_write(req: LobbyRequestMessage): Promise<boolean> {
        throw new Error("Method not implemented")
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected broadcast(msg: LobbyNotificationMessage & BroadcastOpts): void {
        throw new Error("Method not implemented")
    }

    public async join(name: string): Promise<boolean> {

        //if(!this.connected) return false
        if(this.joined) return true

        return await this.stream_write({
            joinRequest: { name },
        })
    }
    private handleJoinRequest(player: GamePlayer, { name }: LobbyRequestMessage.JoinRequest) {

        const playerCounts: number[] = Array(Team.count).fill(0)
        this.players.forEach(player => {
            const i = player.team.value
            if(i != undefined) playerCounts[i]!++
        })
        const minPlayers = playerCounts.reduce((a, c) => Math.min(a, c))
        const team = playerCounts.indexOf(minPlayers)

        player.name.decodeInplace(name)
        player.team.value = team

        this.broadcast({
            to: this.players.values(),
            ignore: player,
            peersRequests: [{
                playerId: player.id,
                joinRequest: { name: player.name.encode(), },
                pickRequest: player.encode('team'),
            }]
        })
        
        const newPlayer = player
        this.broadcast({
            to: [ player ],
            peersRequests: [...this.players.values()].map(player => ({
                playerId: player.id,
                joinRequest: {
                    name: player.name.encode(),
                    isMe: player == newPlayer,
                },
                pickRequest: player.encode(),
            }))
        })
    }
    private handleJoinResponse(player: GamePlayer, res: LobbyNotificationMessage.JoinRequest){
        player.name.decodeInplace(res.name)
        if(res.isMe){
            this.player = player
            this.joined = true
        }
    }

    public start(){
        if(this.started) return true
        this.started = true
        
        this.broadcast({
            to: this.players.values(),
            switchStateRequest: State.STARTED,
            peersRequests: [],
        })
        return true
    }
    private async launch(){
        if(this.launched) return true
        this.launched = true

        this.broadcast({
            to: this.players.values(),
            switchStateRequest: State.LAUNCHED,
            peersRequests: [],
        })
        
        const port = 5119 //TODO: Unhardcode
        await Data.launchServer(port, this.getGameInfo())

        let i = 1
        for(const player of this.players.values())
        this.broadcast({
            to: [ player ],
            launchRequest: {
                ip: 0n,
                port,
                key: text2arr(blowfishKey),
                clientId: i++
            },
            peersRequests: [],
        })

        return true
    }
    private handleSwitchStateResponse(state: State){
        switch(state){
            //case State.UNDEFINED: break
            case State.STOPPED:
                this.started = false
                this.launched = false
                this.safeDispatchEvent('stop')
                break
            case State.STARTED:
                this.started = true
                this.launched = false
                this.safeDispatchEvent('start')
                break
            case State.LAUNCHED:
                this.started = true
                this.launched = true
                this.safeDispatchEvent('wait')
                break
        }
    }
    private async handleLaunchResponse(res: LobbyNotificationMessage.LaunchRequest){
        this.started = true
        this.launched = true
        this.safeDispatchEvent('launch')

        const peer = await this.node.peerStore.get(this.ownerId)
        const ip = peer.addresses
            //.sort((a, b) => 0)
            .map(({ multiaddr }) => multiaddr.toOptions())
            .find(opts => opts.family == 4)?.host
        
        const key = arr2text(res.key)
        const { port, clientId } = res
        
        if(ip) //TODO:
        await Data.launchClient(ip, port, key, clientId)
    }
    
    public async pick(prop: PPP, controller: AbortController) {
        const player = this.getPlayer()
        if(!player) return false
        const pdesc = player[prop]
        await pdesc.uinput(controller)
        return await this.stream_write({
            pickRequest: player.encode(prop)
        })
    }
    public async set(prop: PPP, value: number){
        const player = this.getPlayer()
        if(!player) return false
        //if(value !== undefined)
        player[prop].value = value
        return await this.stream_write({
            pickRequest: player.encode(prop)
        })
    }
    private handlePickRequest(player: GamePlayer, req: PickRequest){
        
        if(req.lock !== undefined){
            player.lock.value = +true
            req.lock = player.lock.encode()
        }

        if(player.lock.value){
            if(req.lock !== undefined) req = { lock: req.lock }
            else return false
        }

        if(this.started) {
            delete req.team
        } else {
            if(req.team !== undefined) req = { team: req.team }
            else return false
        }

        if(this.started && req.lock !== undefined){
            player.lock.value = +true
            
            if(this.getPlayers().every(p => !!p.lock.value)){
                this.launch()
                return
            }
        }

        this.broadcast({
            to: this.players.values(),
            peersRequests: [{
                playerId: player.id,
                pickRequest: req
            }]
        })
    }
    private handlePickResponse(player: GamePlayer, res: PickRequest){
        player.decodeInplace(res)
    }

    private handleLeaveRequest(player: GamePlayer){
        
        //player?.stream?.unwrap().unwrap().close()
        //    .catch(err => this.log.error(err))
        
        this.players.delete(player.id)
        
        this.broadcast({
            to: this.players.values(),
            peersRequests: [{
                playerId: player.id,
                leaveRequest: true,
            }]
        })
    }
    private handleLeaveResponse(player: GamePlayer){
        this.players.delete(player.id)
    }

    public encode() {
        return {
            id: 0,
            name: this.name.encode(),
            map: this.map.encode(),
            mode: this.mode.encode(),
            players: this.players.size,
            playersMax: this.playersMax.encode(),
            features: 0,
            passwordProtected: this.password.isSet(),
        }
    }
    public decodeInplace(gi: PBPeer.AdditionalData.GameInfo): boolean {
        let ret = true
            ret &&= this.name.decodeInplace(gi.name)
            ret &&= this.map.decodeInplace(gi.map)
            ret &&= this.mode.decodeInplace(gi.mode)
            this.players_count = gi.players
            ret &&= this.playersMax.decodeInplace(gi.playersMax)
        this.password.value = gi.passwordProtected ? '' : undefined
        return ret
    }

    protected handleRequest(playerId: PlayerId, req: LobbyRequestMessage, stream: u|Stream){
        let player: u|GamePlayer
        if(req.joinRequest && (player = this.players_add(playerId))){
            if(stream)
                player.stream = pbStream(stream).pb(LobbyNotificationMessage)
            this.handleJoinRequest(player, req.joinRequest)
        }
        if(req.pickRequest && (player = this.players.get(playerId))){
            this.handlePickRequest(player, req.pickRequest)
        }
        if(req.leaveRequest && (player = this.players.get(playerId))){
            this.handleLeaveRequest(player)
        }
    }
    protected handleResponse(ress: LobbyNotificationMessage){
        if(ress.peersRequests.length){
            for(const res of ress.peersRequests){
                let player: u|GamePlayer
                const playerId = res.playerId as PlayerId
                if(res.joinRequest && (player = this.players_add(playerId))){
                    this.handleJoinResponse(player, res.joinRequest)
                }
                if(res.pickRequest && (player = this.players.get(playerId))){
                    this.handlePickResponse(player, res.pickRequest)
                }
                if(res.leaveRequest && (player = this.players.get(playerId))){
                    this.handleLeaveResponse(player)
                }
            }
            this.safeDispatchEvent('update')
        }
        if(ress.switchStateRequest){
            this.handleSwitchStateResponse(ress.switchStateRequest)
        }
        if(ress.launchRequest){
            this.handleLaunchResponse(ress.launchRequest)
        }
    }
    /*
    PeerId_encode(from: PeerId){
        if(from == this.ownerId) return new Uint8Array()
        return publicKeyToProtobuf(from.publicKey!)
    }
    PeerId_decode(from: Uint8Array){
        if(from.length == 0) return this.ownerId
        return peerIdFromPublicKey(publicKeyFromProtobuf(from))
    }
    */
    public getGameInfo(): GameInfo {
        return {
            gameId: 1,
            game: {
                map: this.map.value ?? 1,
                gameMode: this.mode.toString(),
                mutators: Array(8).fill(''),
            },
            gameInfo: {
                TICK_RATE: this.server.tickRate.value ?? 30,
                FORCE_START_TIMER: 60, //TODO: Unhardcode
                USE_CACHE: true,
                IS_DAMAGE_TEXT_GLOBAL: false,
                ENABLE_CONTENT_LOADING_LOGS: false,
                SUPRESS_SCRIPT_NOT_FOUND_LOGS: true,
                CHEATS_ENABLED: false, //TODO: Unhardcode. Features
                MANACOSTS_ENABLED: true, //TODO: Unhardcode. Features
                COOLDOWNS_ENABLED: true, //TODO: Unhardcode. Features
                MINION_SPAWNS_ENABLED: true, //TODO: Unhardcode. Features
                LOG_IN_PACKETS: false,
                LOG_OUT_PACKETS: false,
                CONTENT_PATH: "../../../../Content/GameClient",
                ENDGAME_HTTP_POST_ADDRESS: "",
                scriptAssemblies: [
                    "ScriptsCore",
                    "CBProject-Converted",
                    "Chronobreak-Scripts"
                ]
            },
            players: this.getPlayers().map((player, i) => ({
                playerId: i + 1,
                blowfishKey, //TODO: Unhardcode. Security
                rank: Rank.random() ?? "DIAMOND",
                name: player.name.value ?? `Player ${i + 1}`,
                champion: player.champion.toString(), //TODO: Fix
                team: player.team.toString().toUpperCase(),
                skin: 0,
                summoner1: `Summoner${player.spell1.toString()}`,
                summoner2: `Summoner${player.spell2.toString()}`,
                ribbon: 2, // Unused
                icon: Math.floor(Math.random() * 743),
                runes,
                talents,
            }))
        }
    }
}
