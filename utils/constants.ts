import { input, checkbox, select, type Choice } from "../ui/remote"
import type { AbortOptions } from "@libp2p/interface"
type CheckboxChoice<T> = Extract<Parameters<typeof checkbox<T>>[0]['choices'][number], { value: T }>

export type u = undefined

export const LOBBY_PROTOCOL = `/lobby/${0}`
export const PROXY_PROTOCOL = `/proxy/${0}`
export const LOCALHOST = '127.0.0.1'

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
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
    public static normalize(values: Record<number, string>): Choice<number>[] {
        return Object.entries(values).map(([k, v]) => ({ value: Number(k), name: v }))
    }
    public setRandom(){
        const enabled = this.enabledGetter?.call(null).value ?? Object.keys(this.values)
        this.value = Number(enabled[Math.floor(Math.random() * enabled.length)])
    }
}

// short, name, enabled by default
export const maps: [number, string, boolean][] = [
    [1, `Old Summoner's Rift`, true],
    [3, `Proving Grounds`, false],
    [8, `Crystal Scar`, true],
    [10, `Twisted Treeline`, true],
    [11, `Summoner's Rift`, true],
    [12, `Howling Abyss`, true],
    [13, `Magma Chamber`, false],
    [14, `Butcher's Bridge`, false],
    [16, `Cosmic Ruins`, false],
    [18, `Valoran City Park`, false],
    [19, `Substructure 43`, false],
    [20, `Crash Site`, false],
    [21, `Temple of Lily and Lotus`, false],
    [30, `Arena: Rings of Wrath`, false],
    [35, `The Bandlewood`, false],
] //as const
export class GameMap extends PickableValue {
    public static readonly name = 'Game Map'
    public static readonly values = Object.fromEntries(maps.map(([i, name,]) => ([i, name])))
    public static readonly choices = PickableValue.normalize(GameMap.values)
}

// short, name, enabled by default
export const modes: [string, string, boolean][] = [
    ['CLASSIC', 'Classic', true],
    ['ARAM', 'ARAM', true],
] //as const
export class GameMode extends PickableValue {
    public static readonly name = 'Game Mode'
    public static readonly values = modes.map(([short,,]) => short)
    public static readonly choices = modes.map(([short, name,], i) => ({ value: i, short, name }))
}

// short, name, enabled by default
export const champions: [string, string, boolean][] = [
    ["Alistar", "Alistar", true],
    ["Annie", "Annie", true],
    ["Ashe", "Ashe", true],
    ["FiddleSticks", "Fiddlesticks", true],
    ["Jax", "Jax", true],
    ["Kayle", "Kayle", true],
    ["MasterYi", "Master Yi", true],
    ["Morgana", "Morgana", true],
    ["Nunu", "Nunu & Willump", true],
    ["Ryze", "Ryze", false],
    ["Sion", "Sion", false],
    ["Sivir", "Sivir", true],
    ["Soraka", "Soraka", false],
    ["Teemo", "Teemo", true],
    ["Tristana", "Tristana", true],
    ["TwistedFate", "Twisted Fate", true],
    ["Warwick", "Warwick", true],
    ["Singed", "Singed", true],
    ["Zilean", "Zilean", true],
    ["Evelynn", "Evelynn", true],
    ["Tryndamere", "Tryndamere", true],
    ["Twitch", "Twitch", true],
    ["Karthus", "Karthus", true],
    ["Amumu", "Amumu", true],
    ["Chogath", "Cho'Gath", true],
    ["Anivia", "Anivia", true],
    ["Rammus", "Rammus", true],
    ["Veigar", "Veigar", true],
    ["Kassadin", "Kassadin", true],
    ["Gangplank", "Gangplank", true],
    ["Taric", "Taric", true],
    ["Blitzcrank", "Blitzcrank", true],
    ["DrMundo", "Dr. Mundo", true],
    ["Janna", "Janna", true],
    ["Malphite", "Malphite", true],
    ["Corki", "Corki", true],
    ["Katarina", "Katarina", false],
    ["Nasus", "Nasus", true],
    ["Heimerdinger", "Heimerdinger", false],
    ["Shaco", "Shaco", true],
    ["Udyr", "Udyr", true],
    ["Nidalee", "Nidalee", true],
    ["Poppy", "Poppy", false],
    ["Gragas", "Gragas", true],
    ["Pantheon", "Pantheon", true],
    ["Mordekaiser", "Mordekaiser", true],
    ["Ezreal", "Ezreal", true],
    ["Shen", "Shen", true],
    ["Kennen", "Kennen", true],
    ["Garen", "Garen", true],
    ["Akali", "Akali", true],
    ["Malzahar", "Malzahar", true],
    ["Olaf", "Olaf", true],
    ["KogMaw", "Kog'Maw", true],
    ["XinZhao", "Xin Zhao", false],
    ["Vladimir", "Vladimir", true],
    ["Galio", "Galio", true],
    ["Urgot", "Urgot", true],
    ["MissFortune", "Miss Fortune", true],
    ["Sona", "Sona", false],
    ["Swain", "Swain", true],
    ["Lux", "Lux", true],
    ["Leblanc", "LeBlanc", true],
    ["Irelia", "Irelia", true],
    ["Trundle", "Trundle", true],
    ["Cassiopeia", "Cassiopeia", false],
    ["Caitlyn", "Caitlyn", true],
    ["Renekton", "Renekton", true],
    ["Karma", "Karma", false],
    ["Maokai", "Maokai", true],
    ["JarvanIV", "Jarvan IV", true],
    ["Nocturne", "Nocturne", true],
    ["LeeSin", "Lee Sin", true],
    ["Brand", "Brand", true],
    ["Rumble", "Rumble", true],
    ["Vayne", "Vayne", true],
    ["Orianna", "Orianna", true],
    ["Yorick", "Yorick", true],
    ["Leona", "Leona", true],
    ["MonkeyKing", "Wukong", true],
    ["Skarner", "Skarner", true],
    ["Talon", "Talon", true],
    ["Riven", "Riven", true],
    ["Xerath", "Xerath", false],
    ["Graves", "Graves", true],
    ["Shyvana", "Shyvana", true],
    ["Fizz", "Fizz", true],
    ["Volibear", "Volibear", true],
    ["Ahri", "Ahri", true],
    ["Viktor", "Viktor", true],
    ["Sejuani", "Sejuani", false],
    ["Ziggs", "Ziggs", false],
    ["Nautilus", "Nautilus", false],
    ["Fiora", "Fiora", false],
    ["Lulu", "Lulu", false],
    ["Hecarim", "Hecarim", false],
    ["Varus", "Varus", false],
    ["Darius", "Darius", false],
    ["Draven", "Draven", false],
    ["Jayce", "Jayce", false],
    ["Zyra", "Zyra", false],
    ["Diana", "Diana", false],
    ["Rengar", "Rengar", false],
    ["Syndra", "Syndra", false],
    ["Khazix", "Kha'Zix", false],
    ["Elise", "Elise", false],
    ["Zed", "Zed", false],
    ["Nami", "Nami", false],
    ["Vi", "Vi", false],
    ["Thresh", "Thresh", false],
    ["Quinn", "Quinn", false],
    ["Zac", "Zac", false],
    ["Lissandra", "Lissandra", false],
    ["Aatrox", "Aatrox", false],
    ["Lucian", "Lucian", false],
    ["Jinx", "Jinx", false],
    ["Yasuo", "Yasuo", false],
    ["Velkoz", "Vel'Koz", false],
    ["Braum", "Braum", false],
    ["Gnar", "Gnar", false],
    ["Azir", "Azir", false],
    ["Kalista", "Kalista", false],
    ["RekSai", "Rek'Sai", false],
    ["Bard", "Bard", false],
    ["Ekko", "Ekko", false],
    ["TahmKench", "Tahm Kench", false],
    ["Kindred", "Kindred", false],
    ["Illaoi", "Illaoi", false],
    ["Jhin", "Jhin", false],
    ["AurelionSol", "Aurelion Sol", false],
    ["Taliyah", "Taliyah", false],
    ["Kled", "Kled", false],
    ["Ivern", "Ivern", false],
    ["Camille", "Camille", false],
    ["Rakan", "Rakan", false],
    ["Xayah", "Xayah", false],
    ["Kayn", "Kayn", false],
    ["Ornn", "Ornn", false],
    ["Zoe", "Zoe", false],
    ["KaiSa", "Kai'Sa", false],
    ["Pyke", "Pyke", false],
    ["Neeko", "Neeko", false],
    ["Sylas", "Sylas", false],
    ["Yuumi", "Yuumi", false],
    ["Qiyana", "Qiyana", false],
    ["Senna", "Senna", false],
    ["Aphelios", "Aphelios", false],
    ["Sett", "Sett", false],
    ["Lillia", "Lillia", false],
    ["Yone", "Yone", false],
    ["Samira", "Samira", false],
    ["Seraphine", "Seraphine", false],
    ["Rell", "Rell", false],
    ["Viego", "Viego", false],
    ["Gwen", "Gwen", false],
    ["Akshan", "Akshan", false],
    ["Vex", "Vex", false],
    ["Zeri", "Zeri", false],
    ["RenataGlasc", "Renata Glasc", false],
    ["BelVeth", "Bel'Veth", false],
    ["Nilah", "Nilah", false],
    ["KSante", "K'Sante", false],
    ["Milio", "Milio", false],
    ["Naafiri", "Naafiri", false],
    ["Briar", "Briar", false],
    ["Hwei", "Hwei", false],
    ["Smolder", "Smolder", false],
    ["Aurora", "Aurora", false],
    ["Ambessa", "Ambessa", false],
    ["Mel", "Mel", false],
] //as const
export class Champion extends PickableValue {
    public static readonly name = 'Champion'
    public static readonly values = champions.map(([short,,]) => short)
    public static readonly choices = champions.map(([short, name,], i) => ({ value: i, short, name }))
}

// short, name, enabled by default
export const spells: [string, string, boolean][] = [
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
] //as const
export class SummonerSpell extends PickableValue {
    public static readonly name = 'Summoner Spell'
    public static readonly values = spells.map(([, name,]) => name)
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
    public static values = Object.fromEntries(Array(6).fill(0).map((v, i) => [ ++i, `${i}v${i}`]))
    public static readonly choices = PickableValue.normalize(PlayerCount.values)
}

export class TickRate extends PickableValue {
    public static readonly name = 'Tick Rate'
    public static values = Object.fromEntries([30, 60, 15].map(v => [ v, `${v} fps`]))
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

export type DescKeys<T> = KeysByValue<T, ValueDesc<unknown, unknown>>
export async function ufill<T extends object>(obj: T, { signal }: Required<AbortOptions>, /*fields?: DescKeys<T>[]*/): Promise<T> {
    const fields = (Object.keys(obj) as (keyof T)[]).filter(key => obj[key] instanceof ValueDesc) as unknown as DescKeys<T>[]
    const opts = {
        clearPromptOnDone: true,
        signal,
    }
    type ActionEdit = ['edit', DescKeys<T>]
    type Action = ActionEdit | ['enter']
    let selected: u|Action = undefined
    const fieldChoices = fields.map(key => {
        const obj_key = obj[key] as ValueDesc<unknown, unknown>
        return { value: ['edit', key] as ActionEdit, short: obj_key.name, name: '', description: obj_key.desc }
    })
    const choices = [
        ...fieldChoices,
        { value: ['enter'] as Action, short: 'Enter', name: 'Enter' },
    ]
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    loop: while(true){
        for(const fieldChoice of fieldChoices){
            const key = fieldChoice.value[1]
            const obj_key = obj[key] as ValueDesc<unknown, unknown>
            fieldChoice.name = `${obj_key.name}: ${obj_key.toString()}`
        }
        selected = await select<Action>({
            message: 'Select property to edit',
            default: selected,
            choices,
            pageSize: 20,
        }, opts)
        const [action, key] = selected
        if(action == 'edit'){
            const obj_key = obj[key] as ValueDesc<unknown, unknown>
            await obj_key.uinput(opts)
        }
        if(action == 'enter') break loop;
    }
    return obj
}

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

export const talents = {
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
