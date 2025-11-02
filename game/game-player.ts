import { AIDifficulty, Champion, Lock, Name, PickableValue, SummonerSpell, Team, type KeysByValue } from '../utils/constants'
import { type PeerId, type Stream } from '@libp2p/interface'
import { LobbyNotificationMessage, PickRequest } from '../message/lobby'
import type { Game } from './game'
import type { WriteonlyMessageStream } from '../utils/pb-stream'

export type PlayerId = number & { readonly brand: unique symbol }

const pickableKeys = ["team", "champion", "spell1", "spell2", "lock", "difficulty"] as const
export type PlayerPickableProps = KeysByValue<GamePlayer, PickableValue>
export type PPP = PlayerPickableProps
export class GamePlayer {
    private readonly game: Game
    public readonly id: PlayerId
    public readonly peerId?: PeerId
    
    public readonly name = new Name('Player')

    stream?: WriteonlyMessageStream<LobbyNotificationMessage, Stream>
    
    constructor(game: Game, id: PlayerId, peerId?: PeerId){
        this.game = game
        this.id = id
        this.peerId = peerId
    }
    
    public readonly team = new Team() //TODO: disallow uinput & decodeInplace
    public readonly champion = new Champion(undefined, () => this.game.server.champions)
    public readonly spell1 = new SummonerSpell(undefined, () => this.game.server.spells)
    public readonly spell2 = new SummonerSpell(undefined, () => this.game.server.spells)
    public readonly lock = new Lock() //TODO: Hide in test
    public readonly difficulty = new AIDifficulty()

    public get isBot(){ return this.difficulty.value !== undefined }

    public encode(ppp?: PPP): PickRequest {
        return ppp ? ({ [ppp]: this[ppp].encode() }) :
            Object.fromEntries(
                pickableKeys
                .filter(key => this[key].value !== undefined)
                .map(key => [key, this[key].encode()])
            )
    }
    public decodeInplace(prs: PickRequest): boolean {
        return Object.entries(prs).reduce((a, [key, value]) => {
            let success = false
            if(/*pickableKeys.includes(key as PPP) &&*/ value !== undefined)
                success = this[key as PPP].decodeInplace(value)
            return a && success
        }, true)
    }

    public fillUnset(){
        for(const prop of ['champion', 'spell1', 'spell2'] as const){
            if(this[prop].value === undefined)
                this[prop].setRandom()
        }
    }
}
