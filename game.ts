import { GameMap as GameMap, GameMode as GameMode, Name, Password, PlayerCount } from './utils/constants'
import { TypedEventEmitter, type Libp2p, type PeerId } from '@libp2p/interface'
import { PeerMap } from '@libp2p/peer-collections'
import { GamePlayer } from './game-player'
import type { PickRequest } from './message/lobby'
import type { Peer as PBPeer } from './message/peer'
import type { Server } from './server'

type GameEvents = {
    update: void,
    kick: void,
    pick: void,
}

export abstract class Game extends TypedEventEmitter<GameEvents> {
    
    protected readonly node: Libp2p
    public readonly server: Server
    public readonly id: PeerId
    
    public readonly name = new Name(`Custom Game`)
    public readonly map = new GameMap(1, () => this.server.maps)
    public readonly mode = new GameMode(0, () => this.server.modes)
    public readonly playersMax = new PlayerCount(5)
    public readonly password = new Password()

    protected players: PeerMap<GamePlayer> = new PeerMap<GamePlayer>()
    protected players_size: number = 0
    protected players_add(id: PeerId): GamePlayer {
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
    public getPlayer(){
        return this.players.get(this.node.peerId)
    }
    public getPlayersCount(){
        return this.joined ? this.players.size : this.players_size
    }

    protected constructor(node: Libp2p, server: Server){
        super()
        this.node = node
        this.server = server
        this.id = node.peerId
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
            this.players_size = gi.players
            ret &&= this.playersMax.decodeInplace(gi.playersMax)
        this.password.value = gi.passwordProtected ? '' : undefined
        return ret
    }
}
