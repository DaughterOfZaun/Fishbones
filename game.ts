import { blowfishKey, FeaturesEnabled, GameMap as GameMap, GameMode as GameMode, LOCALHOST, Name, Password, PlayerCount, runes, talents, Team, type u } from './utils/constants'
import { TypedEventEmitter, type AbortOptions, type Libp2p, type PeerId, type Stream } from '@libp2p/interface'
import { GamePlayer, type PlayerId, type PPP } from './game-player'
import type { Peer as PBPeer } from './message/peer'
import type { Server } from './server'
import { KickReason, LobbyNotificationMessage, PickRequest, State, type LobbyRequestMessage } from './message/lobby'
import { arr2text, text2arr } from 'uint8-util'
import type { GameInfo } from './utils/game-info'
import { ProxyClient, ProxyServer } from './utils/data-proxy-umplex'
import type { WriteonlyMessageStream } from './utils/pb-stream'
import { launchClient, relaunchClient, stopClient } from './utils/data-client'
import { launchServer, stopServer } from './utils/data-server'
import { safeOptions, shutdownOptions } from './utils/data-process'
import { logger } from './utils/data-shared'

interface GameEvents {
    update: CustomEvent,
    kick: CustomEvent,
    start: CustomEvent,
    wait: CustomEvent,
    launch: CustomEvent,
    crash: CustomEvent,
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

export abstract class Game extends TypedEventEmitter<GameEvents> {
    
    protected readonly node: Libp2p
    public readonly server: Server
    public readonly ownerId: PeerId
    
    public readonly name = new Name(`Game`)
    public readonly map = new GameMap(1, () => this.server.maps)
    public readonly mode = new GameMode(0, () => this.server.modes)
    public readonly playersMax = new PlayerCount(5)
    public readonly password = new Password()
    public readonly features = new FeaturesEnabled()

    protected player?: GamePlayer
    public getPlayer(){
        return this.player
    }
    
    protected readonly players = new Map<PlayerId, GamePlayer>()
    protected players_count = 0
    protected players_add(id: PlayerId, peerId: u|PeerId, isBot?: boolean): GamePlayer {
        let player = this.players.get(id)
        if(!player){
            player = new GamePlayer(this, id, peerId, isBot)
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

    protected cleanup(){
        stopClient(safeOptions).catch(err => {
            logger.log('An error occurred when stopping the client:', Bun.inspect(err))
        })
        this.proxyClient?.disconnect()
        this.proxyClient = undefined
        stopServer(safeOptions).catch(err => {
            logger.log('An error occurred when stopping the server:', Bun.inspect(err))
        })
        this.proxyServer?.stop()
        this.proxyServer = undefined
        
        this.players.clear()
        
        this.connected = false
        this.joined = false
        this.started = false
        this.launched = false
    }

    public abstract get canStart(): boolean
    //public abstract get canKick(): boolean

    private proxyServer?: ProxyServer
    private proxyClient?: ProxyClient

    public isJoinable(): boolean {
        return this.getKickReason() == KickReason.UNDEFINED
    }

    protected getKickReason(password?: string): KickReason {
        let kickReason = KickReason.UNDEFINED
        if(this.started){
            kickReason = KickReason.STARTED
        } else if(this.getPlayersCount() >= 2 * (this.playersMax.value ?? 0)){
            kickReason = KickReason.MAX_PLAYERS
        } else if(this.password.isSet && this.password.encode() != password){
            kickReason = KickReason.WRONG_PASSWORD
        }
        return kickReason
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected stream_write(req: LobbyRequestMessage): boolean {
        throw new Error("Method not implemented")
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected broadcast(msg: LobbyNotificationMessage, to: Iterable<GamePlayer>, ignore?: GamePlayer): void {
        throw new Error("Method not implemented")
    }

    public join(name: string, password: u|string): boolean {

        //if(!this.connected) return false
        if(this.joined) return true

        return this.stream_write({
            joinRequest: { name, password },
        })
    }
    protected assignTeamTo(player: GamePlayer){
        const playerCounts = Array<number>(Team.count).fill(0)
        this.players.forEach(player => {
            const i = player.team.value
            if(i != undefined) playerCounts[i]!++
        })
        const minPlayers = playerCounts.reduce((a, c) => Math.min(a, c))
        const team = playerCounts.indexOf(minPlayers)

        player.team.value = team
    }
    private handleJoinRequest(player: GamePlayer, { name }: LobbyRequestMessage.JoinRequest) {

        player.name.decodeInplace(name)
        this.assignTeamTo(player)

        this.broadcast(
            {
                peersRequests: [{
                    playerId: player.id,
                    joinRequest: { name: player.name.encode(), },
                    pickRequest: player.encode('team'),
                }]
            },
            this.players.values(),
            player,
        )
        
        const newPlayer = player
        this.broadcast(
            {
                peersRequests: [...this.players.values()].map(player => ({
                    playerId: player.id,
                    joinRequest: {
                        name: player.name.encode(),
                        isMe: player == newPlayer,
                    },
                    pickRequest: player.encode(),
                }))
            },
            [ player ],
        )
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
        
        this.broadcast(
            {
                switchStateRequest: State.STARTED,
                peersRequests: [],
            },
            this.players.values(),
        )
        return true
    }
    private launch(){
        if(this.launched) return true
        this.launched = true

        this.launchAsync(shutdownOptions).catch(err => {
            logger.log('Failed to launch server:', Bun.inspect(err))
        })

        return true
    }
    private async launchAsync(opts: Required<AbortOptions>){
        const players = this.getPlayers()
        this.broadcast(
            {
                switchStateRequest: State.LAUNCHED,
                peersRequests: [],
            },
            players,
        )
        
        try {
            const proc = await launchServer(this.getGameInfo(), opts)
            proc.once('exit', this.onServerExit)
            
            this.proxyServer = new ProxyServer(this.node)
            const peerIds = players.filter(p => !!p.peerId).map(p => p.peerId!)
            await this.proxyServer.start(proc.port, peerIds, opts)
        } catch(err) {
            logger.log('Failed to start server:', Bun.inspect(err))
            this.onServerExit()
            return false
        }

        let i = 1
        for(const player of players)
        this.broadcast(
            {
                peersRequests: [],
                launchRequest: {
                    ip: 0n,
                    port: 0,
                    key: text2arr(blowfishKey),
                    clientId: i++
                },
            },
            [ player ],
        )
    }
    private onServerExit = (/*code, signal*/) => {

        this.proxyServer?.stop()
        this.proxyServer = undefined

        this.broadcast(
            {
                switchStateRequest: State.STOPPED,
                //peersRequests: this.unlockAllPlayers(),
                peersRequests: []
            },
            this.players.values(),
        )
    }
    private handleSwitchStateResponse(state: State){
        switch(state){
            //case State.UNDEFINED: break
            case State.STOPPED:
                this.started = false
                this.launched = false
                this.unlockAllPlayers()
                stopClient(safeOptions).catch(err => {
                    logger.log('An error occurred when stopping the client:', Bun.inspect(err))
                })
                this.proxyClient?.disconnect()
                this.proxyClient = undefined
                stopServer(safeOptions).catch(err => {
                    logger.log('An error occurred when stopping the server:', Bun.inspect(err))
                })
                this.proxyServer?.stop()
                this.proxyServer = undefined
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
    private handleLaunchResponse(res: LobbyNotificationMessage.LaunchRequest){
        this.started = true
        this.launched = true
        this.safeDispatchEvent('launch')

        this.handleLaunchResponseAsync(res, shutdownOptions).catch(err => {
            logger.log('An error occurred while processing the launch notification', Bun.inspect(err))
        })
    }
    private async handleLaunchResponseAsync(res: LobbyNotificationMessage.LaunchRequest, opts: Required<AbortOptions>){
        //const peer = await this.node.peerStore.get(this.ownerId, opts)
        //const ip = peer.addresses
        //    //.sort((a, b) => 0)
        //    .map(({ multiaddr }) => multiaddr.toOptions())
        //    .find(opts => opts.family == 4)?.host
        const key = arr2text(res.key)
        //const { port, clientId } = res
        const { clientId } = res
        
        //TODO: try-catch
        this.proxyClient = new ProxyClient(this.node)
        await this.proxyClient.connect(this.ownerId, this.proxyServer, opts)
        const port = this.proxyClient.getPort()!
        const ip = LOCALHOST
        
        try {
            const proc = await launchClient(ip, port, key, clientId, opts)
            proc.once('exit', this.onClientExit)
            return true
        } catch(err) {
            logger.log('Failed to start client:', Bun.inspect(err))
            this.onClientExit()
            return false
        }
    }
    public relaunch(){
        this.relaunchAsync(shutdownOptions).catch(err => {
            logger.log('Failed to restart client:', Bun.inspect(err))
        })
    }
    private async relaunchAsync(opts: Required<AbortOptions>){
        try {
            const proc = await relaunchClient(opts)
            proc.once('exit', this.onClientExit)
            return true
        } catch(err) {
            logger.log('Failed to restart client:', Bun.inspect(err))
            this.onClientExit()
            return false
        }
    }
    private onClientExit = (/*code, signal*/) => {
        if(this.launched)
            this.safeDispatchEvent('crash')
    }

    public async pick(prop: PPP, opts: Required<AbortOptions>, player?: GamePlayer) {
        player ??= this.getPlayer()
        if(!player) return false
        const pdesc = player[prop]
        await pdesc.uinput(opts)
        return this.stream_write({
            pickRequest: player.encode(prop)
        })
    }
    public set(prop: PPP, value: number){
        const player = this.getPlayer()
        if(!player) return false
        //if(value !== undefined)
        player[prop].value = value
        return this.stream_write({
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
            
            const players = this.getPlayers()
            if(players.every(p => !!p.lock.value || p.isBot)){
                for(const player of players)
                    player.fillUnset()
                this.launch()
                return
            }
        }

        this.broadcast(
            {
                peersRequests: [{
                    playerId: player.id,
                    pickRequest: req
                }]
            },
            this.players.values(),
        )
    }
    private handlePickResponse(player: GamePlayer, res: PickRequest){
        player.decodeInplace(res)
    }

    private unlockAllPlayers(){
        const remainingPlayers = this.players.values()
        //const unlockRequests: LobbyNotificationMessage.PeerRequests[] = []
        for(const player of remainingPlayers){
            if(player.lock.value){
                player.lock.value = +false
                //unlockRequests.push({
                //    playerId: player.id,
                //    pickRequest: {
                //        lock: player.lock.encode()
                //    }
                //})
            }
        }
        //return unlockRequests
    }
    private handleLeaveRequest(player: GamePlayer){
        
        //player?.stream?.unwrap().unwrap().close()
        //    .catch(err => this.log.error(err))
        
        this.players.delete(player.id)
        const leaveRequest = {
            playerId: player.id,
            leaveRequest: true,
        }
        const remainingPlayers = [...this.players.values()]
        if(!this.started || this.launched){
            this.broadcast(
                {
                    peersRequests: [ leaveRequest ]
                },
                remainingPlayers,
            )
        } else {
            this.broadcast(
                {
                    switchStateRequest: State.STOPPED,
                    peersRequests: [
                        leaveRequest,
                        //...this.unlockAllPlayers()
                    ]
                },
                remainingPlayers,
            )
        }
    }
    private handleLeaveResponse(player: GamePlayer){
        this.players.delete(player.id)
    }

    private handleKickRequest(reason: KickReason){
        this.safeDispatchEvent('kick', { reason })
    }

    public encode(): PBPeer.AdditionalData.GameInfo {
        return {
            id: 0,
            name: this.name.encode(),
            map: this.map.encode(),
            mode: this.mode.encode(),
            players: this.players.size,
            playersMax: this.playersMax.encode(),
            features: this.features.encode(),
            passwordProtected: this.password.isSet,
        }
    }
    public decodeInplace(gi: PBPeer.AdditionalData.GameInfo): boolean {
        let ret = true
            ret &&= this.name.decodeInplace(gi.name)
            ret &&= this.map.decodeInplace(gi.map)
            ret &&= this.mode.decodeInplace(gi.mode)
            this.players_count = gi.players
            ret &&= this.playersMax.decodeInplace(gi.playersMax)
            ret &&= this.features.decodeInplace(gi.features)
        this.password.value = gi.passwordProtected ? 'non-empty' : undefined
        return ret
    }

    protected handleRequest(playerId: PlayerId, req: LobbyRequestMessage, stream: u|WriteonlyMessageStream<LobbyNotificationMessage, Stream>, peerId: u|PeerId){
        let player: u|GamePlayer
        if(req.joinRequest && peerId){
            player = this.players_add(playerId, peerId)
            if(stream) player.stream = stream
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
                if(res.joinRequest){
                    player = this.players_add(playerId, undefined)
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
        if(ress.kickRequest){
            this.handleKickRequest(ress.kickRequest)
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
            gameId: 0,
            game: {
                map: this.map.value ?? 4,
                gameMode: this.mode.toString(),
                mutators: Array<string>(8).fill(''),
                dataPackage: 'AvCsharp-Scripts',
            },
            gameInfo: {
                TICK_RATE: this.server.tickRate.value ?? 30,
                CLIENT_VERSION: '1.0.0.126',
                FORCE_START_TIMER: 180, //TODO: Unhardcode
                KEEP_ALIVE_WHEN_EMPTY: false,
                IS_DAMAGE_TEXT_GLOBAL: false,
                SUPRESS_SCRIPT_NOT_FOUND_LOGS: true,
                CHEATS_ENABLED: this.features.isCheatsEnabled,
                MANACOSTS_ENABLED: this.features.isManacostsEnabled,
                COOLDOWNS_ENABLED: this.features.isCooldownsEnabled,
                MINION_SPAWNS_ENABLED: this.features.isMinionsEnabled,
                CONTENT_PATH: "../../../../Content",
                DEPLOY_FOLDER: '',
                ENDGAME_HTTP_POST_ADDRESS: "",
                APIKEYDROPBOX: "",
                USERNAMEOFREPLAYMAN: "",
                PASSWORDOFREPLAYMAN: "",
                ENABLE_LAUNCHER: false,
                LAUNCHER_ADRESS_AND_PORT: "",
                AB_CLIENT: false,
                ENABLE_LOG_AND_CONSOLEWRITELINE: false,
                ENABLE_LOG_BehaviourTree: false,
                ENABLE_LOG_PKT: false,
                ENABLE_REPLAY: false,
                ENABLE_ALLOCATION_TRACKER: false,
                SCRIPT_ASSEMBLIES: [
                    "AvLua-Converted",
                    "AvCsharp-Scripts",
                ],
            },
            players: this.getPlayers().map((player, i) => ({
                playerId: player.isBot ? -1 : (i + 1),
                AIDifficulty: player.isBot ? (player.ai.value ?? 0) : undefined,
                blowfishKey, //TODO: Unhardcode. Security
                rank: /*Rank.random() ??*/ "DIAMOND",
                name: player.isBot ? `${player.champion.toString()} Bot` : (player.name.value ?? `Player ${i + 1}`),
                champion: player.champion.toString(), //TODO: Fix
                team: player.team.toString().toUpperCase(),
                skin: 0,
                summoner1: player.isBot ? `SummonerHeal` : `Summoner${player.spell1.toString()}`,
                summoner2: player.isBot ? `SummonerFlash` : `Summoner${player.spell2.toString()}`,
                ribbon: 2, // Unused
                useDoomSpells: false,
                icon: 0, //Math.floor(Math.random() * 29),
                runes,
                talents,
            }))
        }
    }
}
