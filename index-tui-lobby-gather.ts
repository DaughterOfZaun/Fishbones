import { LocalGame } from "./game-local";
import type { GamePlayer, PlayerId, PPP } from "./game-player";
import { SwitchViewError } from "./index-tui";
import { BOTS, players, PLAYERS, Team, type Context } from "./index-tui-lobby";
import { button, form, inq2gd, label, list, option, type Form } from "./ui/remote-types";
import { render } from "./ui/remote-view";
import { AIChampion, AIDifficulty } from "./utils/constants";

//export async function lobby(game: Game, opts: Required<AbortOptions>){}

export async function lobby_gather(ctx: Context){
    const { game } = ctx
    const localGame = game instanceof LocalGame ? game : undefined!

    const makePlayerForm = (player: GamePlayer): Form => {
        const playerId = player.id.toString(16).padStart(8, '0').slice(-8)
        const playerForm = (!player.isBot) ? form({
            Name: label(playerId),
            Kick: button(undefined, !localGame || localGame.getPlayer() === player),
        }) : form({
            Champion: option(inq2gd(AIChampion.choices), player.champion.value),
            Difficulty: option(inq2gd(AIDifficulty.choices), player.difficulty.value),
            Kick: button(undefined, !localGame),
        })
        return playerForm
    }
    
    const team = (team: Team) => form({
        Join: button(() => game.set('team', team), game.getPlayer()?.team.value == team),
        AddBot: button(() => localGame.addBot(team), !localGame),
        Players: list(players(game, team, PLAYERS, makePlayerForm)),
        Bots: list(players(game, team, BOTS, makePlayerForm)),
    })

    const view = render('GatheringLobby', form({
        Quit: button(() => view.reject(new SwitchViewError({ cause: null }))),
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
        view.get('Team1/Players').setItems(players(game, Team.Blue, PLAYERS, makePlayerForm))
        view.get('Team2/Players').setItems(players(game, Team.Purple, PLAYERS, makePlayerForm))
        view.get('Team1/Bots').setItems(players(game, Team.Blue, BOTS, makePlayerForm))
        view.get('Team2/Bots').setItems(players(game, Team.Purple, BOTS, makePlayerForm))
        view.get('Team1/Join').update(button(undefined, game.getPlayer()!.team.value == Team.Blue))
        view.get('Team2/Join').update(button(undefined, game.getPlayer()!.team.value == Team.Purple))
    })

    return view.promise
}