import type { AbortOptions } from "@libp2p/interface"
import { PickableValue } from "./values/pickable"
import { gcPkg } from "../packages"
import { fs_readdir } from "../fs"
import path from 'node:path'
import { enabled } from "./values/enabled"
import { ValueDesc } from "./values/desc"
import { byId } from "../../../tui/masteries/trees"
import { tr } from "../../translation"

type InternalName = string
type ExternalName = string
type MainlineStatus = 'Working' | 'Playable' | 'Buggy' | 'Unimplemented' | 'Non-existent'
type HasBehaviourTree = boolean

type SkinInfo = { i: number, image: string }

export const championsTable: [InternalName, ExternalName, MainlineStatus, HasBehaviourTree ][] = [
    ["Alistar", tr("Alistar"), "Working", true],
    ["Annie", tr("Annie"), "Working", true],
    ["Ashe", tr("Ashe"), "Playable", true],
    ["FiddleSticks", tr("Fiddlesticks"), "Working", true],
    ["Jax", tr("Jax"), "Working", true],
    ["Kayle", tr("Kayle"), "Working", true],
    ["MasterYi", tr("Master Yi"), "Playable", true],
    ["Morgana", tr("Morgana"), "Working", true],
    ["Nunu", tr("Nunu & Willump"), "Working", true],
    ["Ryze", tr("Ryze"), "Working", true],
    ["Sion", tr("Sion"), "Working", true],
    ["Sivir", tr("Sivir"), "Working", true],
    ["Soraka", tr("Soraka"), "Working", true],
    ["Teemo", tr("Teemo"), "Playable", false],
    ["Tristana", tr("Tristana"), "Working", true],
    ["TwistedFate", tr("Twisted Fate"), "Playable", false],
    ["Warwick", tr("Warwick"), "Working", true],
    ["Singed", tr("Singed"), "Working", false],
    ["Zilean", tr("Zilean"), "Working", true],
    ["Evelynn", tr("Evelynn"), "Playable", false],
    ["Tryndamere", tr("Tryndamere"), "Working", false],
    ["Twitch", tr("Twitch"), "Playable", false],
    ["Karthus", tr("Karthus"), "Playable", true],
    ["Amumu", tr("Amumu"), "Working", true],
    ["Chogath", tr("Cho'Gath"), "Buggy", true],
    ["Anivia", tr("Anivia"), "Playable", false],
    ["Rammus", tr("Rammus"), "Playable", true],
    ["Veigar", tr("Veigar"), "Playable", false],
    ["Kassadin", tr("Kassadin"), "Working", false],
    ["Gangplank", tr("Gangplank"), "Working", false],
    ["Taric", tr("Taric"), "Working", true],
    ["Blitzcrank", tr("Blitzcrank"), "Working", true],
    ["DrMundo", tr("Dr. Mundo"), "Playable", true],
    ["Janna", tr("Janna"), "Working", false],
    ["Malphite", tr("Malphite"), "Playable", true],
    ["Corki", tr("Corki"), "Working", false],
    ["Katarina", tr("Katarina"), "Buggy", false],
    ["Nasus", tr("Nasus"), "Playable", true],
    ["Heimerdinger", tr("Heimerdinger"), "Playable", false],
    ["Shaco", tr("Shaco"), "Buggy", false],
    ["Udyr", tr("Udyr"), "Working", true],
    ["Nidalee", tr("Nidalee"), "Playable", true],
    ["Poppy", tr("Poppy"), "Buggy", false],
    ["Gragas", tr("Gragas"), "Playable", false],
    ["Pantheon", tr("Pantheon"), "Playable", false],
    ["Mordekaiser", tr("Mordekaiser"), "Working", false],
    ["Ezreal", tr("Ezreal"), "Working", true],
    ["Shen", tr("Shen"), "Working", true],
    ["Kennen", tr("Kennen"), "Working", false],
    ["Garen", tr("Garen"), "Working", true],
    ["Akali", tr("Akali"), "Working", false],
    ["Malzahar", tr("Malzahar"), "Working", true],
    ["Olaf", tr("Olaf"), "Playable", false],
    ["KogMaw", tr("Kog'Maw"), "Working", true],
    ["XinZhao", tr("Xin Zhao"), "Working", true],
    ["Vladimir", tr("Vladimir"), "Working", true],
    ["Galio", tr("Galio"), "Working", true],
    ["Urgot", tr("Urgot"), "Playable", false],
    ["MissFortune", tr("Miss Fortune"), "Working", true],
    ["Sona", tr("Sona"), "Working", true],
    ["Swain", tr("Swain"), "Working", true],
    ["Lux", tr("Lux"), "Working", true],
    ["Leblanc", tr("LeBlanc"), "Buggy", false],
    ["Irelia", tr("Irelia"), "Working", true],
    ["Trundle", tr("Trundle"), "Working", true],
    ["Cassiopeia", tr("Cassiopeia"), "Working", true],
    ["Caitlyn", tr("Caitlyn"), "Working", true],
    ["Renekton", tr("Renekton"), "Working", true],
    ["Karma", tr("Karma"), "Working", false],
    ["Maokai", tr("Maokai"), "Working", true],
    ["JarvanIV", tr("Jarvan IV"), "Playable", false],
    ["Nocturne", tr("Nocturne"), "Playable", false],
    ["LeeSin", tr("Lee Sin"), "Playable", false],
    ["Brand", tr("Brand"), "Working", true],
    ["Rumble", tr("Rumble"), "Playable", false],
    ["Vayne", tr("Vayne"), "Playable", false],
    ["Orianna", tr("Orianna"), "Buggy", false],
    ["Yorick", tr("Yorick"), "Working", true],
    ["Leona", tr("Leona"), "Working", true],
    ["MonkeyKing", tr("Wukong"), "Buggy", true],
    ["Skarner", tr("Skarner"), "Playable", false],
    ["Talon", tr("Talon"), "Working", false],
    ["Riven", tr("Riven"), "Buggy", false],
    ["Xerath", tr("Xerath"), "Playable", false],
    ["Graves", tr("Graves"), "Unimplemented", true],
    ["Shyvana", tr("Shyvana"), "Unimplemented", true],
    ["Fizz", tr("Fizz"), "Unimplemented", false],
    ["Volibear", tr("Volibear"), "Unimplemented", false],
    ["Ahri", tr("Ahri"), "Unimplemented", false],
    ["Viktor", tr("Viktor"), "Unimplemented", false],
    ["Sejuani", tr("Sejuani"), "Unimplemented", false],
]

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const nextChampionsTable = [
    ["Ziggs", tr("Ziggs"), "Non-existent", true],
    ["Nautilus", tr("Nautilus"), "Non-existent", false],
    ["Fiora", tr("Fiora"), "Non-existent", false],
    ["Lulu", tr("Lulu"), "Non-existent", false],
    ["Hecarim", tr("Hecarim"), "Non-existent", false],
    ["Varus", tr("Varus"), "Non-existent", false],
    ["Darius", tr("Darius"), "Non-existent", false],
    ["Draven", tr("Draven"), "Non-existent", false],
    ["Jayce", tr("Jayce"), "Non-existent", false],
    ["Zyra", tr("Zyra"), "Non-existent", false],
    ["Diana", tr("Diana"), "Non-existent", false],
    ["Rengar", tr("Rengar"), "Non-existent", false],
    ["Syndra", tr("Syndra"), "Non-existent", false],
    ["Khazix", tr("Kha'Zix"), "Non-existent", false],
    ["Elise", tr("Elise"), "Non-existent", false],
    ["Zed", tr("Zed"), "Non-existent", false],
    ["Nami", tr("Nami"), "Non-existent", false],
    ["Vi", tr("Vi"), "Non-existent", false],
    ["Thresh", tr("Thresh"), "Non-existent", false],
    ["Quinn", tr("Quinn"), "Non-existent", false],
    ["Zac", tr("Zac"), "Non-existent", false],
    ["Lissandra", tr("Lissandra"), "Non-existent", false],
    ["Aatrox", tr("Aatrox"), "Non-existent", false],
    ["Lucian", tr("Lucian"), "Non-existent", false],
    ["Jinx", tr("Jinx"), "Non-existent", false],
    ["Yasuo", tr("Yasuo"), "Non-existent", false],
    ["Velkoz", tr("Vel'Koz"), "Non-existent", false],
    ["Braum", tr("Braum"), "Non-existent", false],
    ["Gnar", tr("Gnar"), "Non-existent", false],
    ["Azir", tr("Azir"), "Non-existent", false],
    ["Kalista", tr("Kalista"), "Non-existent", false],
    ["RekSai", tr("Rek'Sai"), "Non-existent", false],
    ["Bard", tr("Bard"), "Non-existent", false],
    ["Ekko", tr("Ekko"), "Non-existent", false],
    ["TahmKench", tr("Tahm Kench"), "Non-existent", false],
    ["Kindred", tr("Kindred"), "Non-existent", false],
    ["Illaoi", tr("Illaoi"), "Non-existent", false],
    ["Jhin", tr("Jhin"), "Non-existent", false],
    ["AurelionSol", tr("Aurelion Sol"), "Non-existent", false],
    ["Taliyah", tr("Taliyah"), "Non-existent", false],
    ["Kled", tr("Kled"), "Non-existent", false],
    ["Ivern", tr("Ivern"), "Non-existent", false],
    ["Camille", tr("Camille"), "Non-existent", false],
    ["Rakan", tr("Rakan"), "Non-existent", false],
    ["Xayah", tr("Xayah"), "Non-existent", false],
    ["Kayn", tr("Kayn"), "Non-existent", false],
    ["Ornn", tr("Ornn"), "Non-existent", false],
    ["Zoe", tr("Zoe"), "Non-existent", false],
    ["KaiSa", tr("Kai'Sa"), "Non-existent", false],
    ["Pyke", tr("Pyke"), "Non-existent", false],
    ["Neeko", tr("Neeko"), "Non-existent", false],
    ["Sylas", tr("Sylas"), "Non-existent", false],
    ["Yuumi", tr("Yuumi"), "Non-existent", false],
    ["Qiyana", tr("Qiyana"), "Non-existent", false],
    ["Senna", tr("Senna"), "Non-existent", false],
    ["Aphelios", tr("Aphelios"), "Non-existent", false],
    ["Sett", tr("Sett"), "Non-existent", false],
    ["Lillia", tr("Lillia"), "Non-existent", false],
    ["Yone", tr("Yone"), "Non-existent", false],
    ["Samira", tr("Samira"), "Non-existent", false],
    ["Seraphine", tr("Seraphine"), "Non-existent", false],
    ["Rell", tr("Rell"), "Non-existent", false],
    ["Viego", tr("Viego"), "Non-existent", false],
    ["Gwen", tr("Gwen"), "Non-existent", false],
    ["Akshan", tr("Akshan"), "Non-existent", false],
    ["Vex", tr("Vex"), "Non-existent", false],
    ["Zeri", tr("Zeri"), "Non-existent", false],
    ["RenataGlasc", tr("Renata Glasc"), "Non-existent", false],
    ["BelVeth", tr("Bel'Veth"), "Non-existent", false],
    ["Nilah", tr("Nilah"), "Non-existent", false],
    ["KSante", tr("K'Sante"), "Non-existent", false],
    ["Milio", tr("Milio"), "Non-existent", false],
    ["Naafiri", tr("Naafiri"), "Non-existent", false],
    ["Briar", tr("Briar"), "Non-existent", false],
    ["Hwei", tr("Hwei"), "Non-existent", false],
    ["Smolder", tr("Smolder"), "Non-existent", false],
    ["Aurora", tr("Aurora"), "Non-existent", false],
    ["Ambessa", tr("Ambessa"), "Non-existent", false],
    ["Mel", tr("Mel"), "Non-existent", false],
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
    public static readonly name = tr('Champion')
    public static readonly values = champions.map(({ short }) => short)
    public static readonly choices = champions.map(({ i, short, name }) => ({ value: i, short, name }))
}
export const ChampionsEnabled = enabled(Champion)

const bots = champions.filter(({ hasBT }) => hasBT)
export class AIChampion extends PickableValue {
    public static readonly name = tr('AI Champions')
    public static readonly choices =
        bots.map(({ i, short, name }) => ({ value: i, short, name }))
    public static readonly values = Object.fromEntries(
        bots.map(({ i, short }) => [ i, short ])
    )
}
export const BotsEnabled = enabled(AIChampion)

const difficulties = [
    { i: 0, short: "Newbie", name: tr("Newbie") },
    { i: 1, short: "Intermediate", name: tr("Intermediate") },
    { i: 2, short: "Advanced", name: tr("Advanced") },
]
export class AIDifficulty extends PickableValue {
    public static readonly name = tr('AI Difficulty')
    public static readonly values = difficulties.map(({ short }) => short)
    public static readonly choices = difficulties.map(({ i, short, name }) => ({ value: i, short, name }))
}

//HACK:
export class Skin extends PickableValue {
    public static readonly name = tr('Skin')
    public static readonly values = Array(10).fill(0).map((v, i) => i)
    public static readonly choices = Skin.values.map(i => tr(`Skin {i}`, { i }))
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
        v = new Map(v.entries().filter(([ key ]) => byId.has(key)))
        if(v.size > 0) this.value = v
        return true
    }
}
