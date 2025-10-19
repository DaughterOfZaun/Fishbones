import type { Game } from "./game"
import type { GamePlayer } from "./game-player"
import type { Form } from "./ui/remote-types"

export interface Context {
    signal: AbortSignal,
    controller: AbortController,
    game: Game,
}

export enum Team { Blue, Purple }
export enum PlayerType { Player = 1, Bot = 2 }
export const PLAYERS = PlayerType.Player
export const BOTS = PlayerType.Bot

export const players = (game: Game, team: Team, type: PlayerType, makeForm: (player: GamePlayer) => Form) => {
    return Object.fromEntries(
        game.getPlayers()
        .filter(player => {
            return player.team.value == team
                && ((1 << (+player.isBot)) & type) != 0
        })
        .map(player => [ player.id, makeForm(player) ])
    )
}
