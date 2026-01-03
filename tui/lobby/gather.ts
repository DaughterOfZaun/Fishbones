import { LocalGame } from "../../game/game-local";
import type { GamePlayer, PlayerId, PPP } from "../../game/game-player";
import { SwitchViewError } from "../tui";
import { BOTS, players, PLAYERS, Team, type Context } from "./lobby";
import { button, checkbox, form, icon, inq2gd, label, option, type Form } from "../../ui/remote/types";
import { render } from "../../ui/remote/view";
import { champions, AIChampion, AIDifficulty } from "../../utils/data/constants/champions";
import { getName } from "../../utils/namegen/namegen";
import { popup } from "../../ui/remote/remote";
import { mapsById } from "../../utils/data/constants/maps";
import { tr } from "../../utils/translation";

//export async function lobby(game: Game, opts: Required<AbortOptions>){}

export async function lobby_gather(ctx: Context){
    const { game } = ctx
    const localGame = game instanceof LocalGame ? game : undefined!

    const mapInfo = mapsById.get(game.map.value!)!

    const makePlayerForm = (player: GamePlayer): Form => {

        const { name: championName, icon: iconPath } =
            (player.champion.value !== undefined) ?
                champions[player.champion.value]! : {}

        if(!player.isBot){
            const isMe = game.getPlayer() === player
            const playerId = getName(player, isMe)
            return form({
                Name: label(playerId),
                Icon: icon(iconPath, championName),
                Kick: button(undefined, !localGame || isMe),
                Online: checkbox(player.fullyConnected.value),
            })
        } else {
            return form({
                Icon: icon(iconPath, championName),
                Champion: option(inq2gd(AIChampion.choices, mapInfo.bots), player.champion.value, undefined, !localGame),
                Difficulty: option(inq2gd(AIDifficulty.choices), player.difficulty.value, undefined, !localGame),
                Kick: button(undefined, !localGame),
            })
        }
    }

    const team = (team: Team) => form({
        Join: button(() => game.set('team', team), game.getPlayer()?.team.value == team),
        AddBot: button(() => localGame.addBot(team), !localGame || mapInfo.bots.length === 0),
        //Players: list(players(game, team, PLAYERS, makePlayerForm)),
        //Bots: list(players(game, team, BOTS, makePlayerForm)),
    })

    const view = render('GatheringLobby', form({
        Quit: button(() => view.reject(new SwitchViewError({ cause: null }))),
        Start: button(() => localGame.start(), !localGame || !game.areAllPlayersFullyConnected()),
        Explanation: { $type: 'base', visible: false },
        Autofill: button(autofill, !localGame || mapInfo.bots.length === 0),
        Team1: team(0),
        Team2: team(1),
    }), ctx, [
        {
            regex: /\.\/Team(?<team>\d+)\/(?<type>Player|Bot)s\/(?<playerId>\d+)\/Kick:pressed/,
            listener: (m) => {
                //const team = parseInt(m.groups!.team!)
                const playerId = parseInt(m.groups!.playerId!) as PlayerId
                localGame.kick(localGame.getPlayer(playerId)!)
            }
        },
        {
            regex: /\.\/Team(?<team>\d+)\/Bots\/(?<playerId>\d+)\/(?<prop>Champion|Difficulty):selected/,
            listener: (m, index: number) => {
                //const team = parseInt(m.groups!.team!)
                const prop: PPP =
                    (m.groups!.prop! === 'Champion') ? 'champion' :
                    (m.groups!.prop! === 'Difficulty') ? 'difficulty' :
                    undefined!
                const playerId = parseInt(m.groups!.playerId!) as PlayerId
                localGame.setBot(prop, index, playerId)
            }
        }
    ])

    updateDynamicElements()
    view.addEventListener(game, 'update', updateDynamicElements)
    function updateDynamicElements(){
        const allPlayersAreFullyConnected = !game.areAllPlayersFullyConnected()
        view.get('Team1/Players').setItems(players(game, Team.Blue, PLAYERS, makePlayerForm))
        view.get('Team2/Players').setItems(players(game, Team.Purple, PLAYERS, makePlayerForm))
        view.get('Team1/Bots').setItems(players(game, Team.Blue, BOTS, makePlayerForm))
        view.get('Team2/Bots').setItems(players(game, Team.Purple, BOTS, makePlayerForm))
        view.get('Team1/Join').update(button(undefined, game.getPlayer()?.team.value == Team.Blue))
        view.get('Team2/Join').update(button(undefined, game.getPlayer()?.team.value == Team.Purple))
        view.get('Start').update(button(undefined, !localGame || allPlayersAreFullyConnected))
        view.get('Explanation').update({ $type: 'base', visible: allPlayersAreFullyConnected },)
    }

    view.addEventListener(game, 'joined', notifyPlayerJoined)
    function notifyPlayerJoined(event: CustomEvent<GamePlayer>){
        const player = event.detail
        popup({
            message: getName(player, false),
            title: tr('New player joined'),
            sound: 'join_chat',
        })
    }

    function autofill(){
        const teams = [ Team.Blue, Team.Purple ]
        const players = game.getPlayers()
        const playerCounts = teams.map(team => players.filter(player => player.team.value == team).length)
        const playersMax = Math.max(...playerCounts, game.playersMax.value ?? 0)
        const countsToAdd = playerCounts.map(playersCount => Math.max(0, playersMax - playersCount))
        localGame.addBots(countsToAdd)
    }

    return view.promise
}
