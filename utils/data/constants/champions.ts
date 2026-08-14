import { PickableValue } from "./values/pickable"
import { enabled } from "./values/enabled"
import { ValueDesc } from "./values/desc"
import { byId } from "../../../tui/masteries/trees"
import { tr } from "../../translation"

export const champions = [
    { i: 0, short: "Alistar", name: "Alistar" },
    { i: 1, short: "Annie", name: "Annie" },
    { i: 2, short: "Ashe", name: "Ashe" },
    { i: 3, short: "FiddleSticks", name: "Fiddlesticks" },
    { i: 4, short: "Jax", name: "Jax" },
    { i: 5, short: "Kayle", name: "Kayle" },
    { i: 6, short: "MasterYi", name: "Master Yi" },
    { i: 7, short: "Morgana", name: "Morgana" },
    { i: 8, short: "Nunu", name: "Nunu & Willump" },
    { i: 9, short: "Ryze", name: "Ryze" },
    { i: 10, short: "Sion", name: "Sion" },
    { i: 11, short: "Sivir", name: "Sivir" },
    { i: 12, short: "Soraka", name: "Soraka" },
    { i: 13, short: "Teemo", name: "Teemo" },
    { i: 14, short: "Tristana", name: "Tristana" },
    { i: 15, short: "TwistedFate", name: "Twisted Fate" },
    { i: 16, short: "Warwick", name: "Warwick" },
    { i: 17, short: "Singed", name: "Singed" },
    { i: 18, short: "Zilean", name: "Zilean" },
    { i: 19, short: "Evelynn", name: "Evelynn" },
    { i: 20, short: "Tryndamere", name: "Tryndamere" },
    { i: 21, short: "Twitch", name: "Twitch" },
    { i: 22, short: "Karthus", name: "Karthus" },
    { i: 23, short: "Amumu", name: "Amumu" },
    { i: 24, short: "Chogath", name: "Cho'Gath" },
    { i: 25, short: "Anivia", name: "Anivia" },
    { i: 26, short: "Rammus", name: "Rammus" },
    { i: 27, short: "Veigar", name: "Veigar" },
    { i: 28, short: "Kassadin", name: "Kassadin" },
    { i: 29, short: "Gangplank", name: "Gangplank" },
    { i: 30, short: "Taric", name: "Taric" },
    { i: 31, short: "Blitzcrank", name: "Blitzcrank" },
    { i: 32, short: "DrMundo", name: "Dr. Mundo" },
    { i: 33, short: "Janna", name: "Janna" },
    { i: 34, short: "Malphite", name: "Malphite" },
    { i: 35, short: "Corki", name: "Corki" },
    { i: 36, short: "Katarina", name: "Katarina" },
    { i: 37, short: "Nasus", name: "Nasus" },
    { i: 38, short: "Heimerdinger", name: "Heimerdinger" },
    { i: 39, short: "Shaco", name: "Shaco" },
    { i: 40, short: "Udyr", name: "Udyr" },
    { i: 41, short: "Nidalee", name: "Nidalee" },
    { i: 42, short: "Poppy", name: "Poppy" },
    { i: 43, short: "Gragas", name: "Gragas" },
    { i: 44, short: "Pantheon", name: "Pantheon" },
    { i: 45, short: "Mordekaiser", name: "Mordekaiser" },
    { i: 46, short: "Ezreal", name: "Ezreal" },
    { i: 47, short: "Shen", name: "Shen" },
    { i: 48, short: "Kennen", name: "Kennen" },
    { i: 49, short: "Garen", name: "Garen" },
    { i: 50, short: "Akali", name: "Akali" },
    { i: 51, short: "Malzahar", name: "Malzahar" },
    { i: 52, short: "Olaf", name: "Olaf" },
    { i: 53, short: "KogMaw", name: "Kog'Maw" },
    { i: 54, short: "XinZhao", name: "Xin Zhao" },
    { i: 55, short: "Vladimir", name: "Vladimir" },
    { i: 56, short: "Galio", name: "Galio" },
    { i: 57, short: "Urgot", name: "Urgot" },
    { i: 58, short: "MissFortune", name: "Miss Fortune" },
    { i: 59, short: "Sona", name: "Sona" },
    { i: 60, short: "Swain", name: "Swain" },
    { i: 61, short: "Lux", name: "Lux" },
    { i: 62, short: "Leblanc", name: "LeBlanc" },
    { i: 63, short: "Irelia", name: "Irelia" },
    { i: 64, short: "Trundle", name: "Trundle" },
    { i: 65, short: "Cassiopeia", name: "Cassiopeia" },
    { i: 66, short: "Caitlyn", name: "Caitlyn" },
    { i: 67, short: "Renekton", name: "Renekton" },
    { i: 68, short: "Karma", name: "Karma" },
    { i: 69, short: "Maokai", name: "Maokai" },
    { i: 70, short: "JarvanIV", name: "Jarvan IV" },
    { i: 71, short: "Nocturne", name: "Nocturne" },
    { i: 72, short: "LeeSin", name: "Lee Sin" },
    { i: 73, short: "Brand", name: "Brand" },
    { i: 74, short: "Rumble", name: "Rumble" },
    { i: 75, short: "Vayne", name: "Vayne" },
    { i: 76, short: "Orianna", name: "Orianna" },
    { i: 77, short: "Yorick", name: "Yorick" },
    { i: 78, short: "Leona", name: "Leona" },
    { i: 79, short: "MonkeyKing", name: "Wukong" },
    { i: 80, short: "Skarner", name: "Skarner" },
    { i: 81, short: "Talon", name: "Talon" },
    { i: 82, short: "Riven", name: "Riven" },
    { i: 83, short: "Xerath", name: "Xerath" },
    { i: 84, short: "Graves", name: "Graves" },
    { i: 85, short: "Shyvana", name: "Shyvana" },
    { i: 86, short: "Fizz", name: "Fizz" },
    { i: 87, short: "Volibear", name: "Volibear" },
    { i: 88, short: "Ahri", name: "Ahri" },
    { i: 89, short: "Viktor", name: "Viktor" },
    { i: 90, short: "Sejuani", name: "Sejuani" },
    { i: 91, short: "Ziggs", name: "Ziggs" },
    { i: 92, short: "Nautilus", name: "Nautilus" },
    { i: 93, short: "Fiora", name: "Fiora" },
    { i: 94, short: "Lulu", name: "Lulu" },
    { i: 95, short: "Hecarim", name: "Hecarim" },
    { i: 96, short: "Varus", name: "Varus" },
    { i: 97, short: "Darius", name: "Darius" },
    { i: 98, short: "Draven", name: "Draven" },
    { i: 99, short: "Jayce", name: "Jayce" },
    { i: 100, short: "Zyra", name: "Zyra" },
    { i: 101, short: "Diana", name: "Diana" },
    { i: 102, short: "Rengar", name: "Rengar" },
    { i: 103, short: "Syndra", name: "Syndra" },
    { i: 104, short: "Khazix", name: "Kha'Zix" },
    { i: 105, short: "Elise", name: "Elise" },
    { i: 106, short: "Zed", name: "Zed" },
    { i: 107, short: "Nami", name: "Nami" },
    { i: 108, short: "Vi", name: "Vi" },
    { i: 109, short: "Thresh", name: "Thresh" },
    { i: 110, short: "Quinn", name: "Quinn" },
    { i: 111, short: "Zac", name: "Zac" },
    { i: 112, short: "Lissandra", name: "Lissandra" },
    { i: 113, short: "Aatrox", name: "Aatrox" },
    { i: 114, short: "Lucian", name: "Lucian" },
    { i: 115, short: "Jinx", name: "Jinx" },
    { i: 116, short: "Yasuo", name: "Yasuo" },
    { i: 117, short: "Velkoz", name: "Vel'Koz" },
    { i: 118, short: "Braum", name: "Braum" },
    { i: 119, short: "Gnar", name: "Gnar" },
    { i: 120, short: "Azir", name: "Azir" },
    { i: 121, short: "Kalista", name: "Kalista" },
    { i: 122, short: "RekSai", name: "Rek'Sai" },
    { i: 123, short: "Bard", name: "Bard" },
    { i: 124, short: "Ekko", name: "Ekko" },
    { i: 125, short: "TahmKench", name: "Tahm Kench" },
    { i: 126, short: "Kindred", name: "Kindred" },
    { i: 127, short: "Illaoi", name: "Illaoi" },
    { i: 128, short: "Jhin", name: "Jhin" },
    { i: 129, short: "AurelionSol", name: "Aurelion Sol" },
    { i: 130, short: "Taliyah", name: "Taliyah" },
    { i: 131, short: "Kled", name: "Kled" },
    { i: 132, short: "Ivern", name: "Ivern" },
    { i: 133, short: "Camille", name: "Camille" },
    { i: 134, short: "Rakan", name: "Rakan" },
    { i: 135, short: "Xayah", name: "Xayah" },
    { i: 136, short: "Kayn", name: "Kayn" },
    { i: 137, short: "Ornn", name: "Ornn" },
    { i: 138, short: "Zoe", name: "Zoe" },
    { i: 139, short: "KaiSa", name: "Kai'Sa" },
    { i: 140, short: "Pyke", name: "Pyke" },
    { i: 141, short: "Neeko", name: "Neeko" },
    { i: 142, short: "Sylas", name: "Sylas" },
    { i: 143, short: "Yuumi", name: "Yuumi" },
    { i: 144, short: "Qiyana", name: "Qiyana" },
    { i: 145, short: "Senna", name: "Senna" },
    { i: 146, short: "Aphelios", name: "Aphelios" },
    { i: 147, short: "Sett", name: "Sett" },
    { i: 148, short: "Lillia", name: "Lillia" },
    { i: 149, short: "Yone", name: "Yone" },
    { i: 150, short: "Samira", name: "Samira" },
    { i: 151, short: "Seraphine", name: "Seraphine" },
    { i: 152, short: "Rell", name: "Rell" },
    { i: 153, short: "Viego", name: "Viego" },
    { i: 154, short: "Gwen", name: "Gwen" },
    { i: 155, short: "Akshan", name: "Akshan" },
    { i: 156, short: "Vex", name: "Vex" },
    { i: 157, short: "Zeri", name: "Zeri" },
    { i: 158, short: "RenataGlasc", name: "Renata Glasc" },
    { i: 159, short: "BelVeth", name: "Bel'Veth" },
    { i: 160, short: "Nilah", name: "Nilah" },
    { i: 161, short: "KSante", name: "K'Sante" },
    { i: 162, short: "Milio", name: "Milio" },
    { i: 163, short: "Naafiri", name: "Naafiri" },
    { i: 164, short: "Briar", name: "Briar" },
    { i: 165, short: "Hwei", name: "Hwei" },
    { i: 166, short: "Smolder", name: "Smolder" },
    { i: 167, short: "Aurora", name: "Aurora" },
    { i: 168, short: "Ambessa", name: "Ambessa" },
    { i: 169, short: "Mel", name: "Mel"},
    { i: 170, short: "Armordillo", name: "Armordillo" },
    { i: 171, short: "Armsmaster", name: "Jax" },
    { i: 172, short: "Bowmaster", name: "Ashe" },
    { i: 173, short: "CardMaster", name: "Twisted Fate" },
    { i: 174, short: "ChemicalMan", name: "Singed" },
    { i: 175, short: "Chronokeeper", name: "Zilean" },
    { i: 176, short: "Cryophoenix", name: "Anivia" },
    { i: 177, short: "DarkChampion", name: "Tryndamere" },
    { i: 178, short: "FallenAngel", name: "Morgana" },
    { i: 179, short: "GemKnight", name: "Taric" },
    { i: 180, short: "GreenTerror", name: "Cho'Gath" },
    { i: 181, short: "Jester", name: "Shaco" },
    { i: 182, short: "Judicator", name: "Kayle" },
    { i: 183, short: "Lich", name: "Karthus" },
    { i: 184, short: "Minotaur", name: "Alistar" },
    { i: 185, short: "Permission", name: "Veigar" },
    { i: 186, short: "Pirate", name: "Gangplank" },
    { i: 187, short: "SadMummy", name: "Amumu" },
    { i: 188, short: "Voidwalker", name: "Kassadin" },
    { i: 189, short: "Wolfman", name: "Warwick" },
    { i: 190, short: "Yeti", name: "Nunu & Willump" },
]

export class Champion extends PickableValue { 
    public static readonly name = tr('Champion')
    public static readonly values = champions.map(({ short }) => short)
    public static readonly choices = champions.map(({ i, short, name }) => ({ value: i, short, name }))
}
export const ChampionsEnabled = enabled(Champion)

const bots = champions //.filter(({ hasBT }) => hasBT)
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
    public static readonly choices = Skin.values.map(i => tr(`Skin { i}`, { i }))
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
