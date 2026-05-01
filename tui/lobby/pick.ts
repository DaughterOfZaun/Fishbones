import type { GamePlayer } from "../../game/game-player";
import { PLAYERS, BOTS, Team, type Context, players } from "./lobby";
import { base, button, form, icon, label, line, list, texture, type Button, type Form } from "../../ui/remote/types";
import { render } from "../../ui/remote/view";
import { combinations_find, KnownServers } from "../../utils/data/constants/client-server-combinations";
import { getBotName, getName } from "../../utils/namegen/namegen";
import { option_pages } from "../masteries";
import { page, pages } from "../masteries/pages";
import type { Game } from "../../game/game";
import { SwitchViewError } from "../tui";
import { sortInplace } from "../../utils/helpers";
//import { LocalGame } from "../../game/game-local";
import { tr } from "../../utils/translation";

function makePlayerForm(player: GamePlayer, game: Game): Form {
    
    //const localGame = game instanceof LocalGame ? game : undefined!
    //const game_serverVersion = localGame?.serverVersion ?? KnownServers.Unknown
    const game_serverVersion = KnownServers.Unknown
    const { champions, spells } = combinations_find(game.clientVersion, game_serverVersion)!

    const championInfo = (player.champion.value !== undefined) ? champions.get(player.champion.value) : undefined
    const championIcon = championInfo?.icon ?? ''
    const championName = championInfo?.name ?? ''

    const spellInfo1 = (player.spell1.value !== undefined) ? spells.get(player.spell1.value) : undefined
    const spellIcon1 = spellInfo1?.icon ?? ''
    const spellName1 = spellInfo1?.name ?? ''
    
    const spellInfo2 = (player.spell2.value !== undefined) ? spells.get(player.spell2.value) : undefined
    const spellIcon2 = spellInfo2?.icon ?? ''
    const spellName2 = spellInfo2?.name ?? ''

    const common = {
        Icon: icon(championIcon, championName),
        SummonerSpell1: icon(spellIcon1, spellName1),
        SummonerSpell2: icon(spellIcon2, spellName2),
    }

    if(!player.isBot){
        let username = player.name.value || (
            championName ?
                tr('Anonymous {champion}', { champion: championName }) :
                tr('Anonymous')
        )
        const isMe = game.getPlayer() === player
        const playerId = getName(player, isMe)
        return form({
            Username: label(username),
            Name: label(playerId),
            Status: label(championName),
            ...common,
        })
    } else {
        const playerId = getBotName(championName)
        const username = playerId
        return form({
            Username: label(username),
            Name: label(playerId),
            Status: label(championName),
            ...common,
        })
    }
}

export async function lobby_pick(ctx: Context){
    const { game } = ctx
    //const localGame = game instanceof LocalGame ? game : undefined!
    //const game_serverVersion = localGame?.serverVersion ?? KnownServers.Unknown
    const game_serverVersion = KnownServers.Unknown
    const { champions, spells } = combinations_find(game.clientVersion, game_serverVersion)!

    const championsItems = Object.fromEntries(
        sortInplace([...champions.values()], info => info.short, 'asc')
        .map(({ i, name, icon: icon_path }) => {
            const disabled = !game.champions.value.includes(i)
            return [ i, icon(icon_path, name, disabled) ]
        })
    )

    const summonerSpellsItems = Object.fromEntries(
        spells.values()
        .map(({ i, name, icon: iconPath }) => {
            const disabled = !game.spells.value.includes(i)
            return [i, icon(iconPath, name, disabled)]
        })
    )

    //HACK:
    game.set('talents', page.talents)

    const view = render('ChampionSelect', form({
        Team1: list(),
        Team2: list(),
        TabContainer: form({
            Champions: list(championsItems),
            ChampionsDisabled: base(false),
            Skins: list({}),
        }, {
            current_tab: 0,
        }),
        SearchBar: line('', (text) => {
            text = text.toLowerCase()
            const championsItems = Object.fromEntries(
                champions.values()
                .map(({ i, short, name }) => {
                    name = name.toLowerCase()
                    short = short.toLowerCase()
                    const visible = !text || short.includes(text) || name.includes(text)
                    return [ i, base(visible) ]
                })
            )
            view.get('TabContainer/Champions').update(list(championsItems))
        }),
        LockIn: button(() => {
            view.get('TabContainer').update(form({
                ChampionsDisabled: base(true),
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
                        champions.get(championIndex)!.skins.values()
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
                ChampionsDisabled: base(locked),
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
                ChampionsDisabled: base(false),
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
