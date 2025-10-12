import type { AbortOptions } from "@libp2p/interface";
import type { Game } from "./game";
import type { LocalServer } from "./server";
import { show } from "./ui/remote";
import { Features, GameMap, GameMode, GameType, PlayerCount, TickRate } from "./utils/constants";

type Choice = { value: number, name: string }
const inq2gd = (choices: Choice[]) => choices.map(({ value: id, name: name }) => ({ id, name }))

export async function setup(game: Game, server: LocalServer, opts: Required<AbortOptions>){
    
    await server.loadSettings(opts)
    
    const view = show<void>('custom_game_setup', {
        gameName: game.name.toString(),
        password: game.password.toString(),
        tickRate: { choices: inq2gd(TickRate.choices), default: server.tickRate.value },
        teamSize: { choices: inq2gd(PlayerCount.choices), default: game.playersMax.value },
        gameMode: { choices: inq2gd(GameMode.choices), default: game.mode.value },
        gameMap: { choices: inq2gd(GameMap.choices), default: game.map.value },
        gameType: { choices: inq2gd(GameType.choices), default: game.type.value },
        manacosts: game.features.isManacostsEnabled,
        cooldowns: game.features.isCooldownsEnabled,
        minions: game.features.isMinionsEnabled,
        cheats: game.features.isCheatsEnabled,
    }, {
        'gameName': (value: string) => game.name.value = value,
        'password': (value: string) => game.password.value = value,
        'tickRate': (value: number) => server.tickRate.value = value,
        'teamSize': (value: number) => game.playersMax.value = value,
        'gameMode': (value: number) => game.mode.value = value,
        'gameMap': (value: number) => game.map.value = value,
        'gameType': (value: number) => game.type.value = value,
        'manacosts': (value: boolean) => game.features.set(Features.MANACOSTS_DISABLED, !value),
        'cooldowns': (value: boolean) => game.features.set(Features.COOLDOWNS_DISABLED, !value),
        'minions': (value: boolean) => game.features.set(Features.MINIONS_DISABLED, !value),
        'cheats': (value: boolean) => game.features.set(Features.CHEATS_ENABLED, value),
        'host': () => view.resolve(),
    }, opts)

    await view.promise

    await server.saveSettings(opts)
}