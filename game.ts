import { input } from '@inquirer/prompts'
import { maps, map2str, modes, mode2str } from './constants'
import select from './dynamic-select'
import { Peer as PBPeer } from './peer'
import { TypedEventEmitter, type Libp2p, type PeerId, type Stream, type StreamHandler } from '@libp2p/interface'
import { PeerMap } from '@libp2p/peer-collections'
import * as lp from 'it-length-prefixed'
import { pbStream, type MessageStream } from 'it-protobuf-stream'
import { pipe } from 'it-pipe'
import { LobbyMessage } from './lobby'
import { logger, type Logger } from '@libp2p/logger'
import { publicKeyToProtobuf, publicKeyFromProtobuf } from '@libp2p/crypto/keys'
import { peerIdFromPublicKey } from '@libp2p/peer-id'

const LOBBY_PROTOCOL = `/lobby/${0}`
const lmDefaults = {
    joinNotifications: [],
    switchNotifications: [],
    leaveNotifications: [],
}

const TEAM_COUNT = 2
type TeamId = number //& { readonly brand: unique symbol };

type GameEvents = { update: void, leave: void }

class GamePlayer {
    id: PeerId
    name: string = 'Unnamed'
    team: TeamId = 0
    stream?: MessageStream<LobbyMessage, Stream>
    constructor(id: PeerId){
        this.id = id
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
}

export class LocalGame extends Game {

    public static async create(node: Libp2p){
        const opts = new LocalGame(node, node.peerId)
        loop: while(true){
            switch(await select({
                message: 'Select property to edit',
                choices: [
                    { value: 'name', short: 'Name', name: `Name: ${opts.name}` },
                    { value: 'map', short: 'Map', name: `Map: ${map2str(opts.map)}` },
                    { value: 'mode', short: 'Mode', name: `Mode: ${mode2str(opts.mode)}` },
                    { value: 'players', short: 'Players', name: `Players: ${opts.playersMax}v${opts.playersMax}` },
                    //TODO: { value: 'features', short: 'Features', name: `Features: ${opts.features}` },
                    { value: 'password', short: 'Password', name: `Password: ${opts.password}` },
                    { value: 'enter', short: 'Enter', name: 'Enter' }
                ]
            })){
                case 'name': opts.name = await input({ message: 'Enter custom game name', default: opts.name }); break;
                case 'map': opts.map = await select({ message: 'Select custom game map', choices: Object.entries(maps).map(([key, value]) => ({ value: Number(key), name: value })), default: opts.map }); break;
                case 'mode': opts.mode = await select({ message: 'Select custom game mode', choices: Object.entries(modes).map(([key, value]) => ({ value: Number(key), name: value })), default: opts.mode }); break;
                case 'players': opts.playersMax = await select({ message: 'Select custom game players', choices: [1, 2, 3, 4, 5, 6].map(v => ({ value: v, name: `${v}v${v}` })), default: opts.playersMax }); break;
                //TODO: case 'features': opts.name = await input({ message: 'Enter custom game features', default: opts.name }); break;
                case 'password': opts.name = await input({ message: 'Enter custom game password', default: opts.name }); break;
                case 'enter': break loop;
            }
        }
        return opts
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
                    players: 1,
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
        const player = this.players_get(peerId)!

        player.stream = pbStream(stream).pb(LobbyMessage)
        
        try {
            await pipe(
                stream,
                (source) => lp.decode(source),
                async (source) => {
                    for await (const data of source) {
                        const req = LobbyMessage.decode(data)
                        if(req.joinRequest) this.joinInternal(connection.remotePeer, req.joinRequest.name)
                        if(req.leaveRequest) this.leaveInternal(connection.remotePeer)
                    }
                }
            )
        } catch(err) {
            //this.log('connection ended %p', peerId)
            //this._removePeer(peerId)
            //stream.abort(err)
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
            if(player === msg.ignore) return;
            /* await */ player.stream
                ?.write({ ...lmDefaults, ...msg })
                .catch(err => this.log.error(err))
        }
    }

    public async leave(){
        this.leaveInternal(this.id)
        this.node.unhandle(LOBBY_PROTOCOL)
        this.joined = false
        for(const player of this.players.values()){
            player?.stream?.unwrap().unwrap()
                .close()
                .catch(err => this.log(err))
        }
        this.players.clear()
    }
    private leaveInternal(id: PeerId){
        
        const player = this.players_get(id)!

        player?.stream?.unwrap().unwrap()
            .close()
            .catch(err => this.log(err))
        
        this.players.delete(id)
        this.safeDispatchEvent('update')
        
        this.broadcast({
            to: this.players.values(),
            leaveNotifications: [{
                publicKey: publicKeyToProtobuf(player.id.publicKey!),
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

            this.node.handle(LOBBY_PROTOCOL, this.handleProtocol)

            const stream = await this.node.dialProtocol(this.id, LOBBY_PROTOCOL)
            this.stream = pbStream(stream).pb(LobbyMessage)
            this.stream.write({ joinRequest: { name }, ...lmDefaults})
        }
    }

    private handleProtocol: StreamHandler = async ({ stream, connection }) => {
        
        if(!connection.remotePeer.equals(this.id)) return
        
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
                                
                                //TODO: if(id === this.id) return /*async*/ this.leave()
                                
                                this.players.delete(id)
                            }
                            this.safeDispatchEvent('update')
                        }
                    }
                }
            )
        } catch(err) {
            this.log(err)
        }
    }
    
    public async leave() {
        try {
            await this.stream?.write({ leaveRequest: {}, ...lmDefaults })
            await this.stream?.unwrap().unwrap().close()
            this.node.unhandle(LOBBY_PROTOCOL)
            this.stream = undefined
            this.players.clear()
            this.joined = false
        } catch(err) {
            this.log.error(err)
        }
    }
}