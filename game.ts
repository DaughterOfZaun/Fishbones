import { input } from '@inquirer/prompts'
import { MAPS, map2str, MODES, mode2str, CHAMPIONS, SUMMONER_SPELLS, PLAYER_PICKABLE_PROPS, PLAYER_PICKABLE_PROPS_KEYS, type PlayerPickableProp, int2ppp, ppp2int } from './utils/constants'
import select from './ui/dynamic-select'
import { Peer as PBPeer } from './message/peer'
import { TypedEventEmitter, type Libp2p, type PeerId, type Stream, type StreamHandler } from '@libp2p/interface'
import { PeerMap } from '@libp2p/peer-collections'
import * as lp from 'it-length-prefixed'
import { pbStream, type MessageStream } from 'it-protobuf-stream'
import { pipe } from 'it-pipe'
import { LobbyMessage } from './message/lobby'
import { logger, type Logger } from '@libp2p/logger'
import { publicKeyToProtobuf, publicKeyFromProtobuf } from '@libp2p/crypto/keys'
import { peerIdFromPublicKey } from '@libp2p/peer-id'

const LOBBY_PROTOCOL = `/lobby/${0}`
const lmDefaults = {
    joinNotifications: [],
    switchNotifications: [],
    leaveNotifications: [],
    pickNotifications: [],
}

const TEAM_COUNT = 2
type TeamId = number //& { readonly brand: unique symbol };

type GameEvents = {
    update: void,
    kick: void,
    pick: void,
}

class GamePlayer implements Record<PlayerPickableProp, number> {
    id: PeerId
    name: string = 'Unnamed'
    stream?: MessageStream<LobbyMessage, Stream>
    
    team = 0
    champion = 0
    summonerSpell1 = 0
    summonerSpell2 = 0

    constructor(id: PeerId){
        this.id = id
    }
    set(prop: PlayerPickableProp, value: number): boolean {
        const values = (PLAYER_PICKABLE_PROPS as Record<string, string[]>)[prop]!
        if(value >= 0 && value < values.length){
            (this as unknown as Record<string, number>)[prop] = value
            return true
        }
        return false
    }
}

export abstract class Game extends TypedEventEmitter<GameEvents> {
    protected id: PeerId
    protected node: Libp2p
    protected log: Logger

    protected name: string = `Custom game`
    protected map: number = 1
    protected mode: number = 1
    protected playersMax: number = 5
    //TODO: protected features: number[] = []
    protected password: undefined|boolean|string = undefined

    protected players: PeerMap<GamePlayer> = new PeerMap<GamePlayer>()
    protected players_get(id: PeerId): GamePlayer {
        let player = this.players.get(id)
        if(!player){
            player = new GamePlayer(id)
            this.players.set(id, player)
        }
        return player
    }
    public getPlayers(){
        return [...this.players.values()]
    }

    protected constructor(node: Libp2p, id: PeerId){
        super()
        this.id = id
        this.node = node
        this.log = logger('launcher:game')
    }

    public abstract join(name: string): Promise<void>
    public abstract leave(): Promise<void>
    public abstract start(): Promise<void>
    public abstract pick(prop: PlayerPickableProp, value: number): Promise<void>

    public abstract get canStart(): boolean
    //public abstract get canKick(): boolean
}

export class LocalGame extends Game {

    public static async create(node: Libp2p){
        const game = new LocalGame(node, node.peerId)
        const opts = { clearPromptOnDone: true }
        loop: while(true){
            switch(await select({
                message: 'Select property to edit',
                choices: [
                    { value: 'name', short: 'Name', name: `Name: ${game.name}` },
                    { value: 'map', short: 'Map', name: `Map: ${map2str(game.map)}` },
                    { value: 'mode', short: 'Mode', name: `Mode: ${mode2str(game.mode)}` },
                    { value: 'players', short: 'Players', name: `Players: ${game.playersMax}v${game.playersMax}` },
                    //TODO: { value: 'features', short: 'Features', name: `Features: ${opts.features}` },
                    { value: 'password', short: 'Password', name: `Password: ${game.password}` },
                    { value: 'enter', short: 'Enter', name: 'Enter' }
                ]
            }, opts)){
                case 'name': game.name = await input({ message: 'Enter custom game name', default: game.name }, opts); break;
                case 'map': game.map = await select({ message: 'Select custom game map', choices: Object.entries(MAPS).map(([key, value]) => ({ value: Number(key), name: value })), default: game.map }, opts); break;
                case 'mode': game.mode = await select({ message: 'Select custom game mode', choices: Object.entries(MODES).map(([key, value]) => ({ value: Number(key), name: value })), default: game.mode }, opts); break;
                case 'players': game.playersMax = await select({ message: 'Select custom game players', choices: [1, 2, 3, 4, 5, 6].map(v => ({ value: v, name: `${v}v${v}` })), default: game.playersMax }, opts); break;
                //TODO: case 'features': opts.name = await input({ message: 'Enter custom game features', default: opts.name }, opts); break;
                case 'password': game.name = await input({ message: 'Enter custom game password', default: game.name }, opts); break;
                case 'enter': break loop;
            }
        }
        return game
    }

    public getData() {
        const data: PBPeer.AdditionalData = {
            name: 'Player',
            serverSettings: {
                name: 'Server',
                maps: 0,
                modes: 0,
                tickRate: 0,
                champions: []
            },
            gameInfos: [
                {
                    name: this.name,
                    map: this.map,
                    mode: this.mode,
                    players: this.players.size,
                    playersMax: this.playersMax,
                    features: 0,
                    passwordProtected: !!this.password
                }
            ],
        }
        return data
    }

    private joined = false
    public async join(name: string){
        
        this.joinInternal(this.id, name)

        if(!this.joined){
            this.joined = true
            this.node.handle(LOBBY_PROTOCOL, this.handleProtocol)
        }
    }
    private handleProtocol: StreamHandler = async ({ stream, connection }) => {
        const peerId = connection.remotePeer
        try {
            await pipe(
                stream,
                (source) => lp.decode(source),
                async (source) => {
                    for await (const data of source) {
                        const req = LobbyMessage.decode(data)
                        if(req.joinRequest){
                            const player = this.players_get(peerId)!
                            player.stream = pbStream(stream).pb(LobbyMessage)
                            this.joinInternal(peerId, req.joinRequest.name)
                        }
                        //if(req.leaveRequest){
                        //    this.leaveInternal(peerId)
                        //}
                        if(req.pickRequest){
                            const key = int2ppp(req.pickRequest.prop)
                            const value = req.pickRequest.value
                            if(key && value >= 0)
                                this.pickInternal(peerId, key, value)
                        }
                    }
                }
            )
            this.leaveInternal(peerId)
        } catch(err) {
            this.log.error(err)
        }
    }
    private joinInternal(id: PeerId, name: string){
        
        console.assert(id.publicKey !== undefined)
        
        const playerCounts = Array(TEAM_COUNT).fill(0)
        this.players.forEach(player => playerCounts[player.team]!++ )
        const minPlayers = playerCounts.reduce((a, c) => Math.min(a, c))
        const team = playerCounts.indexOf(minPlayers) as TeamId

        const player = this.players_get(id)!
        player.name = name
        player.team = team
        this.safeDispatchEvent('update')

        if(player.id.equals(this.id)) return

        this.broadcast({
            to: this.players.values(),
            ignore: player,
            joinNotifications: [{
                publicKey: publicKeyToProtobuf(player.id.publicKey!),
                name: player.name,
                team: player.team,
                addrs: [],
            }]
        })
        
        this.broadcast({
            to: [ player ],
            joinNotifications: [...this.players.values()].map(player => ({
                publicKey: publicKeyToProtobuf(player.id.publicKey!),
                name: player.name,
                team: player.team,
                addrs: [],
            }))
        })
    }

    private broadcast(msg: Partial<LobbyMessage> & { to: Iterable<GamePlayer>, ignore?: GamePlayer }){
        for(const player of msg.to){
            if(player.stream && player !== msg.ignore){
                /* await */ player.stream.write({ ...lmDefaults, ...msg })
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
    }
    private leaveInternal(id: PeerId){
        
        const player = this.players_get(id)!

        //player?.stream?.unwrap().unwrap().close()
        //    .catch(err => this.log.error(err))
        
        this.players.delete(id)
        this.safeDispatchEvent('update')
        
        this.broadcast({
            to: this.players.values(),
            leaveNotifications: [{
                publicKey: publicKeyToProtobuf(player.id.publicKey!),
            }]
        })
    }

    started = false
    public get canStart(): boolean { return true }
    public async start(){
        if(!this.started){
            this.started = true
            this.broadcast({
                to: this.players.values(),
                startNotification: {},
            })
        }
    }

    public async pick(prop: PlayerPickableProp, value: number){
        this.pickInternal(this.id, prop, value)
    }
    private pickInternal(id: PeerId, prop: PlayerPickableProp, value: number) {
        const player = this.players_get(id)!
        player.set(prop, value)
        this.safeDispatchEvent('update')

        this.broadcast({
            to: this.players.values(),
            pickNotifications: [{
                publicKey: publicKeyToProtobuf(player.id.publicKey!),
                prop: ppp2int(prop),
                value,
            }]
        })
    }
}

export class RemoteGame extends Game {

    public static async create(node: Libp2p, id: PeerId, gameInfo: PBPeer.AdditionalData.GameInfo){
        const game = new RemoteGame(node, id)
        game.name = gameInfo.name
        game.map = gameInfo.map
        game.mode = gameInfo.mode
        game.playersMax = gameInfo.playersMax
        //TODO: game.features = gameInfo.features
        game.password = gameInfo.passwordProtected
        return game
    }

    private joined = false
    private stream?: MessageStream<LobbyMessage, Stream>
    public async join(name: string) {
        if(!this.joined){
            this.joined = true

            const connection = await this.node.dial(this.id)
            const stream = await connection.newStream([ LOBBY_PROTOCOL ])

            this.stream = pbStream(stream).pb(LobbyMessage)
            await this.stream.write({ ...lmDefaults, joinRequest: { name } })

            this.handleProtocol({ stream, connection })
        }
    }

    private handleProtocol: StreamHandler = async ({ stream, connection }) => {
        
        //if(!connection.remotePeer.equals(this.id)) return
        
        try {
            await pipe(
                stream,
                (source) => lp.decode(source),
                async (source) => {
                    for await (const data of source) {
                        const req = LobbyMessage.decode(data)

                        if(req.joinNotifications.length){
                            for(const notification of req.joinNotifications){
                                const id = peerIdFromPublicKey(publicKeyFromProtobuf(notification.publicKey))
                                const player = this.players_get(id)
                                player.name = notification.name
                                player.team = notification.team
                            }
                            this.safeDispatchEvent('update')
                        }
                        if(req.leaveNotifications.length){
                            for(const notification of req.leaveNotifications){
                                const id = peerIdFromPublicKey(publicKeyFromProtobuf(notification.publicKey))
                                this.players.delete(id)
                            }
                            this.safeDispatchEvent('update')
                        }
                        if(req.pickNotifications.length){
                            for(const notification of req.pickNotifications){
                                const id = peerIdFromPublicKey(publicKeyFromProtobuf(notification.publicKey))
                                const player = this.players_get(id)
                                const key = int2ppp(notification.prop)
                                const value = notification.value
                                if(key) player.set(key, value)
                            }
                            this.safeDispatchEvent('update')
                        }
                    }
                }
            )
            this.stream = undefined
            this.players.clear()
            this.joined = false
            this.safeDispatchEvent('kick')
        } catch(err) {
            this.log.error(err)
        }
    }
    
    public async leave() {
        try {
            //await this.stream?.write({ ...lmDefaults, leaveRequest: {} })
            /*await*/ this.stream?.unwrap().unwrap().close()
                .catch(err => this.log.error(err))
            this.stream = undefined
            this.players.clear()
            this.joined = false
        } catch(err) {
            this.log.error(err)
        }
    }
}