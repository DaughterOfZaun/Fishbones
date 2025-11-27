import { blowfishKey, FeaturesEnabled, GameType, LOCALHOST, Name, Password, PlayerCount, Team, type u } from '../utils/constants'
import { TypedEventEmitter, type AbortOptions, type PeerId, type Stream } from '@libp2p/interface'
import { publicKeyFromProtobuf, publicKeyToProtobuf } from '@libp2p/crypto/keys'
import { peerIdFromPublicKey } from '@libp2p/peer-id'
import { multiaddr } from '@multiformats/multiaddr'
import type { LibP2PNode } from '../node/node'
import { GamePlayer, type PlayerId, type PPP } from './game-player'
import type { Peer as PBPeer } from '../message/peer'
import type { Server } from './server'
import { KickReason, LobbyNotificationMessage, PickRequest, State, type LobbyRequestMessage } from '../message/lobby'
import { arr2text, text2arr } from 'uint8-util'
import type { GameInfo } from '../game/game-info'
import { ClientServerProxy, ProxyClient, ProxyServer } from '../utils/proxy/proxy'
import type { WriteonlyMessageStream } from '../utils/pb-stream'
import { launchClient, relaunchClient, stopClient } from '../utils/process/client'
import { launchServer, stopServer } from '../utils/process/server'
import { safeOptions, shutdownOptions } from '../utils/process/process'
import { logger } from '../utils/log'
import { getBotName } from '../utils/namegen/namegen'
import { GameMap } from '../utils/data/constants/maps'
import { GameMode } from '../utils/data/constants/modes'
import { runes } from '../utils/data/constants/runes'

interface GameEvents {
    update: CustomEvent,
    kick: CustomEvent,
    start: CustomEvent,
    wait: CustomEvent,
    launch: CustomEvent,
    crash: CustomEvent,
    stop: CustomEvent,
    joined: CustomEvent<GamePlayer>,
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
    
    public readonly node: LibP2PNode
    public readonly server: Server
    public readonly ownerId: PeerId
    
    public readonly name = new Name(`Game`)
    public readonly map = new GameMap(1, () => this.server.maps)
    public readonly mode = new GameMode(0, () => this.server.modes)
    public readonly type = new GameType(0)
    public readonly playersMax = new PlayerCount(5)
    public readonly password = new Password()
    public readonly features = new FeaturesEnabled()

    protected player?: GamePlayer
    public getPlayer(id?: PlayerId){
        return (id === undefined) ? this.player : this.players.get(id)
    }
    
    protected readonly players = new Map<PlayerId, GamePlayer>()
    protected players_count = 0
    protected players_add(id: PlayerId, peerId: u|PeerId): GamePlayer {
        let player = this.players.get(id)
        if(!player){
            player = new GamePlayer(this, id, peerId)
            this.players.set(id, player)
        }
        return player
    }
    public getPlayers(includeBots = true){
        const players = [...this.players.values()]
        if(includeBots) return players
        else return players.filter(player => !player.isBot)
    }
    public getPlayersCount(includeBots = false){
        if(this.joined){
            if(includeBots) return this.players.size
            else return this.getPlayers(false).length
        } else {
            return this.players_count
        }
    }

    protected constructor(node: LibP2PNode, ownerId: PeerId, server: Server){
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

        this.proxyClientServer?.stop()
        this.proxyClientServer = undefined
        
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
    private proxyClientServer?: ClientServerProxy

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
    private handleJoinRequest(player: GamePlayer, req: LobbyRequestMessage.JoinRequest){
        void this.handleJoinRequestAsync(player, req, shutdownOptions)
    }
    private async handleJoinRequestAsync(player: GamePlayer, { name }: LobbyRequestMessage.JoinRequest, opts: Required<AbortOptions>){
        
        player.name.decodeInplace(name)
        this.assignTeamTo(player)

        this.broadcast(
            {
                peersRequests: [{
                    playerId: player.id,
                    joinRequest: {
                        name: player.name.encode(),
                        info: await this.getPeerInfo(player, opts),
                    },
                    pickRequest: player.encode('team'),
                }]
            },
            this.players.values(),
            player,
        )
        
        const newPlayer = player
        this.broadcast(
            {
                peersRequests: await Promise.all(
                    [...this.players.values()].map(async player => ({
                        playerId: player.id,
                        joinRequest: {
                            name: player.name.encode(),
                            isMe: player == newPlayer,
                            info: await this.getPeerInfo(player, opts),
                        },
                        pickRequest: player.encode(),
                    }))
                )
            },
            [ player ],
        )
    }
    private async getPeerInfo(player: GamePlayer, opts: Required<AbortOptions>){
        const peerId = player.peerId
        const { peerStore } = this.node.components
        if(peerId && !peerId.equals(this.node.peerId) && this.features.isHalfPingEnabled){
            const { multiaddrs } = await peerStore.getInfo(peerId, opts)
            return {
                publicKey: publicKeyToProtobuf(peerId.publicKey!),
                addrs: multiaddrs.map(multiaddr => multiaddr.bytes),
            }
        }
        //return undefined
    }
    private handleJoinResponse(player: GamePlayer, res: LobbyNotificationMessage.JoinRequest){
        void this.handleJoinResponseAsync(player, res, shutdownOptions)
    }
    private async handleJoinResponseAsync(player: GamePlayer, res: LobbyNotificationMessage.JoinRequest, opts: Required<AbortOptions>){
        const { peerStore } = this.node.components

        player.name.decodeInplace(res.name)

        if(res.isMe){
            this.player = player
            this.joined = true
        } else if(!player.stream && player.peerId && res.info){
            const peerId = player.peerId
            const multiaddrs = res.info.addrs.map(addr => multiaddr(addr))
            await peerStore.patch(peerId, { multiaddrs }, opts)
            await this.node.dial(peerId, opts)
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
        
        if(this.features.isHalfPingEnabled) return

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

        this.broadcastLaunchRequests()
    }
    private broadcastLaunchRequests(){
        const players = this.getPlayers()
        
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

        this.proxyClientServer?.stop()
        this.proxyClientServer = undefined

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
        void this.handleSwitchStateResponseAsync(state, shutdownOptions)
    }
    private async handleSwitchStateResponseAsync(state: State, opts: Required<AbortOptions>){
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
            case State.LAUNCHED: {
                this.started = true
                this.launched = true
                this.safeDispatchEvent('wait')

                if(this.features.isHalfPingEnabled){
                    const gameInfo = this.getGameInfo()
                    try {
                        //let proc: Awaited<ReturnType<typeof launchServer>>
                        const proc = await launchServer(gameInfo, opts)
                        proc.once('exit', this.onServerExit)

                        const players = this.getPlayers()
                        const peerIds = players.filter(p => !!p.peerId).map(p => p.peerId!)
                        this.proxyClientServer = new ClientServerProxy(this.node)
                        await this.proxyClientServer.start(proc.port, peerIds, opts)

                        this.set('serverStarted', true)

                    } catch(err) {
                        logger.log('Failed to start server:', Bun.inspect(err))
                        this.onServerExit()
                    }
                }
                break
            }
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
        
        const ip = LOCALHOST
        let port = 0

        if(this.features.isHalfPingEnabled){
            await this.proxyClientServer!.connect(opts)
            port = this.proxyClientServer!.getClientPort()!
        } else {
            //TODO: try-catch
            this.proxyClient = new ProxyClient(this.node)
            await this.proxyClient.connect(this.ownerId, this.proxyServer, opts)
            port = this.proxyClient.getPort()!
        }

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

    public set<T extends PPP>(prop: T, value: GamePlayer[T]['value']){
        const player = this.getPlayer()
        if(!player) return false
        
        //if(value !== undefined)
        player[prop].value = value
        
        return this.stream_write({
            pickRequest: player.encode(prop)
        })
    }
    private handlePickRequest(player: GamePlayer, req: PickRequest){

        if(this.launched){
            filterObject(req, true, [ 'serverStarted' ])
        } else if(this.started){
            filterObject(req, true, [ 'lock', 'champion', 'spell1', 'spell2', 'skin', 'talents' ])
        } else if(this.joined){
            filterObject(req, true, [ 'team' ])
        }

        if(this.started && req.lock !== undefined){
            player.lock.value = +true
            
            const players = this.getPlayers()
            if(players.every(p => p.isBot || !!p.lock.value)){
                for(const player of players)
                    player.fillUnset()
                this.launch()
                return
            }
        }

        if(this.launched && req.serverStarted){
            player.serverStarted.value = true

            const players = this.getPlayers()
            if(players.every(p => p.isBot || !!p.serverStarted.value)){
                this.broadcastLaunchRequests()
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

        function filterObject<T extends Record<string, unknown>>(obj: T, allowed: boolean, keys: (keyof T)[]): number {
            let keysAccepted = 0
            for(const key of Object.keys(obj)){
                if(keys.includes(key) === allowed) keysAccepted++
                else delete obj[key]
            }
            return keysAccepted
        }
    }
    private handlePickResponse(player: GamePlayer, res: PickRequest){
        player.decodeInplace(res)
    }

    private unlockAllPlayers(){
        const remainingPlayers = this.players.values()
        for(const player of remainingPlayers){
            player.serverStarted.value = false
            player.lock.value = +false
        }
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
            //ret &&= this.type.decodeInplace(gi.type)
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
            let joinedSelf = false
            const joinedPlayers = []
            for(const res of ress.peersRequests){
                let player: u|GamePlayer
                const playerId = res.playerId as PlayerId
                if(res.joinRequest){
                    let peerId: PeerId | undefined
                    if(res.joinRequest.info){
                        const publicKey = publicKeyFromProtobuf(res.joinRequest.info.publicKey)
                        peerId = peerIdFromPublicKey(publicKey)
                    }
                    player = this.players_add(playerId, peerId)
                    this.handleJoinResponse(player, res.joinRequest)
                    joinedSelf ||= !!res.joinRequest.isMe
                    joinedPlayers.push(player)
                }
                if(res.pickRequest && (player = this.players.get(playerId))){
                    this.handlePickResponse(player, res.pickRequest)
                }
                if(res.leaveRequest && (player = this.players.get(playerId))){
                    this.handleLeaveResponse(player)
                }
            }
            this.safeDispatchEvent('update')
            if(!joinedSelf){
                for(const player of joinedPlayers){
                    if(!player.isBot)
                        this.safeDispatchEvent('joined', { detail: player })
                }
            }
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
                AIDifficulty: player.isBot ? (player.difficulty.value ?? 0) : undefined,
                blowfishKey, //TODO: Unhardcode. Security
                rank: /*Rank.random() ??*/ "DIAMOND",
                name: player.isBot ? getBotName(player.champion.toString()) : (player.name.value ?? `Player ${i + 1}`),
                champion: player.champion.toString(), //TODO: Fix
                team: player.team.toString().toUpperCase(),
                skin: player.skin.value ?? 0,
                summoner1:
                    player.isBot ? `SummonerHeal` :
                    (player.spell1.value !== undefined) ? `Summoner${player.spell1.toString()}` :
                    '',
                summoner2:
                    player.isBot ? `SummonerFlash` :
                    (player.spell1.value !== undefined) ? `Summoner${player.spell2.toString()}` :
                    '',
                ribbon: 2, // Unused
                useDoomSpells: false,
                icon: 0, //Math.floor(Math.random() * 29),
                talents: Object.fromEntries(player.talents.value.entries()),
                runes,
            }))
        }
    }
}
