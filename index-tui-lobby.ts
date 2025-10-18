import type { Game } from "./game";
import { LocalGame } from "./game-local";
import type { PlayerId, PPP } from "./game-player";
import { AbortPromptError } from "./ui/remote";
import { button, form, inq2gd, label, list, option } from "./ui/remote-types";
import { render } from "./ui/remote-view";
import { AIChampion, AIDifficulty } from "./utils/constants";

//export async function lobby(game: Game, opts: Required<AbortOptions>){}

interface Context {
    signal: AbortSignal,
    controller: AbortController,
    game: Game,
}

enum Team { Blue, Purple }
enum PlayerType { Player, Bot }
const PLAYERS = PlayerType.Player
const BOTS = PlayerType.Bot

export async function lobby_gather(ctx: Context){
    const { game } = ctx
    const localGame = game instanceof LocalGame ? game : undefined!

    const players = (team: Team, type: PlayerType) => {
        return Object.fromEntries(
            game.getPlayers()
            .filter(player => {
                return player.team.value == team
                    && player.isBot == (type == BOTS)
            })
            .map(player => {
                const playerId = player.id.toString(16).padStart(8, '0').slice(-8)
                const playerForm = (!player.isBot) ? form({
                    Name: label(playerId),
                    Kick: button(undefined, !localGame || localGame.getPlayer() === player),
                }) : form({
                    Champion: option(inq2gd(AIChampion.choices), player.champion.value),
                    Difficulty: option(inq2gd(AIDifficulty.choices), player.difficulty.value),
                    Kick: button(undefined, !localGame),
                })
                return [ player.id, playerForm ]
            })
        )
    }
    
    const team = (team: Team) => form({
        Join: button(() => game.set('team', team), game.getPlayer()?.team.value == team),
        AddBot: button(() => localGame.addBot(team), !localGame),
        Players: list(players(team, PLAYERS)),
        Bots: list(players(team, BOTS)),
    })

    const view = render('GatheringLobby', form({
        Quit: button(() => view.reject(new AbortPromptError({ cause: null }))),
        Start: button(() => localGame.start(), !localGame),
        Autofill: button(() => {}, !localGame),
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

    view.addEventListener(game, 'update', () => {
        view.get('Team1/Players').setItems(players(Team.Blue, PLAYERS))
        view.get('Team2/Players').setItems(players(Team.Purple, PLAYERS))
        view.get('Team1/Bots').setItems(players(Team.Blue, BOTS))
        view.get('Team2/Bots').setItems(players(Team.Purple, BOTS))
        view.get('Team1/Join').update(button(undefined, game.getPlayer()!.team.value == Team.Blue))
        view.get('Team2/Join').update(button(undefined, game.getPlayer()!.team.value == Team.Purple))
    })

    return view.promise
}