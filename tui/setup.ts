import type { AbortOptions } from "@libp2p/interface";
import type { Game } from "../game/game";
import type { LocalServer } from "../game/server";
import { render } from "../ui/remote/view";
import { Features, GameType, PlayerCount, TickRate } from "../utils/constants";
import { GameMode } from "../utils/data/constants/modes";
import { GameMap, mapsById, mapsEnabled } from "../utils/data/constants/maps";
import { button, checkbox, form, inq2gd, line, option } from "../ui/remote/types";
import { AbortPromptError } from "@inquirer/core";

export async function setup(game: Game, server: LocalServer, opts: Required<AbortOptions>){
    
    server.loadSettings()
    
    const gameMode = () => {
        const info = mapsById.get(game.map.value!)!
        return option(
            inq2gd(GameMode.choices, info.modes),
            game.mode.value,
            value => game.mode.value = value,
        )
    }
    
    const view = render('CustomGameSetup', form({
        GameName: line(game.name.value, value => game.name.value = value),
        Password: line(game.password.value ?? '', value => game.password.value = value),
        
        TickRate: option(inq2gd(TickRate.choices), server.tickRate.value, value => server.tickRate.value = value),
        TeamSize: option(inq2gd(PlayerCount.choices), game.playersMax.value, value => game.playersMax.value = value),
        
        GameMode: gameMode(),
        GameMap: option(inq2gd(GameMap.choices, mapsEnabled), game.map.value, value => {
            const info = mapsById.get(value)!
            game.map.value = value
            game.mode.value = info.modes[0]
            view.get('GameMode').update(gameMode())
        }),
        GameType: option(inq2gd(GameType.choices), game.type.value, value => game.type.value = value),

        Manacosts: checkbox(game.features.isManacostsEnabled, value => game.features.set(Features.MANACOSTS_DISABLED, !value)),
        Cooldowns: checkbox(game.features.isCooldownsEnabled, value => game.features.set(Features.COOLDOWNS_DISABLED, !value)),
        Minions: checkbox(game.features.isMinionsEnabled, value => game.features.set(Features.MINIONS_DISABLED, !value)),
        Cheats: checkbox(game.features.isCheatsEnabled, value => game.features.set(Features.CHEATS_ENABLED, value)),
        HalfPing: checkbox(game.features.isHalfPingEnabled, value => game.features.set(Features.HALF_PING_MODE_ENABLED, value)),
        Firewall: checkbox(game.features.isFirewallEnabled, value => game.features.set(Features.FIREWALL_ENABLED, value)),
        Bypass: checkbox(game.features.isBypassEnabled, value => game.features.set(Features.BYPASS_ENABLED, value)),
        
        Champions: button(() => { server.champions.uinput(opts).catch(() => { /* Ignore */ }) }),
        SummonerSpells: button(() => { server.spells.uinput(opts).catch(() => { /* Ignore */ }) }),

        Host: button(() => view.resolve()),
        Quit: button(() => view.reject(new AbortPromptError()))
    }), opts)

    await view.promise

    server.saveSettings()
}
