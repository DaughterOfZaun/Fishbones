import { input, checkbox, select, type Choice } from "../ui/remote/remote"
import type { AbortOptions } from "@libp2p/interface"
type CheckboxChoice<T> = Extract<Parameters<typeof checkbox<T>>[0]['choices'][number], { value: T }>

export type u = undefined

export const LOBBY_PROTOCOL = `/lobby/${0}`
export const PROXY_PROTOCOL = `/proxy/${0}`
export const LOCALHOST = '127.0.0.1'

export abstract class ValueDesc<I, E> {
    public name!: string
    public desc?: string
    public value?: I
    abstract encode(): E
    abstract decodeInplace(v: E): boolean
    abstract uinput(opts: Required<AbortOptions>): Promise<unknown>
    abstract toString(): string
}

//type OmitFirst<T extends unknown[]> = T extends [unknown, ...infer R] ? R : never
//type PickableValueConstructorArgs = OmitFirst<ConstructorParameters<typeof PickableValue>>
//type PickableValueConstructor = new (...args: ConstructorParameters<typeof PickableValue>) => PickableValue
interface PickableValueStatics { name: string, values: Record<number, string>, choices: Choice<number>[] }
export class PickableValue extends ValueDesc<number, number> {
    public value?: number
    public readonly name: string
    private readonly values: Record<number, string>
    private readonly choices: Choice<number>[]
    private readonly enabledGetter?: () => Enabled
    //private readonly enabled?: Enabled
    constructor(value?: number, enabledGetter?: () => Enabled){
    //constructor(value?: number, enabled?: Enabled){
        super()
        const statics = this.constructor as unknown as PickableValueStatics
        this.name = statics.name
        this.values = statics.values
        this.choices = statics.choices
        this.value = value
        this.enabledGetter = enabledGetter
        //this.enabled = enabled
    }
    //public encode(){ return (this.value ?? -1) + 1 }
    //public encode(){ return this.value ?? 0 }
    public encode(){ return this.value! }
    public decodeInplace(from: number): boolean {
        if(from === undefined) return false
        //from--
        if(from in this.values){
            this.value = from
            return true
        }
        return false
    }
    public async uinput(opts: Required<AbortOptions>) {
        const enabled = this.enabledGetter?.call(null)
        //const enabled = this.enabled
        if(enabled) for(const choice of this.choices){
            choice.disabled = !enabled.value.includes(choice.value)
        }
        try {
            this.value = await select({
                message: `Select ${this.name}`,
                choices: this.choices,
                pageSize: 20,
            }, {
                clearPromptOnDone: true,
                signal: opts.signal,
            })
        } finally {
            if(enabled) for(const choice of this.choices){
                choice.disabled = false
            }
        }
    }
    public get [Symbol.toStringTag]() {
        throw new Error("An attempt to output an object without first converting it to a string")
        //return this.toString()
    }
    public toString(): string {
        return (this.value != undefined) ? this.values[this.value]! : 'undefined'
    }
    public static normalize(values: Record<number, string>)/*: Choice<number>[]*/{
        return Object.entries(values).map(([k, v]) => ({ value: Number(k), name: v }))
    }
    public setRandom(){
        let enabled = this.enabledGetter?.call(null).value.filter(v => v in this.values)
            enabled ??= Object.keys(this.values).map(k => parseInt(k))
        if(enabled.length > 0)
            this.value = enabled[Math.floor(Math.random() * enabled.length)]
        else
            this.value = undefined
    }
}

// short, name, enabled by default
const mapsTable: [number, string, boolean][] = [
    [0, `Test`, false],
    [1, `Old Summoner's Rift`, true],
    [2, `Old Summoner's Rift Autumn`, true],
    [3, `Proving Grounds`, false],
    [4, `Twisted Treeline`, true],
    //[5, `Unknown`, false],
    [6, `Summoner's Rift Winter (2011)`, false],
    [7, `Summoner's Rift Winter (2009)`, false],
    [8, `Crystal Scar`, true],
    [9, `Dominion Test`, true],
    [10, `New Twisted Treeline`, false],
    [11, `New Summoner's Rift`, false],
    [12, `Howling Abyss`, false],
    [13, `Magma Chamber`, false],
    [14, `Butcher's Bridge`, false],
    //[15, `Unknown`, false],
    [16, `Cosmic Ruins`, false],
    //[17, `Unknown`, false],
    [18, `Valoran City Park`, false],
    [19, `Substructure 43`, false],
    [20, `Crash Site`, false],
    [21, `Temple of Lily and Lotus`, false],
    [30, `Arena: Rings of Wrath`, false],
    [35, `The Bandlewood`, false],
]
export const maps = mapsTable.map(([i, name, enabled]) => {
    return { i, name, enabled }
})
export class GameMap extends PickableValue {
    public static readonly name = 'Game Map'
    public static readonly values = Object.fromEntries(maps.map(({ i, name }) => ([i, name])))
    public static readonly choices = PickableValue.normalize(GameMap.values)
}

// short, name, enabled by default
const modesTable: [string, string, boolean][] = [
    ['CLASSIC', 'Classic', true],
    ['ARAM', 'ARAM', true],
    ['ODIN', 'ODIN', true],
]
export const modes = modesTable.map(([ short, name, enabled ], i) => ({ i, short, name, enabled }))
export class GameMode extends PickableValue {
    public static readonly name = 'Game Mode'
    public static readonly values = modes.map(({ short }) => short)
    public static readonly choices = modes.map(({ i, short, name }) => ({ value: i, short, name }))
}

export class GameType extends PickableValue {
    public static readonly choices = [
        { value: 0, name: 'Blind Pick' },
        //{ value: 1, name: 'Draft Pick' },
        //{ value: 2, name: 'All Random' },
    ]
}

type InternalName = string
type ExternalName = string
type MainlineStatus = 'Working' | 'Playable' | 'Buggy' | 'Unimplemented' | 'Non-existent'
type HasBehaviourTree = boolean
export const championsTable: [InternalName, ExternalName, MainlineStatus, HasBehaviourTree ][] = [
    ["Alistar", "Alistar", "Working", true],
    ["Annie", "Annie", "Working", true],
    ["Ashe", "Ashe", "Playable", true],
    ["FiddleSticks", "Fiddlesticks", "Working", true],
    ["Jax", "Jax", "Working", true],
    ["Kayle", "Kayle", "Working", true],
    ["MasterYi", "Master Yi", "Playable", true],
    ["Morgana", "Morgana", "Working", true],
    ["Nunu", "Nunu & Willump", "Working", true],
    ["Ryze", "Ryze", "Working", true],
    ["Sion", "Sion", "Working", true],
    ["Sivir", "Sivir", "Working", true],
    ["Soraka", "Soraka", "Working", true],
    ["Teemo", "Teemo", "Playable", false],
    ["Tristana", "Tristana", "Working", true],
    ["TwistedFate", "Twisted Fate", "Playable", false],
    ["Warwick", "Warwick", "Working", true],
    ["Singed", "Singed", "Working", false],
    ["Zilean", "Zilean", "Working", true],
    ["Evelynn", "Evelynn", "Playable", false],
    ["Tryndamere", "Tryndamere", "Working", false],
    ["Twitch", "Twitch", "Playable", false],
    ["Karthus", "Karthus", "Playable", true],
    ["Amumu", "Amumu", "Working", true],
    ["Chogath", "Cho'Gath", "Buggy", true],
    ["Anivia", "Anivia", "Playable", false],
    ["Rammus", "Rammus", "Playable", true],
    ["Veigar", "Veigar", "Playable", false],
    ["Kassadin", "Kassadin", "Working", false],
    ["Gangplank", "Gangplank", "Working", false],
    ["Taric", "Taric", "Working", true],
    ["Blitzcrank", "Blitzcrank", "Working", true],
    ["DrMundo", "Dr. Mundo", "Playable", true],
    ["Janna", "Janna", "Working", false],
    ["Malphite", "Malphite", "Playable", true],
    ["Corki", "Corki", "Working", false],
    ["Katarina", "Katarina", "Buggy", false],
    ["Nasus", "Nasus", "Playable", true],
    ["Heimerdinger", "Heimerdinger", "Playable", false],
    ["Shaco", "Shaco", "Buggy", false],
    ["Udyr", "Udyr", "Working", true],
    ["Nidalee", "Nidalee", "Playable", true],
    ["Poppy", "Poppy", "Buggy", false],
    ["Gragas", "Gragas", "Playable", false],
    ["Pantheon", "Pantheon", "Playable", false],
    ["Mordekaiser", "Mordekaiser", "Working", false],
    ["Ezreal", "Ezreal", "Working", true],
    ["Shen", "Shen", "Working", true],
    ["Kennen", "Kennen", "Working", false],
    ["Garen", "Garen", "Working", true],
    ["Akali", "Akali", "Working", false],
    ["Malzahar", "Malzahar", "Working", true],
    ["Olaf", "Olaf", "Playable", false],
    ["KogMaw", "Kog'Maw", "Working", true],
    ["XinZhao", "Xin Zhao", "Working", true],
    ["Vladimir", "Vladimir", "Working", true],
    ["Galio", "Galio", "Working", true],
    ["Urgot", "Urgot", "Playable", false],
    ["MissFortune", "Miss Fortune", "Working", true],
    ["Sona", "Sona", "Working", true],
    ["Swain", "Swain", "Working", true],
    ["Lux", "Lux", "Working", true],
    ["Leblanc", "LeBlanc", "Buggy", false],
    ["Irelia", "Irelia", "Working", true],
    ["Trundle", "Trundle", "Working", true],
    ["Cassiopeia", "Cassiopeia", "Working", true],
    ["Caitlyn", "Caitlyn", "Working", true],
    ["Renekton", "Renekton", "Working", true],
    ["Karma", "Karma", "Working", false],
    ["Maokai", "Maokai", "Working", true],
    ["JarvanIV", "Jarvan IV", "Playable", false],
    ["Nocturne", "Nocturne", "Playable", false],
    ["LeeSin", "Lee Sin", "Playable", false],
    ["Brand", "Brand", "Working", true],
    ["Rumble", "Rumble", "Playable", false],
    ["Vayne", "Vayne", "Playable", false],
    ["Orianna", "Orianna", "Buggy", false],
    ["Yorick", "Yorick", "Working", true],
    ["Leona", "Leona", "Working", true],
    ["MonkeyKing", "Wukong", "Buggy", true],
    ["Skarner", "Skarner", "Playable", false],
    ["Talon", "Talon", "Working", false],
    ["Riven", "Riven", "Buggy", false],
    ["Xerath", "Xerath", "Playable", false],
    ["Graves", "Graves", "Unimplemented", true],
    ["Shyvana", "Shyvana", "Unimplemented", true],
    ["Fizz", "Fizz", "Unimplemented", false],
    ["Volibear", "Volibear", "Unimplemented", false],
    ["Ahri", "Ahri", "Unimplemented", false],
    ["Viktor", "Viktor", "Unimplemented", false],
    ["Sejuani", "Sejuani", "Unimplemented", false],
]

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const nextChampionsTable = [
    ["Ziggs", "Ziggs", "Non-existent", true],
    ["Nautilus", "Nautilus", "Non-existent", false],
    ["Fiora", "Fiora", "Non-existent", false],
    ["Lulu", "Lulu", "Non-existent", false],
    ["Hecarim", "Hecarim", "Non-existent", false],
    ["Varus", "Varus", "Non-existent", false],
    ["Darius", "Darius", "Non-existent", false],
    ["Draven", "Draven", "Non-existent", false],
    ["Jayce", "Jayce", "Non-existent", false],
    ["Zyra", "Zyra", "Non-existent", false],
    ["Diana", "Diana", "Non-existent", false],
    ["Rengar", "Rengar", "Non-existent", false],
    ["Syndra", "Syndra", "Non-existent", false],
    ["Khazix", "Kha'Zix", "Non-existent", false],
    ["Elise", "Elise", "Non-existent", false],
    ["Zed", "Zed", "Non-existent", false],
    ["Nami", "Nami", "Non-existent", false],
    ["Vi", "Vi", "Non-existent", false],
    ["Thresh", "Thresh", "Non-existent", false],
    ["Quinn", "Quinn", "Non-existent", false],
    ["Zac", "Zac", "Non-existent", false],
    ["Lissandra", "Lissandra", "Non-existent", false],
    ["Aatrox", "Aatrox", "Non-existent", false],
    ["Lucian", "Lucian", "Non-existent", false],
    ["Jinx", "Jinx", "Non-existent", false],
    ["Yasuo", "Yasuo", "Non-existent", false],
    ["Velkoz", "Vel'Koz", "Non-existent", false],
    ["Braum", "Braum", "Non-existent", false],
    ["Gnar", "Gnar", "Non-existent", false],
    ["Azir", "Azir", "Non-existent", false],
    ["Kalista", "Kalista", "Non-existent", false],
    ["RekSai", "Rek'Sai", "Non-existent", false],
    ["Bard", "Bard", "Non-existent", false],
    ["Ekko", "Ekko", "Non-existent", false],
    ["TahmKench", "Tahm Kench", "Non-existent", false],
    ["Kindred", "Kindred", "Non-existent", false],
    ["Illaoi", "Illaoi", "Non-existent", false],
    ["Jhin", "Jhin", "Non-existent", false],
    ["AurelionSol", "Aurelion Sol", "Non-existent", false],
    ["Taliyah", "Taliyah", "Non-existent", false],
    ["Kled", "Kled", "Non-existent", false],
    ["Ivern", "Ivern", "Non-existent", false],
    ["Camille", "Camille", "Non-existent", false],
    ["Rakan", "Rakan", "Non-existent", false],
    ["Xayah", "Xayah", "Non-existent", false],
    ["Kayn", "Kayn", "Non-existent", false],
    ["Ornn", "Ornn", "Non-existent", false],
    ["Zoe", "Zoe", "Non-existent", false],
    ["KaiSa", "Kai'Sa", "Non-existent", false],
    ["Pyke", "Pyke", "Non-existent", false],
    ["Neeko", "Neeko", "Non-existent", false],
    ["Sylas", "Sylas", "Non-existent", false],
    ["Yuumi", "Yuumi", "Non-existent", false],
    ["Qiyana", "Qiyana", "Non-existent", false],
    ["Senna", "Senna", "Non-existent", false],
    ["Aphelios", "Aphelios", "Non-existent", false],
    ["Sett", "Sett", "Non-existent", false],
    ["Lillia", "Lillia", "Non-existent", false],
    ["Yone", "Yone", "Non-existent", false],
    ["Samira", "Samira", "Non-existent", false],
    ["Seraphine", "Seraphine", "Non-existent", false],
    ["Rell", "Rell", "Non-existent", false],
    ["Viego", "Viego", "Non-existent", false],
    ["Gwen", "Gwen", "Non-existent", false],
    ["Akshan", "Akshan", "Non-existent", false],
    ["Vex", "Vex", "Non-existent", false],
    ["Zeri", "Zeri", "Non-existent", false],
    ["RenataGlasc", "Renata Glasc", "Non-existent", false],
    ["BelVeth", "Bel'Veth", "Non-existent", false],
    ["Nilah", "Nilah", "Non-existent", false],
    ["KSante", "K'Sante", "Non-existent", false],
    ["Milio", "Milio", "Non-existent", false],
    ["Naafiri", "Naafiri", "Non-existent", false],
    ["Briar", "Briar", "Non-existent", false],
    ["Hwei", "Hwei", "Non-existent", false],
    ["Smolder", "Smolder", "Non-existent", false],
    ["Aurora", "Aurora", "Non-existent", false],
    ["Ambessa", "Ambessa", "Non-existent", false],
    ["Mel", "Mel", "Non-existent", false],
]

export const champions = championsTable
    .map(([short, name, status, hasBT], i) => {
        return { i, short, name, status, hasBT, enabled: status === 'Working' }
    })

export class Champion extends PickableValue {
    public static readonly name = 'Champion'
    public static readonly values = champions.map(({ short }) => short)
    public static readonly choices = champions.map(({ short, name }, i) => ({ value: i, short, name }))
}

// short, name, enabled by default
const spellsTable: [string, string, boolean][] = [
    ["", "Heal", true],
    ["", "Ghost", false],
    ["", "Barrier", false],
    ["", "Exhaust", true],
    ["", "Mark", false],
    ["", "Dash", false],
    ["", "Clarity", false],
    ["", "Flash", true],
    ["", "Teleport", true],
    ["", "Smite", true],
    ["", "Cleanse", false],
    ["", "Ignite", false],
    ["", "BattleCry", true],
    ["", "Boost", true],
    ["", "Clairvoyance", true],
    ["", "Dot", true],
    ["", "Fortify", true],
    ["", "Haste", true],
    ["", "Mana", true],
    ["", "Rally", true],
    ["", "Revive", true],
    ["", "Promote", false],
    //["", "OdinPromote", false],
    //["", "OdinSabotage", false],
    //["", "OdinGarrison", true],
    //["", "PromoteSR", true],
]
export const spells = spellsTable.map(([ , name, enabled ], i) => ({ i, name, enabled }))
export class SummonerSpell extends PickableValue {
    public static readonly name = 'Summoner Spell'
    public static readonly values = spells.map(({ name }) => name)
    public static readonly choices = PickableValue.normalize(SummonerSpell.values)
}

export class Team extends PickableValue {
    public static readonly name = 'Team'
    public  static values = [
        "Blue", "Purple", "Neutral",
    ]
    public static readonly count = 2
    public static readonly choices = PickableValue.normalize(Team.values)

    static colors = [ 'blueBright', 'redBright', 'greenBright', 'yellowBright', 'magentaBright', 'cyanBright', 'white' ] as const
    public color(): (typeof Team.colors)[number] | 'gray' {
        return (this.value != undefined) ? Team.colors[this.value] ?? 'white' : 'gray'
    }

    public get index(){ return this.value ?? -1 }
}

export class Lock extends PickableValue {
    public static readonly name = 'Lock'
    public static readonly values = [ "Unlocked", "Locked" ]
    public static readonly choices = PickableValue.normalize(Lock.values)
}

export class PlayerCount extends PickableValue {
    public static readonly name = 'Player Count'
    //public static values = Array(6).fill(0).map((v, i) => `${i + 1}v${i + 1}`)
    public static values = Object.fromEntries(Array(6).fill(0).map((v, i) => [ ++i, `${i}v${i}`]))
    public static readonly choices = PickableValue.normalize(PlayerCount.values)
}

export class TickRate extends PickableValue {
    public static readonly name = 'Tick Rate'
    //public static values = [15, 30, 60, 120].map(v => `${v} fps`)
    public static values = Object.fromEntries([15, 30, 60, 120].map(v => [ v, `${v} fps`]))
    public static readonly choices = PickableValue.normalize(TickRate.values)
}

export function sanitize_str(v: string){
    return v.replace(/\W/g, '').slice(0, 16)
}

export class InputableValue extends ValueDesc<string, string> {
    public value?: string
    public readonly name: string
    constructor(name: string, value?: string){
        super()
        this.name = name
        this.value = value
    }
    public encode(): string {
        return this.value ?? ''
    }
    public decodeInplace(v: string): boolean {
        this.value = sanitize_str(v)
        return true
    }
    public async uinput(opts: Required<AbortOptions>) {
        this.value = await input({
            message: `Enter ${this.name}`,
            //transformer: (v, /*{ isFinal }*/) => sanitize_str(v),
            validate: v => v == sanitize_str(v),
            default: this.value,
        }, {
            clearPromptOnDone: true,
            signal: opts.signal,
        })
    }
    public get [Symbol.toStringTag]() {
        throw new Error("An attempt to output an object without first converting it to a string")
        //return this.toString()
    }
    public toString(): string {
        return this.value?.replace(/./g, '*') ?? 'undefined'
    }
}

export class Password extends InputableValue {
    public static readonly name = 'Password'
    public constructor(){ super(Password.name) }
    public toString(): string {
        return this.value?.replace(/./g, '*') ?? 'undefined'
    }
    public get isSet(){ return this.value != undefined && this.value != '' }
}

export class Name extends InputableValue {
    public static readonly name = 'Name'
    public constructor(value: string){ super(Name.name, value) }
    public toString(): string {
        return this.value ?? 'undefined'
    }
}

export class Enabled extends ValueDesc<number[], number[]>{
    public value: number[] = []
    public readonly name: string
    private readonly values: Record<number, string>
    private readonly choices: CheckboxChoice<number>[]
    constructor(){
        super()
        const statics = this.constructor as unknown as PickableValueStatics
        this.name = statics.name
        this.values = statics.values
        this.choices = statics.choices
    }
    encode(): number[] {
        return this.value
    }
    decodeInplace(v: number[]): boolean {
        this.value = v.filter(v => v in this.values)
        return true
    }
    async uinput(opts: Required<AbortOptions>) {
        
        for(const choice of this.choices)
            choice.checked = this.value.includes(choice.value)

        this.value = await checkbox({
            message: `Check ${this.name}`,
            choices: this.choices,
            pageSize: 20,
        }, {
            clearPromptOnDone: true,
            signal: opts.signal,
        })
    }
    public get [Symbol.toStringTag]() {
        throw new Error("An attempt to output an object without first converting it to a string")
        //return this.toString()
    }
    toString(): string {
        return `${this.value.length} of ${this.choices.length} checked`
    }
    public set(num: number, enabled: boolean){
        const i = this.value.indexOf(num)
        if(enabled && i === -1)
            this.value.push(num)
        if(!enabled && i !== -1)
            this.value.splice(i, 1)
    }
    public get(num: number){
        return this.value.includes(num)
    }
}

export const GameMapsEnabled = enabled(GameMap)
export const GameModesEnabled = enabled(GameMode)
export const ChampionsEnabled = enabled(Champion)
export const SummonerSpellsEnabled = enabled(SummonerSpell)

export function enabled(wrapped: PickableValueStatics){
    return class EnabledSubclass extends Enabled {
        public static readonly name = `${wrapped.name}s Enabled`
        public static readonly values = wrapped.values
        public static readonly choices: CheckboxChoice<number>[] = wrapped.choices
    }
}

export type KeysByValue<T, V> = Exclude<{ [K in keyof T]: T[K] extends V ? K : u }[keyof T], u>

export const runes = {
    "1": 5245,
    "2": 5245,
    "3": 5245,
    "4": 5245,
    "5": 5245,
    "6": 5245,
    "7": 5245,
    "8": 5245,
    "9": 5245,
    "10": 5317,
    "11": 5317,
    "12": 5317,
    "13": 5317,
    "14": 5317,
    "15": 5317,
    "16": 5317,
    "17": 5317,
    "18": 5317,
    "19": 5289,
    "20": 5289,
    "21": 5289,
    "22": 5289,
    "23": 5289,
    "24": 5289,
    "25": 5289,
    "26": 5289,
    "27": 5289,
    "28": 5335,
    "29": 5335,
    "30": 5335
}

export const talents420 = {
    "4111": 1,
    "4112": 3,
    "4114": 1,
    "4122": 3,
    "4124": 1,
    "4132": 1,
    "4134": 3,
    "4142": 3,
    "4151": 1,
    "4152": 3,
    "4162": 1,
    "4211": 2,
    "4213": 2,
    "4221": 1,
    "4222": 3,
    "4232": 1
}

export const talents = {
    "100": 0,
    "101": 0,
    "102": 4,
    "103": 0,
    "104": 0,
    "105": 0,
    "106": 1,
    "107": 1,
    "108": 0,
    "109": 0,
    "110": 0,
    "111": 0,
    "112": 0,
    "113": 0,
    "114": 0,
    "115": 0,
    "116": 4,
    "117": 0,
    "118": 3,
    "119": 3,
    "120": 1,
    "121": 4,
    "122": 1,
    "123": 0,
    "124": 0,
    "125": 0,
    "126": 1,
    "127": 0,
    "129": 0,
    "130": 0,
    "131": 0,
    "132": 1,
    "133": 0,
    "134": 3,
    "135": 0,
    "136": 2,
    "137": 0,
    "140": 1,
    "143": 0,
    "144": 0,
    "145": 0,
    "146": 0,
    "147": 0,
}

export class Rank extends PickableValue {
    public static readonly name = 'Rank'
    public static readonly values = [
        //"",
        "BRONZE",
        "GOLD",
        "PLATINUM",
        "SILVER",
        "UNRANKED",
    ]
    public static random(){
        return this.values[Math.floor(Math.random() * this.values.length)]!
    }
}

export const blowfishKey = "17BLOhi6KZsTtldTsizvHg=="
export function sanitize_bfkey(v: string){
    return v.replace(/[^a-zA-Z0-9=]/g, '')
}

export enum Features {
    CHEATS_ENABLED = 1 << 0,
    MANACOSTS_DISABLED = 1 << 1,
    COOLDOWNS_DISABLED = 1 << 2,
    MINIONS_DISABLED = 1 << 3,
}

export class FeaturesEnabled extends Enabled {
    public static readonly name = `Features Enabled`
    public static readonly values = {
        [Features.CHEATS_ENABLED]: 'Enable Cheats',
        [Features.MANACOSTS_DISABLED]: 'Disable Manacosts',
        [Features.COOLDOWNS_DISABLED]: 'Disable Cooldowns',
        [Features.MINIONS_DISABLED]: 'Disable Minions',
    }
    public static readonly choices = PickableValue.normalize(FeaturesEnabled.values)
    
    public get isCheatsEnabled(){ return this.value.includes(Features.CHEATS_ENABLED) }
    public get isManacostsEnabled(){ return !this.value.includes(Features.MANACOSTS_DISABLED) }
    public get isCooldownsEnabled(){ return !this.value.includes(Features.COOLDOWNS_DISABLED) }
    public get isMinionsEnabled(){ return !this.value.includes(Features.MINIONS_DISABLED) }
    public asString(): string {
        let ret = ''
        if(this.isCheatsEnabled) ret += '[CHEATS]'
        if(!this.isManacostsEnabled) ret += '[NO MANA]'
        if(!this.isCooldownsEnabled) ret += '[NO CD]'
        if(!this.isMinionsEnabled) ret += '[NO MINIONS]'
        return ret
    }
}

export class AIChampion extends PickableValue {
    public static readonly name = 'AI Champions'
    public static readonly values = Object.fromEntries(
        champions
            .filter(({ hasBT }) => hasBT)
            .map(({i, name}) => [ i, name ])
    )
    public static readonly choices = PickableValue.normalize(AIChampion.values)
}

export class AIDifficulty extends PickableValue {
    public static readonly name = 'AI Difficulty'
    public static readonly values = [
        "Newbie", "Intermediate", "Advanced"
    ]
    public static readonly choices = PickableValue.normalize(AIDifficulty.values)
}
