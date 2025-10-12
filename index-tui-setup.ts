import type { AbortOptions } from "@libp2p/interface";
import type { Game } from "./game";
import type { LocalServer } from "./server";
import { show } from "./ui/remote";
import { Features, GameMap, GameMode, GameType, PlayerCount, TickRate } from "./utils/constants";

type Choice = { value: number, name: string }
const inq2gd = (choices: Choice[]) => choices.map(({ value: id, name: text }) => ({ id, text }))

export async function setup(game: Game, server: LocalServer, opts: Required<AbortOptions>){
    
    await server.loadSettings(opts)
    
    const view = show<void>('CustomGameSetup', {
        GameName: { text: game.name.toString() },
        Password: { text: game.password.toString() },
        
        TickRate: { choices: inq2gd(TickRate.choices), selected: server.tickRate.value },
        TeamSize: { choices: inq2gd(PlayerCount.choices), selected: game.playersMax.value },
        
        GameMode: { choices: inq2gd(GameMode.choices), selected: game.mode.value },
        GameMap: { choices: inq2gd(GameMap.choices), selected: game.map.value },
        GameType: { choices: inq2gd(GameType.choices), selected: game.type.value },

        Manacosts: { button_pressed: game.features.isManacostsEnabled },
        Cooldowns: { button_pressed: game.features.isCooldownsEnabled },
        Minions: { button_pressed: game.features.isMinionsEnabled },
        Cheats: { button_pressed: game.features.isCheatsEnabled },
    }, {
        'GameName.changed': (value: string) => game.name.value = value,
        'Password.changed': (value: string) => game.password.value = value,
        
        'TickRate.item_selected': (value: number) => server.tickRate.value = value,
        'TeamSize.item_selected': (value: number) => game.playersMax.value = value,
        
        'GameMode.pressed': (value: number) => game.mode.value = value,
        'GameMap.pressed': (value: number) => game.map.value = value,
        'GameType.pressed': (value: number) => game.type.value = value,

        'Manacosts.toggled': (value: boolean) => game.features.set(Features.MANACOSTS_DISABLED, !value),
        'Cooldowns.toggled': (value: boolean) => game.features.set(Features.COOLDOWNS_DISABLED, !value),
        'Minions.toggled': (value: boolean) => game.features.set(Features.MINIONS_DISABLED, !value),
        'Cheats.toggled': (value: boolean) => game.features.set(Features.CHEATS_ENABLED, value),
        
        'Host.pressed': () => view.resolve(),
    }, opts)

    await view.promise

    await server.saveSettings(opts)
}