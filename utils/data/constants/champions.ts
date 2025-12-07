import type { AbortOptions } from "@libp2p/interface"
import { PickableValue } from "./values/pickable"
import { gcPkg } from "../packages"
import { fs_readdir } from "../fs"
import path from 'node:path'
import { enabled } from "./values/enabled"
import { ValueDesc } from "./values/desc"
//import { byId } from "../../../tui/masteries/trees"

type InternalName = string
type ExternalName = string
type MainlineStatus = 'Working' | 'Playable' | 'Buggy' | 'Unimplemented' | 'Non-existent'
type HasBehaviourTree = boolean

type SkinInfo = { i: number, image: string }

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

const championsIcons = [
    "Akali/Info/Akali_Square_0.dds",
    "Alistar/Info/Minotaur_Square.dds",
    "Amumu/Info/SadMummy_Square.dds",
    "Anivia/Info/Cryophoenix_Square.dds",
    "Annie/Info/Annie_Square.dds",
    "Ashe/Info/Bowmaster_Square.dds",
    "Blitzcrank/Info/Steamgolem_Square.dds",
    "Brand/info/Brand_Square.dds",
    "Caitlyn/Info/Caitlyn_Square_0.dds",
    "Cassiopeia/Info/Cassiopeia_Square_0.dds",
    "Chogath/Info/GreenTerror_Square.dds",
    "Corki/Info/Corki_Square.dds",
    "DrMundo/Info/DrMundo_Square.dds",
    "Evelynn/Info/Evelynn_Square.dds",
    "Ezreal/Info/Ezreal_Square.dds",
    "FiddleSticks/info/Fiddlesticks_Square.dds",
    "Galio/info/Galio_Square.dds",
    "Gangplank/Info/Pirate_Square.dds",
    "Garen/Info/Garen_Square.dds",
    "Gragas/Info/Gragas_Square.dds",
    "Heimerdinger/info/Heimerdinger_Square.dds",
    "Irelia/Info/Irelia_Square_0.dds",
    "Janna/info/Janna_Square.dds",
    "JarvanIV/Info/JarvanIV_Square_0.dds",
    "Jax/info/Armsmaster_Square.dds",
    "Karma/Info/KarmaSquare.dds",
    "Karthus/Info/Lich_Square.dds",
    "Kassadin/Info/Kassadin_Square.dds",
    "Katarina/Info/Katarina_Square.dds",
    "Kayle/Info/Judicator_Square.dds",
    "Kennen/Info/Kennen_Square.dds",
    "KogMaw/Info/Kog'Maw_Square_0.dds",
    "Leblanc/Info/Leblanc_Square.dds",
    "LeeSin/info/LeeSin_Square.dds",
    "Leona/Info/Leona_Square.dds",
    "Lux/Info/Lux_Square.dds",
    "Malphite/info/Malphite_Square.dds",
    "Malzahar/info/Malzahar_Square.dds",
    "Maokai/Info/Maokai_Square.dds",
    "MasterYi/Info/MasterYi_Square.dds",
    "MissFortune/Info/MissFortune_Square.dds",
    "MonkeyKing/Info/MonkeyKing_Square.dds",
    "Mordekaiser/Info/Mordekaiser_Square.dds",
    "Morgana/Info/FallenAngel_Square.dds",
    "Nasus/Info/Nasus_Square.dds",
    "Nidalee/Info/Nidalee_Square.dds",
    "Nocturne/Info/Nocturne_Square_0.dds",
    "Nunu/Info/Yeti_Square.dds",
    "Olaf/Info/Olaf_Square.dds",
    "Orianna/Info/Oriana_Square.dds",
    "Pantheon/Info/Pantheon_Square.dds",
    "Poppy/info/Poppy_Square.dds",
    "Rammus/Info/Armordillo_Square.dds",
    "Renekton/Info/Renekton_Square_0.dds",
    "Riven/Info/Riven_Square.dds",
    "Rumble/Info/Rumble_Square.dds",
    "Ryze/Info/Ryze_Square.dds",
    "Shaco/Info/Jester_Square.dds",
    "Shen/info/Shen_Square.dds",
    "Singed/Info/ChemicalMan_Square.dds",
    "Sion/Info/Sion_Square.dds",
    "Sivir/Info/Sivir_Square.dds",
    "Skarner/Info/Skarner_Square.dds",
    "Sona/info/Sona_Square.dds",
    "Soraka/info/Soraka_Square.dds",
    "Swain/Info/Swain_Square_0.dds",
    "Talon/Info/Talon_Square_0.dds",
    "Taric/Info/GemKnight_Square.dds",
    "Teemo/Info/Teemo_Square.dds",
    "Tristana/Info/Tristana_Square.dds",
    "Trundle/Info/Trundle_Square.dds",
    "Tryndamere/Info/DarkChampion_Square.dds",
    "TwistedFate/Info/Cardmaster_Square.dds",
    "Twitch/Info/twitch_square.dds",
    "Udyr/Info/Udyr_Square.dds",
    "Urgot/Info/Urgot_Square_0.dds",
    "Vayne/Info/Vayne_Square.dds",
    "Veigar/Info/Veigar_Square.dds",
    "Vladimir/Info/Vladimir_Square_0.dds",
    "Warwick/Info/Warwick_Square.dds",
    "Xerath/info/Xerath_Square_0.dds",
    "XinZhao/Info/XenZhao_Square.dds",
    "Yorick/Info/Yorick_Square.dds",
    "Zilean/Info/Chronokeeper_Square.dds",
]

const charactersDirRelative = path.join('%DATA%', 'Characters')
const charactersDir = path.join(gcPkg.dir, 'DATA', 'Characters')

const championsIconsCache = Object.fromEntries(
    championsIcons
    .map(shortUnixIconPath => {
        const m = /^(?<champion>.*?)\/Info\/(?<file>.*?)$/i.exec(shortUnixIconPath)
        const champion = m!.groups!.champion!.toLowerCase()
        const iconPathRelative = path.join(charactersDirRelative, ...shortUnixIconPath.split('/'))
        return [ champion, iconPathRelative ]
    })
)

export const champions = championsTable
    .map(([short, name, status, hasBT], i) => {
        const icon = championsIconsCache[short.toLowerCase()]
        return { i, short, name, status, hasBT, enabled: status === 'Working', icon, skins: ([] as SkinInfo[]) }
    })

const icmp = (a: string | undefined, b: string) => a?.toLowerCase() === b.toLowerCase()
export async function loadSkins(opts: Required<AbortOptions>){
    for(const info of champions){
        const filenames = await fs_readdir(path.join(charactersDir, info.short), opts)
        info.skins = filenames.flatMap(filename => {
            let skin: SkinInfo | undefined
            const m = filename.match(/^(?<champion>.*)LoadScreen(?:_(?<skinID>\d+))?\.dds$/i)
            if(m && icmp(m.groups?.champion, info.short)){
                const i = parseInt(m.groups?.skinID || '0')
                const image = path.join(charactersDirRelative, info.short, filename)
                skin = { i, image }
            }
            return skin ? [ skin ] : []
        })
    }
}

export class Champion extends PickableValue {
    public static readonly name = 'Champion'
    public static readonly values = champions.map(({ short }) => short)
    public static readonly choices = champions.map(({ short, name }, i) => ({ value: i, short, name }))
}
export const ChampionsEnabled = enabled(Champion)

export class AIChampion extends PickableValue {
    public static readonly name = 'AI Champions'
    public static readonly values = Object.fromEntries(
        champions
            .filter(({ hasBT }) => hasBT)
            .map(({i, name}) => [ i, name ])
    )
    public static readonly choices = PickableValue.normalize(AIChampion.values)
}
export const BotsEnabled = enabled(AIChampion)

export class AIDifficulty extends PickableValue {
    public static readonly name = 'AI Difficulty'
    public static readonly values = [
        "Newbie", "Intermediate", "Advanced"
    ]
    public static readonly choices = PickableValue.normalize(AIDifficulty.values)
}

//HACK:
export class Skin extends PickableValue {
    public static readonly name = 'Skin'
    public static readonly values = Array(10).fill(0).map((v, i) => i)
    public static readonly choices = Skin.values.map(i => `Skin ${i}`)
}

export class Talents extends ValueDesc<
    Map<number, number>,
    Map<number, number>
>{
    value = new Map<number, number>()
    encode(): Map<number, number> {
        return this.value
    }
    decodeInplace(v: Map<number, number>): boolean {
        //this.value = new Map(v.entries().filter(([ key ]) => byId.has(key)))
        this.value = v //TODO: Sanitize.
        return true
    }
}
