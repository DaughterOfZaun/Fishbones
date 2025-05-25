import { Champion, Lock, Name, PickableValue, SummonerSpell, Team, type KeysByValue } from './utils/constants'
import { type PeerId, type Stream } from '@libp2p/interface'
import { type MessageStream } from 'it-protobuf-stream'
import { LobbyNotificationMessage, PickRequest } from './message/lobby'
import type { Game } from './game'

const pickableKeys = ["team", "champion", "spell1", "spell2", "lock"] as const
export type PlayerPickableProps = KeysByValue<GamePlayer, PickableValue>
export type PPP = PlayerPickableProps
export class GamePlayer {
    private readonly game: Game
    public readonly id: PeerId
    
    name = new Name('Player')
    stream?: MessageStream<LobbyNotificationMessage, Stream>
    
    constructor(game: Game, id: PeerId){
        this.game = game
        this.id = id
    }
    
    public readonly team = new Team() //TODO: disallow uinput & decodeInplace
    public readonly champion = new Champion(undefined, () => this.game.server.champions)
    public readonly spell1 = new SummonerSpell(undefined, () => this.game.server.spells)
    public readonly spell2 = new SummonerSpell(undefined, () => this.game.server.spells)
    public readonly lock = new Lock()

    encode(ppp?: PPP): PickRequest {
        return ppp ? ({ [ppp]: this[ppp].encode() }) : Object.fromEntries(pickableKeys.map(key => [key, this[key].encode()]))
    }
    decodeInplace(prs: PickRequest): boolean {
        return Object.entries(prs).reduce((a, [key, value]) => a && this[key as PPP].decodeInplace(+value), true)
    }
}
