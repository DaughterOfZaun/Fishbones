import type { GamePlayer } from "../../game/game-player";
import { PLAYERS, BOTS, Team, type Context, players } from "./lobby";
import { button, form, icon, label, list, type Form } from "../../ui/remote/types";
import { render } from "../../ui/remote/view";
import { Champion, champions, spells, SummonerSpell } from "../../utils/constants";
import { gcPkg } from "../../utils/data/packages";
import { getBotName, getPseudonym } from "../../utils/namegen/namegen";

export async function lobby_pick(ctx: Context){
    const { game } = ctx

    const makePlayerForm = (player: GamePlayer): Form => {
        
        const championInfo = (player.champion.value !== undefined) ? champions[player.champion.value]! : undefined
        const relativeChampionIconPath = championInfo?.short ? gcPkg.getRelativeChampionIconPath(championInfo.short) ?? '' : ''
        const championName = championInfo?.name ?? ''

        const spellName1 = (player.spell1.value !== undefined) ? spells[player.spell1.value]!.name : ''
        const relativeSpellIconPath1 = spellName1 ? gcPkg.getRelativeSummonerSpellIconPath(spellName1) ?? '' : ''
        
        const spellName2 = (player.spell2.value !== undefined) ? spells[player.spell2.value]!.name : ''
        const relativeSpellIconPath2 = spellName2 ? gcPkg.getRelativeSummonerSpellIconPath(spellName2) ?? '' : ''
        
        const isMe = game.getPlayer() === player
        const playerId = player.isBot ? getBotName(championName) : getPseudonym(player.id, isMe)
        //const statusText = (player.lock.value || player.isBot) ? 'Locked' : 'Chooses...'

        return form({
            Name: label(playerId),
            Status: label(championName),
            Icon: icon(relativeChampionIconPath, championName),
            SummonerSpell1: icon(relativeSpellIconPath1, spellName1),
            SummonerSpell2: icon(relativeSpellIconPath2, spellName2),
        })
    }

    const championsItems = Object.fromEntries(
        Champion.choices
        .map(({ name, short }, i) => {
            const relativeIconPath = gcPkg.getRelativeChampionIconPath(short) ?? ''
            const disabled = (!game.server.champions.value.includes(i)) ? true : undefined
            return { i, name, relativeIconPath, disabled }
        })
        //.filter(info => info.relativeIconPath)
        .map(({ i, name, relativeIconPath, disabled }) => {
            return [ i, icon(relativeIconPath, name, disabled) ]
        })
    )

    const summonerSpellsItems = Object.fromEntries(
        SummonerSpell.choices
        .map(({ name }, i) => {
            const relativeIconPath = gcPkg.getRelativeSummonerSpellIconPath(name) ?? ''
            const disabled = (!game.server.spells.value.includes(i)) ? true : undefined
            return { i, name, relativeIconPath, disabled }
        })
        //.filter((info) => info.relativeIconPath)
        .map(({ i, name, relativeIconPath, disabled }) => {
            return [i, icon(relativeIconPath, name, disabled)]
        })
    )

    const view = render('ChampionSelect', form({
        Team1: list(),
        Team2: list(),
        LockIn: button(() => game.set('lock', +true)),
        Champions: list(championsItems),
        SummonerSpell1: list(summonerSpellsItems),
        SummonerSpell2: list(summonerSpellsItems),
    }), ctx, [
        {
            regex: /\.\/Champions\/(?<championIndex>\d+):pressed/,
            listener: (m) => {
                const championIndex = parseInt(m.groups!.championIndex!)
                game.set('champion', championIndex)
            }
        },
        {
            regex: /\.\/SummonerSpell(?<spellNumber>\d+)\/(?<spellIndex>\d+):pressed/,
            listener: (m) => {
                const spellIndex = parseInt(m.groups!.spellIndex!)
                const spellNumber = m.groups!.spellNumber!
                const prop = ('spell' + spellNumber) as ('spell1' | 'spell2')
                game.set(prop, spellIndex)
            }
        },
    ])

    updateDynamicElements()
    view.addEventListener(game, 'update', updateDynamicElements)
    function updateDynamicElements(){
        view.get('Team1').setItems(players(game, Team.Blue, PLAYERS | BOTS, makePlayerForm))
        view.get('Team2').setItems(players(game, Team.Purple, PLAYERS | BOTS, makePlayerForm))
        view.get('LockIn').update(button(undefined, !!game.getPlayer()!.lock.value))
    }

    return view.promise
}