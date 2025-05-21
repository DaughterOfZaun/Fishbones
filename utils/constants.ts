import { input, select } from "@inquirer/prompts"
import type { Choice } from "../ui/dynamic-select"

export type u = undefined

export const LOBBY_PROTOCOL = `/lobby/${0}`

export interface ValueDesc<I, E> {
    name: string
    value?: I
    encode(): E
    decodeInplace(v: E): void
    uinput(...args: unknown[]): Promise<unknown>
    toString(): string
}

export class PickableValue implements ValueDesc<number, number> {
    public readonly name: string
    public value?: number
    private readonly values: Record<number, string>
    private readonly choices: Choice<number>[]
    constructor(name: string, value: u|number, values: Record<number, string>, choices: Choice<number>[]){
        this.name = name
        this.value = value
        this.values = values
        this.choices = choices
    }
    public encode(){ return (this.value ?? -1) + 1 }
    public decodeInplace(from: number): boolean {
        if((from - 1) in this.values){
            this.value = from - 1
            return true
        }
        return false
    }
    public async uinput(controller?: AbortController) {
        this.value = await select({
            message: `Select ${this.name}`,
            choices: this.choices
        }, {
            clearPromptOnDone: true,
            signal: controller?.signal
        })
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
}

export class Map extends PickableValue {
    private static name = 'Map'
    private static values = {
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
    private static choices = PickableValue.normalize(Map.values)
    public constructor(value?: number){ super(Map.name, value, Map.values, Map.choices) }
}

export class Mode extends PickableValue {
    private static name = 'Mode'
    private static values = [
        'CLASSIC',
        'ARAM',
    ]
    private static choices = PickableValue.normalize(Mode.values)
    public constructor(value?: number){ super(Mode.name, value, Mode.values, Mode.choices) }
}

export class Champion extends PickableValue {
    private static name = 'Champion'
    private static values = [
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
    private static choices = PickableValue.normalize(Champion.values)
    public constructor(value?: number){ super(Champion.name, value, Champion.values, Champion.choices) }
}

export class SummonerSpell extends PickableValue {
    private static name = 'Summoner Spell'
    private static values = [
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
    private static choices = PickableValue.normalize(SummonerSpell.values)
    public constructor(value?: number){ super(SummonerSpell.name, value, SummonerSpell.values, SummonerSpell.choices) }
}

export class Team extends PickableValue {
    private static name = 'Team'
    public  static values = [
        "Blue", "Purple", "Neutral",
    ]
    public static readonly count = 2
    private static choices = PickableValue.normalize(Team.values)
    public constructor(value?: number){ super(Team.name, value, Team.values, Team.choices) }
    static colors = [ 'blue', 'red', 'green', 'yellow', 'magenta', 'cyan', 'white' ] as const
    public color(): (typeof Team.colors)[number] | 'gray' {
        return (this.value != undefined) ? Team.colors[this.value] ?? 'white' : 'gray'
    }
    public get index(){ return this.value ?? -1 }
}

export class Lock extends PickableValue {
    private static name = 'Lock'
    private static values = [ "Unlocked", "Locked" ]
    private static choices = PickableValue.normalize(Lock.values)
    public constructor(value: number = +false){ super(Lock.name, value, Lock.values, Lock.choices) }
}

export class PlayerCount extends PickableValue {
    private static name = 'Player Count'
    private static values = Object.fromEntries(Array(6).fill(0).map((v, i) => [ ++i, `${i}v${i}`]))
    private static choices = PickableValue.normalize(PlayerCount.values)
    public constructor(value?: number){ super(PlayerCount.name, value, PlayerCount.values, PlayerCount.choices) }
}

export class InputableValue implements ValueDesc<string, string> {
    public readonly name: string
    public value?: string
    constructor(name: string, value?: string){
        this.name = name
        this.value = value
    }
    public encode(): string {
        return this.value ?? ''
    }
    public decodeInplace(v: string): boolean {
        this.value = v
        return true
    }
    public async uinput(controller?: AbortController) {
        this.value = await input({
            message: `Enter ${this.name}`
        }, {
            clearPromptOnDone: true,
            signal: controller?.signal
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
    private static name = 'Password'
    public constructor(){ super(Password.name) }
    public toString(): string {
        return this.value?.replace(/./g, '*') ?? 'undefined'
    }
    public isSet(){ return this.value != undefined }
}

export class Name extends InputableValue {
    private static name = 'Name'
    public constructor(value: string){ super(Name.name, value) }
    public toString(): string {
        return this.value ?? 'undefined'
    }
}