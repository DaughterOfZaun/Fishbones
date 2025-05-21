import { Champion, Lock, Name, PickableValue, SummonerSpell, Team, type u } from './utils/constants'
import { type PeerId, type Stream } from '@libp2p/interface'
import { type MessageStream } from 'it-protobuf-stream'
import { LobbyNotificationMessage, PickRequest } from './message/lobby'

type KeysByValue<T, V> = Exclude<{ [K in keyof T]: T[K] extends V ? K : u }[keyof T], u>
const pickableKeys = ["team", "champion", "spell1", "spell2", "lock"] as const
export type PlayerPickableProps = KeysByValue<GamePlayer, PickableValue>
export type PPP = PlayerPickableProps
export class GamePlayer {
    id: PeerId
    name = new Name('Player')
    stream?: MessageStream<LobbyNotificationMessage, Stream>
    constructor(id: PeerId){
        this.id = id
    }

    team = new Team()
    champion = new Champion()
    spell1 = new SummonerSpell()
    spell2 = new SummonerSpell()
    lock = new Lock()

    encode(ppp: PPP): PickRequest {
        return { prop: pickableKeys.indexOf(ppp), value: this[ppp].encode() }
    }
    encodeAll(): PickRequest[] {
        //const keys = Object.entries(this).filter(([k, v]) => v instanceof PickableValue).map(([k, v]) => k)
        return pickableKeys.map((key, i) => ({ prop: i, value: this[key].encode() }))
    }
    decodeInplace(pr: PickRequest): boolean {
        return pr.prop >= 0
            && pr.prop < pickableKeys.length
            && this[pickableKeys[pr.prop]!].decodeInplace(pr.value)
    }
    decodeAllInplace(prs: PickRequest[]): boolean {
        return prs.reduce((a, pr) => a && this.decodeInplace(pr), true)
    }
}
