
import { PickableValue } from "./values/pickable"
import { enabled } from "./values/enabled"
import path from 'node:path'

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
    ["", "BattleCry", false],
    ["", "Boost", true],
    ["", "Clairvoyance", true],
    ["", "Dot", true],
    ["", "Fortify", true],
    ["", "Haste", true],
    ["", "Mana", true],
    ["", "Rally", true],
    ["", "Revive", true],
    ["", "Promote", false],
    ["", "OdinPromote", false],
    ["", "OdinSabotage", false],
    ["", "OdinGarrison", false],
    ["", "PromoteSR", false],
    ["", "Observer", false],
    ["", "ReviveSpeedBoost", false],
]

const spellIcons = [
    "SummonerObserver.dds",
    "SummonerMana.dds",
    "SummonerIgnite.dds",
    "SummonerGarrison.dds",
    "SummonerCleanse.dds",
    "Summoner_teleport.dds",
    "Summoner_suppression.dds",
    "Summoner_smite.dds",
    "Summoner_revive.dds",
    "Summoner_rally.dds",
    "Summoner_promote.dds",
    "Summoner_heal.dds",
    "Summoner_haste.dds",
    "Summoner_fortify.dds",
    "Summoner_flash.dds",
    "Summoner_Exhaust.dds",
    "Summoner_Clairvoyance.dds",
    "Summoner_Boost.dds",
]

const spellsDirRelative = path.join('%DATA%', 'Spells', 'Icons2D')

const spellsIconsCache = Object.fromEntries(
    spellIcons
    .map(fileName => {
        const m = /^Summoner_?(?<spell>.*)\.dds$/i.exec(fileName)
        const shortSpellName = m!.groups!.spell!.toLowerCase()
        const relativeIconPath = path.join(spellsDirRelative, fileName)
        return [ shortSpellName, relativeIconPath ]
    })
)

export const spells = spellsTable.map(([ , name, enabled ], i) => {
    const icon = spellsIconsCache[name.toLowerCase()]
    return { i, name, enabled, icon }
})

export class SummonerSpell extends PickableValue {
    public static readonly name = 'Summoner Spell'
    public static readonly values = spells.map(({ name }) => name)
    public static readonly choices = PickableValue.normalize(SummonerSpell.values)
}
export const SummonerSpellsEnabled = enabled(SummonerSpell)
