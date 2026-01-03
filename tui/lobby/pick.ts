import type { GamePlayer } from "../../game/game-player";
import { PLAYERS, BOTS, Team, type Context, players } from "./lobby";
import { button, form, icon, label, list, texture, type Button, type Form } from "../../ui/remote/types";
import { render } from "../../ui/remote/view";
import { Champion, champions } from "../../utils/data/constants/champions";
import { spells, SummonerSpell } from "../../utils/data/constants/spells";
import { getBotName, getName } from "../../utils/namegen/namegen";
import { option_pages } from "../masteries";
import { page, pages } from "../masteries/pages";
import type { Game } from "../../game/game";
import { SwitchViewError } from "../tui";

function makePlayerForm(player: GamePlayer, game: Game): Form {
        
    const championInfo = (player.champion.value !== undefined) ? champions[player.champion.value]! : undefined
    const relativeChampionIconPath = championInfo?.icon ?? ''
    const championName = championInfo?.name ?? ''

    const spellInfo1 = (player.spell1.value !== undefined) ? spells[player.spell1.value] : undefined
    const relativeSpellIconPath1 = spellInfo1?.icon ?? ''
    const spellName1 = spellInfo1?.name ?? ''
    
    const spellInfo2 = (player.spell2.value !== undefined) ? spells[player.spell2.value] : undefined
    const relativeSpellIconPath2 = spellInfo2?.icon ?? ''
    const spellName2 = spellInfo2?.name ?? ''
    
    const isMe = game.getPlayer() === player
    const playerId = player.isBot ? getBotName(championName) : getName(player, isMe)
    //const statusText = (player.lock.value || player.isBot) ? 'Locked' : 'Chooses...'

    return form({
        Name: label(playerId),
        Status: label(championName),
        Icon: icon(relativeChampionIconPath, championName),
        SummonerSpell1: icon(relativeSpellIconPath1, spellName1),
        SummonerSpell2: icon(relativeSpellIconPath2, spellName2),
    })
}

export async function lobby_pick(ctx: Context){
    const { game } = ctx

    const championsItems = Object.fromEntries(
        Champion.choices
        .map(({ name, value }, i) => {
            const relativeIconPath = champions[value]?.icon
            const disabled = !game.server.champions.value.includes(i)
            return { i, name, relativeIconPath, disabled }
        })
        .filter(info => info.relativeIconPath)
        .map(({ i, name, relativeIconPath, disabled }) => {
            return [ i, icon(relativeIconPath, name, disabled) ]
        })
    )

    const summonerSpellsItems = Object.fromEntries(
        SummonerSpell.choices
        .map(({ name, value }, i) => {
            const relativeIconPath = spells[value]?.icon
            const disabled = !game.server.spells.value.includes(i)
            return { i, name, relativeIconPath, disabled }
        })
        .filter((info) => info.relativeIconPath)
        .map(({ i, name, relativeIconPath, disabled }) => {
            return [i, icon(relativeIconPath, name, disabled)]
        })
    )

    //HACK:
    game.set('talents', page.talents)

    const view = render('ChampionSelect', form({
        Team1: list(),
        Team2: list(),
        TabContainer: form({
            Champions: list(championsItems),
            ChampionsDisabled: { $type: 'base', visible: false },
            Skins: list({}),
        }, {
            current_tab: 0,
        }),
        LockIn: button(() => {
            view.get('TabContainer').update(form({
                ChampionsDisabled: { $type: 'base', visible: true },
            }, {
                current_tab: 1,
            }))
            game.set('lock', +true)
        }),
        SummonerSpell1: list(summonerSpellsItems),
        SummonerSpell2: list(summonerSpellsItems),
        Pages: option_pages((index) => {
            const page = pages.get(index)!
            game.set('talents', page.talents)
        }),
        Quit: button(() => {
            view.reject(new SwitchViewError({ cause: null }))
        }),
    }), ctx, [
        {
            regex: /\.\/TabContainer\/Champions\/(?<championIndex>\d+):pressed/,
            listener: (m) => {
                const championIndex = parseInt(m.groups!.championIndex!)
                game.set('champion', championIndex)

                view.get('TabContainer/Skins').setItems(
                    Object.fromEntries(
                        champions[championIndex]!.skins
                        .map(({ i, image }) => {
                            const skinForm = form({
                                Texture: texture(image)
                            })
                            return [ i, skinForm ]
                        })
                    )
                )
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
        {
            regex: /\.\/TabContainer\/Skins\/(?<skinIndex>\d+)\/Button:pressed/,
            listener: (m) => {
                const skinIndex = parseInt(m.groups!.skinIndex!)
                game.set('skin', skinIndex)
            }
        },
    ])

    updateDynamicElements()
    view.addEventListener(game, 'update', updateDynamicElements)
    function updateDynamicElements(){
        const locked = !!game.getPlayer()!.lock.value
        view.get('Team1').setItems(players(game, Team.Blue, PLAYERS | BOTS, makePlayerForm))
        view.get('Team2').setItems(players(game, Team.Purple, PLAYERS | BOTS, makePlayerForm))
        view.update(form({
            TabContainer: form({
                ChampionsDisabled: { $type: 'base', visible: locked },
            }),
            LockIn: button(undefined, locked),
        }))
    }

    view.addCleanupCallback(() => {
        const player = game.getPlayer()
        const championIndex = player?.champion.value ?? 0
        const spellIndex1 = player?.spell1.value ?? 0
        const spellIndex2 = player?.spell2.value ?? 0
        const unpressed: Button = { $type: 'button', button_pressed: false }
        view.update(form({
            TabContainer: form({
                ChampionsDisabled: { $type: 'base', visible: false },
                Champions: list({ [championIndex]: unpressed }),
            }, {
                current_tab: 0,
            }),
            SummonerSpell1: list({ [spellIndex1]: unpressed }),
            SummonerSpell2: list({ [spellIndex2]: unpressed }),
        }))
    })

    return view.promise
}
