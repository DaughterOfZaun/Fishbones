import type { ValueDesc } from '../utils/data/constants/values/desc'
import { BooleanValue, FloatValue, Lock, Name, Team } from '../utils/constants'
import { SummonerSpell } from '../utils/data/constants/spells'
import { Champion, Skin, AIDifficulty, Talents } from '../utils/data/constants/champions'
import { type PeerId, type Stream } from '@libp2p/interface'
import { LobbyNotificationMessage, PickRequest } from '../message/lobby'
import type { Game } from './game'
import type { WriteonlyMessageStream } from '../utils/pb-stream'

export type PlayerId = number & { readonly brand: unique symbol }

const pickableKeys = ["team", "champion", "spell1", "spell2", "lock", "difficulty", "skin", "talents", "fullyConnected"] as const
export type KeysByValue<T, V> = Exclude<{ [K in keyof T]: T[K] extends V ? K : undefined }[keyof T], undefined>
export type PPP = KeysByValue<GamePlayer, ValueDesc<unknown, unknown>>
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
    
    public readonly team = new Team()
    public readonly champion = new Champion(undefined, () => this.game.server.champions)
    public readonly spell1 = new SummonerSpell(undefined, () => this.game.server.spells)
    public readonly spell2 = new SummonerSpell(undefined, () => this.game.server.spells)
    public readonly lock = new Lock(+false)
    public readonly serverStarted = new BooleanValue(false)
    public readonly maxPingObserved = new FloatValue(0)
    public readonly difficulty = new AIDifficulty()
    public readonly skin = new Skin(0)
    public readonly talents = new Talents()
    public readonly fullyConnected = new BooleanValue(false)
    public readonly connectedTo = new Set<PlayerId>()

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
        console.log(JSON.stringify({ method: 'console.log', params: [ JSON.stringify(prs) ] }))
        return Object.entries(prs).reduce((a, [key, value]) => {
            let success = false
            if(/*pickableKeys.includes(key as PPP) &&*/ value !== undefined)
                success = this[key as PPP].decodeInplace(value as never)
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
