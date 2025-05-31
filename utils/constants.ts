import { input, checkbox, select } from "@inquirer/prompts"
import type { Choice as SelectChoice } from "../ui/dynamic-select"
type CheckboxChoice<T> = Extract<Parameters<typeof checkbox<T>>[0]['choices'][number], { value: T }>

export type u = undefined

export const LOBBY_PROTOCOL = `/lobby/${0}`

export abstract class ValueDesc<I, E> {
    public name!: string
    public value?: I
    abstract encode(): E
    abstract decodeInplace(v: E): boolean
    abstract uinput(signal?: AbortSignal): Promise<unknown>
    abstract toString(): string
}

//type OmitFirst<T extends unknown[]> = T extends [unknown, ...infer R] ? R : never
//type PickableValueConstructorArgs = OmitFirst<ConstructorParameters<typeof PickableValue>>
//type PickableValueConstructor = new (...args: ConstructorParameters<typeof PickableValue>) => PickableValue
type PickableValueStatics = { name: string, values: Record<number, string>, choices: SelectChoice<number>[] }
export class PickableValue extends ValueDesc<number, number> {
    public value?: number
    public readonly name: string
    private readonly values: Record<number, string>
    private readonly choices: SelectChoice<number>[]
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
    public encode(){ return this.value ?? 0 }
    public decodeInplace(from: number): boolean {
        if(from === undefined) return false
        //from--
        if(from in this.values){
            this.value = from
            return true
        }
        return false
    }
    public async uinput(signal?: AbortSignal) {
        const enabled = this.enabledGetter?.call(null)
        //const enabled = this.enabled
        if(enabled) for(const choice of this.choices){
            choice.disabled = !enabled.value.includes(choice.value)
        }
        try {
            this.value = await select({
                message: `Select ${this.name}`,
                choices: this.choices
            }, {
                clearPromptOnDone: true,
                signal: signal,
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
    public static normalize(values: Record<number, string>): SelectChoice<number>[] {
        return Object.entries(values).map(([k, v]) => ({ value: Number(k), name: v }))
    }
    public setRandom(){
        const enabled = this.enabledGetter?.call(null).value ?? Object.keys(this.values)
        this.value = Number(enabled[Math.floor(Math.random() * enabled.length)])
    }
}

export class GameMap extends PickableValue {
    public static readonly name = 'Game Map'
    public static readonly values = {
        1: `Old Summoner's Rift`,
        3: `Proving Grounds`,
        8: `Crystal Scar`,
        10: `Twisted Treeline`,
        11: `Summoner's Rift`,
        12: `Howling Abyss`,
        13: `Magma Chamber`,
        14: `Butcher's Bridge`,
        16: `Cosmic Ruins`,
        18: `Valoran City Park`,
        19: `Substructure 43`,
        20: `Crash Site`,
        21: `Temple of Lily and Lotus`,
        30: `Arena: Rings of Wrath`,
        35: `The Bandlewood`,
    }
    public static readonly choices = PickableValue.normalize(GameMap.values)
}

export class GameMode extends PickableValue {
    public static readonly name = 'Game Mode'
    public static readonly values = [
        'CLASSIC',
        'ARAM',
    ]
    public static readonly choices = PickableValue.normalize(GameMode.values)
}

export class Champion extends PickableValue {
    public static readonly name = 'Champion'
    public static readonly values = [
        "Alistar",
        "Annie",
        "Ashe",
        "Fiddlesticks",
        "Jax",
        "Kayle",
        "Master Yi",
        "Morgana",
        "Nunu & Willump",
        "Ryze",
        "Sion",
        "Sivir",
        "Soraka",
        "Teemo",
        "Tristana",
        "Twisted Fate",
        "Warwick",
        "Singed",
        "Zilean",
        "Evelynn",
        "Tryndamere",
        "Twitch",
        "Karthus",
        "Amumu",
        "Cho'Gath",
        "Anivia",
        "Rammus",
        "Veigar",
        "Kassadin",
        "Gangplank",
        "Taric",
        "Blitzcrank",
        "Dr. Mundo",
        "Janna",
        "Malphite",
        "Corki",
        "Katarina",
        "Nasus",
        "Heimerdinger",
        "Shaco",
        "Udyr",
        "Nidalee",
        "Poppy",
        "Gragas",
        "Pantheon",
        "Mordekaiser",
        "Ezreal",
        "Shen",
        "Kennen",
        "Garen",
        "Akali",
        "Malzahar",
        "Olaf",
        "Kog'Maw",
        "Xin Zhao",
        "Vladimir",
        "Galio",
        "Urgot",
        "Miss Fortune",
        "Sona",
        "Swain",
        "Lux",
        "LeBlanc",
        "Irelia",
        "Trundle",
        "Cassiopeia",
        "Caitlyn",
        "Renekton",
        "Karma",
        "Maokai",
        "Jarvan IV",
        "Nocturne",
        "Lee Sin",
        "Brand",
        "Rumble",
        "Vayne",
        "Orianna",
        "Yorick",
        "Leona",
        "Wukong",
        "Skarner",
        "Talon",
        "Riven",
        "Xerath",
        "Graves",
        "Shyvana",
        "Fizz",
        "Volibear",
        "Ahri",
        "Viktor",
        "Sejuani",
        "Ziggs",
        "Nautilus",
        "Fiora",
        "Lulu",
        "Hecarim",
        "Varus",
        "Darius",
        "Draven",
        "Jayce",
        "Zyra",
        "Diana",
        "Rengar",
        "Syndra",
        "Kha'Zix",
        "Elise",
        "Zed",
        "Nami",
        "Vi",
        "Thresh",
        "Quinn",
        "Zac",
        "Lissandra",
        "Aatrox",
        "Lucian",
        "Jinx",
        "Yasuo",
        "Vel'Koz",
        "Braum",
        "Gnar",
        "Azir",
        "Kalista",
        "Rek'Sai",
        "Bard",
        "Ekko",
        "Tahm Kench",
        "Kindred",
        "Illaoi",
        "Jhin",
        "Aurelion Sol",
        "Taliyah",
        "Kled",
        "Ivern",
        "Camille",
        "Rakan",
        "Xayah",
        "Kayn",
        "Ornn",
        "Zoe",
        "Kai'Sa",
        "Pyke",
        "Neeko",
        "Sylas",
        "Yuumi",
        "Qiyana",
        "Senna",
        "Aphelios",
        "Sett",
        "Lillia",
        "Yone",
        "Samira",
        "Seraphine",
        "Rell",
        "Viego",
        "Gwen",
        "Akshan",
        "Vex",
        "Zeri",
        "Renata Glasc",
        "Bel'Veth",
        "Nilah",
        "K'Sante",
        "Milio",
        "Naafiri",
        "Briar",
        "Hwei",
        "Smolder",
        "Aurora",
        "Ambessa",
        "Mel",
    ]
    public static readonly choices = PickableValue.normalize(Champion.values)
}

export class SummonerSpell extends PickableValue {
    public static readonly name = 'Summoner Spell'
    public static readonly values = [
        "Heal",
        "Ghost",
        "Barrier",
        "Exhaust",
        "Mark",
        "Dash",
        "Clarity",
        "Flash",
        "Teleport",
        "Smite",
        "Cleanse", 
        "Ignite"
    ]
    public static readonly choices = PickableValue.normalize(SummonerSpell.values)
}

export class Team extends PickableValue {
    public static readonly name = 'Team'
    public  static values = [
        "Blue", "Purple", "Neutral",
    ]
    public static readonly count = 2
    public static readonly choices = PickableValue.normalize(Team.values)

    static colors = [ 'blue', 'red', 'green', 'yellow', 'magenta', 'cyan', 'white' ] as const
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
    public async uinput(signal?: AbortSignal) {
        this.value = await input({
            message: `Enter ${this.name}`,
            //transformer: (v, /*{ isFinal }*/) => sanitize_str(v),
            validate: v => v == sanitize_str(v),
        }, {
            clearPromptOnDone: true,
            signal: signal,
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
    async uinput(signal?: AbortSignal) {
        this.value = await checkbox({
            message: `Check ${this.name}`,
            choices: this.choices
        }, {
            clearPromptOnDone: true,
            signal: signal,
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
export async function ufill<T extends object>(obj: T, fields?: DescKeys<T>[]): Promise<T> {
    fields ||= (Object.keys(obj) as (keyof T)[]).filter(key => obj[key] instanceof ValueDesc) as unknown as DescKeys<T>[]
    const opts = { clearPromptOnDone: true }
    type ActionEdit = ['edit', DescKeys<T>]
    type Action = ActionEdit | ['enter']
    let selected: u|Action = undefined
    const fieldChoices = fields.map(key => {
        const obj_key = obj[key] as ValueDesc<unknown, unknown>
        return { value: ['edit', key] as ActionEdit, short: obj_key.name, name: '' }
    })
    const choices = [
        ...fieldChoices,
        { value: ['enter'] as Action, short: 'Enter', name: 'Enter' },
    ]
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
        }, opts)
        const [action, key] = selected
        if(action == 'edit'){
            const obj_key = obj[key] as ValueDesc<unknown, unknown>
            await obj_key.uinput()
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