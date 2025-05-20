import { input } from '@inquirer/prompts'
import { MAPS, map2str, MODES, mode2str, PLAYER_PICKABLE_PROPS as PPPs, PlayerPickableProp as PPP, PLAYER_PICKABLE_PROPS_KEYS as PPPs_KEYS } from './utils/constants'
import select from './ui/dynamic-select'
import { Peer as PBPeer } from './message/peer'
import { TypedEventEmitter, type Libp2p, type PeerId, type Stream, type StreamHandler } from '@libp2p/interface'
import { PeerMap } from '@libp2p/peer-collections'
import * as lp from 'it-length-prefixed'
import { pbStream, type MessageStream } from 'it-protobuf-stream'
import { pipe } from 'it-pipe'
import { LobbyRequestMessage, LobbyNotificationMessage } from './message/lobby'
import { logger, type Logger } from '@libp2p/logger'
import { publicKeyToProtobuf, publicKeyFromProtobuf } from '@libp2p/crypto/keys'
import { peerIdFromPublicKey } from '@libp2p/peer-id'

const LOBBY_PROTOCOL = `/lobby/${0}`
const lnmDefaults: LobbyNotificationMessage = {
    startNotification: false,
    peersRequests: [],
}
const lrmDefaults: LobbyRequestMessage = {
    pickRequests: [],
}

const TEAM_COUNT = 2
type TeamId = number //& { readonly brand: unique symbol };

type GameEvents = {
    update: void,
    kick: void,
    pick: void,
}

class GamePlayer {
    id: PeerId
    name: string = 'Unnamed'
    stream?: MessageStream<LobbyNotificationMessage, Stream>
    constructor(id: PeerId){
        this.id = id
    }

    public set team(to){ this.set(PPP.Team, to) }
    public get team(){ return this.get(PPP.Team) }
    public get champion(){ return this.get(PPP.Champion) }
    public get sspell1(){ return this.get(PPP.SummonerSpell1) }
    public get sspell2(){ return this.get(PPP.SummonerSpell2) }
    public get lock(){ return this.get(PPP.Lock) }

    props = new Map<PPP, number>()
    get(prop: PPP): number {
        return this.props.get(prop) ?? -1
    }
    set(prop: PPP, value: number): boolean {
        if(prop >= 0 && prop < PPPs_KEYS.length){
            const values = PPPs[prop]
            if(value >= 0 && value < values.length){
                this.props.set(prop, value)
                return true
            }
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
    public getPlayer(){
        return this.players.get(this.node.peerId)!
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
    public abstract pick(prop: PPP, value: number): Promise<void>

    public abstract get canStart(): boolean
    //public abstract get canKick(): boolean

    public abstract get isStarted(): boolean
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
                        const req = LobbyRequestMessage.decode(data)
                        if(req.joinRequest){
                            const player = this.players_get(peerId)!
                            player.stream = pbStream(stream).pb(LobbyNotificationMessage)
                            this.joinInternal(peerId, req.joinRequest.name)
                        }
                        //if(req.leaveRequest){
                        //    this.leaveInternal(peerId)
                        //}
                        if(req.pickRequests.length){
                            for(const r of req.pickRequests){
                                const key = r.prop - 1
                                const value = r.value - 1
                                if(key >= 0 && value >= 0)
                                    this.pickInternal(peerId, key, value)
                            }
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
            peersRequests: [{
                publicKey: publicKeyToProtobuf(player.id.publicKey!),
                leaveNotification: false,
                joinRequest: {
                    name: player.name,
                },
                pickRequests: [{
                    prop: PPP.Team + 1,
                    value: player.team + 1,
                }],
            }]
        })
        
        this.broadcast({
            to: [ player ],
            peersRequests: [...this.players.values()].map(player => ({
                publicKey: publicKeyToProtobuf(player.id.publicKey!),
                //TODO: publicKey: new UInt8Array(),
                leaveNotification: false,
                joinRequest: {
                    name: player.name,
                },
                pickRequests: [{
                    prop: PPP.Team + 1,
                    value: player.team + 1,
                }],
            }))
        })
    }

    private broadcast(msg: Partial<LobbyNotificationMessage> & { to: Iterable<GamePlayer>, ignore?: GamePlayer }){
        for(const player of msg.to){
            if(player.stream && player !== msg.ignore){
                /* await */ player.stream.write({ ...lnmDefaults, ...msg })
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
            peersRequests: [{
                publicKey: publicKeyToProtobuf(player.id.publicKey!),
                leaveNotification: true,
                pickRequests: [],
            }]
        })
    }

    private started = false
    public get isStarted(){ return this.started }
    public get canStart(){ return true }
    public async start(){
        if(!this.started){
            this.started = true
            this.safeDispatchEvent('pick')

            this.broadcast({
                to: this.players.values(),
                startNotification: true,
            })
        }
    }

    public async pick(prop: PPP, value: number){
        this.pickInternal(this.id, prop, value)
    }
    private pickInternal(id: PeerId, prop: PPP, value: number) {
        const player = this.players_get(id)!
        player.set(prop, value)
        this.safeDispatchEvent('update')

        this.broadcast({
            to: this.players.values(),
            peersRequests: [{
                publicKey: publicKeyToProtobuf(player.id.publicKey!),
                leaveNotification: false,
                pickRequests: [{
                    prop: prop + 1,
                    value: value + 1,
                }]
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
    private stream?: MessageStream<LobbyRequestMessage, Stream>
    public async join(name: string) {
        if(!this.joined){
            this.joined = true
            
            const connection = await this.node.dial(this.id)
            const stream = await connection.newStream([ LOBBY_PROTOCOL ])
            
            this.stream = pbStream(stream).pb(LobbyRequestMessage)
            await this.stream.write({ ...lrmDefaults, joinRequest: { name } })
            
            this.handleProtocol({ stream, connection })
        }
    }
    
    private handleProtocol: StreamHandler = async ({ stream /*, connection*/ }) => {
        
        //if(!connection.remotePeer.equals(this.id)) return
        
        try {
            await pipe(
                stream,
                (source) => lp.decode(source),
                async (source) => {
                    for await (const data of source) {
                        const req = LobbyNotificationMessage.decode(data)

                        if(req.startNotification){
                            this.started = true
                            this.safeDispatchEvent('pick')
                        }
                        if(req.peersRequests.length){
                            for(const r of req.peersRequests){
                                const id = r.publicKey ? peerIdFromPublicKey(publicKeyFromProtobuf(r.publicKey)) : this.node.peerId
                                if(r.joinRequest){
                                    const player = this.players_get(id)
                                    player.name = r.joinRequest.name
                                }
                                if(r.leaveNotification){
                                    this.players.delete(id)
                                }
                                for(const pr of r.pickRequests){
                                    if(pr.prop > 0 && pr.value > 0)
                                        this.players.get(id)?.set(pr.prop - 1, pr.value - 1)
                                }
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

    private started = false
    public get isStarted(){ return this.started }
    public get canStart(): boolean { return false }
    public async start() {}
    public async pick(prop: PPP, value: number) {
        await this.stream?.write({
            pickRequests: [{
                prop: prop + 1,
                value: value + 1,
            }]
        })
    }
}