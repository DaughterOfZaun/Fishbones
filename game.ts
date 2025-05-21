import { Map as GameMap, Mode as GameMode, Name, Password, PlayerCount } from './utils/constants'
import { TypedEventEmitter, type Libp2p, type PeerId } from '@libp2p/interface'
import { PeerMap } from '@libp2p/peer-collections'
import { logger, type Logger } from '@libp2p/logger'
import { GamePlayer } from './game-player'
import type { PickRequest } from './message/lobby'
import type { Peer as PBPeer } from './message/peer'

type GameEvents = {
    update: void,
    kick: void,
    pick: void,
}

export abstract class Game extends TypedEventEmitter<GameEvents> {
    protected id: PeerId
    protected node: Libp2p
    protected log: Logger

    public name = new Name(`Custom game`)
    public map = new GameMap(1)
    public mode = new GameMode(0)
    public playersMax = new PlayerCount(5)
    public password = new Password()

    protected players: PeerMap<GamePlayer> = new PeerMap<GamePlayer>()
    protected players_size: number = 0
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
        return this.players.get(this.node.peerId)
    }
    public getPlayersCount(){
        return this.joined ? this.players.size : this.players_size
    }

    protected constructor(node: Libp2p, id: PeerId){
        super()
        this.id = id
        this.node = node
        this.log = logger('launcher:game')
    }

    protected joined = false
    public abstract join(name: string): Promise<boolean>
    public abstract leave(): Promise<boolean>
    public abstract start(): Promise<boolean>
    public abstract pick(pr: PickRequest): Promise<boolean>

    public abstract get canStart(): boolean
    //public abstract get canKick(): boolean

    protected started = false
    public get isStarted(){ return this.started }

    public encode() {
        return {
            name: this.name.encode(),
            map: this.map.encode(),
            mode: this.mode.encode(),
            players: this.players.size,
            playersMax: this.playersMax.encode(),
            features: 0,
            passwordProtected: this.password.isSet(),
        }
    }

    public decode(gi: PBPeer.AdditionalData.GameInfo): boolean {
        let ret = true
            ret &&= this.name.decodeInplace(gi.name)
            ret &&= this.map.decodeInplace(gi.map)
            ret &&= this.mode.decodeInplace(gi.mode)
            this.players_size = gi.players
            ret &&= this.playersMax.decodeInplace(gi.playersMax)
        this.password.value = gi.passwordProtected ? '' : undefined
        return ret
    }
}
