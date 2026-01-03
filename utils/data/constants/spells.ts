
import { PickableValue } from "./values/pickable"
import { enabled } from "./values/enabled"
import path from 'node:path'
import { tr } from "../../translation"

// short, name, enabled by default
const spellsTable: [string, string, boolean][] = [
    ["Heal", tr("Heal"), true],
    ["Ghost", tr("Ghost"), false],
    ["Barrier", tr("Barrier"), false],
    ["Exhaust", tr("Exhaust"), true],
    ["Mark", tr("Mark"), false],
    ["Dash", tr("Dash"), false],
    ["Clarity", tr("Clarity"), false],
    ["Flash", tr("Flash"), true],
    ["Teleport", tr("Teleport"), true],
    ["Smite", tr("Smite"), true],
    ["Cleanse", tr("Cleanse"), false],
    ["Ignite", tr("Ignite"), false],
    ["BattleCry", tr("BattleCry"), false],
    ["Boost", tr("Boost"), true],
    ["Clairvoyance", tr("Clairvoyance"), true],
    ["Dot", tr("Dot"), true],
    ["Fortify", tr("Fortify"), true],
    ["Haste", tr("Haste"), true],
    ["Mana", tr("Mana"), true],
    ["Rally", tr("Rally"), true],
    ["Revive", tr("Revive"), true],
    ["Promote", tr("Promote"), false],
    ["OdinPromote", tr("OdinPromote"), false],
    ["OdinSabotage", tr("OdinSabotage"), false],
    ["OdinGarrison", tr("OdinGarrison"), false],
    ["PromoteSR", tr("PromoteSR"), false],
    ["Observer", tr("Observer"), false],
    ["ReviveSpeedBoost", tr("ReviveSpeedBoost"), false],
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

export const spells = spellsTable.map(([ short, name, enabled ], i) => {
    const icon = spellsIconsCache[short.toLowerCase()]
    return { i, short, name, enabled, icon }
})

export class SummonerSpell extends PickableValue {
    public static readonly name = tr('Summoner Spell')
    public static readonly values = spells.map(({ short }) => short)
    public static readonly choices = spells.map(({ i, short, name }) => ({ value: i, short, name }))
}
export const SummonerSpellsEnabled = enabled(SummonerSpell)
