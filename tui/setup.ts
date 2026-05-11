import type { AbortOptions } from "@libp2p/interface";
import { args } from "../utils/args";
import type { LocalGame } from "../game/game-local";
import { render } from "../ui/remote/view";
import { Features, PlayerCount, TickRate } from "../utils/constants";
import { button, checkbox, form, inq2gd, line, option } from "../ui/remote/types";
import { AbortPromptError } from "@inquirer/core";
import { combinations, KnownClients, KnownServers, type Combination } from "../utils/data/constants/client-server-combinations";
import { champions } from "../utils/data/constants/champions";
import { spells } from "../utils/data/constants/spells";

export async function setup(game: LocalGame, opts: Required<AbortOptions>){
    
    game.features.set(Features.SPELLS_DISABLED, args.spellCrashDetected.value)
    game.features.set(Features.BYPASS_ENABLED, true)

    let index = 0
    let combo: Combination = undefined!

    setCombo(index)
    function setCombo(index: number){
        combo = combinations[index]!
        let map = combo.maps.get(4) //HACK: Twisted Treeline.
            map ??= [...combo.maps.values()][0]!
        const mode = [...map.modes.values()][0]!
        game.map.value = map.i
        game.mode.value = mode.i
        game.serverVersion = combo.server.version
        game.clientVersion = combo.client.version
        return combo
    }

    const gameMap = (cb?: (index: number) => void) => {
        const options = [...combo.maps.values()].map(({ i, name }) => ({ id: i, text: name }))
        return option(options, game.map.value, cb)
    }

    const gameMode = (cb?: (index: number) => void) => {
        const map = combo.maps.get(game.map.value!)!
        const options = [...map.modes.values()].map(({ i, name }) => ({ id: i, text: name }))
        return option(options, game.mode.value, cb)
    }

    const view = render('CustomGameSetup', form({
        GameName: line(game.name.value, value => game.name.value = value),
        Password: line(game.password.value ?? '', value => game.password.value = value),
        
        TickRate: option(inq2gd(TickRate.choices), game.tickRate.value, value => game.tickRate.value = value),
        TeamSize: option(inq2gd(PlayerCount.choices), game.playersMax.value, value => game.playersMax.value = value),
        
        //GameType: option(inq2gd(GameType.choices), game.type.value, value => game.type.value = value),
        GameMode: gameMode(value => game.mode.value = value),
        GameMap: gameMap(value => {
            const map = combo.maps.get(value)!
            const mode = [...map.modes.values()][0]!
            game.map.value = map.i
            game.mode.value = mode.i
            view.update(form({
                GameMode: gameMode(),
            }))
        }),

        Manacosts: checkbox(game.features.isManacostsEnabled, value => game.features.set(Features.MANACOSTS_DISABLED, !value)),
        Cooldowns: checkbox(game.features.isCooldownsEnabled, value => game.features.set(Features.COOLDOWNS_DISABLED, !value)),
        Minions: checkbox(game.features.isMinionsEnabled, value => game.features.set(Features.MINIONS_DISABLED, !value)),
        Cheats: checkbox(game.features.isCheatsEnabled, value => game.features.set(Features.CHEATS_ENABLED, value)),
        HalfPing: checkbox(game.features.isHalfPingEnabled, value => game.features.set(Features.HALF_PING_MODE_ENABLED, value)),
        Firewall: checkbox(game.features.isFirewallEnabled, value => {
            game.features.set(Features.FIREWALL_ENABLED, value)
            game.features.set(Features.BYPASS_ENABLED, !value)
        }, false),
        Bypass: checkbox(game.features.isBypassEnabled, value => game.features.set(Features.BYPASS_ENABLED, value)),
        Spells: checkbox(game.features.isSpellsEnabled, value => {
            game.features.set(Features.SPELLS_DISABLED, !value)
            //view.get('SummonerSpells').update(button(undefined, !value))
        }),
        AllChampions: checkbox(game.features.isAllChampionsEnabled, value => game.features.set(Features.ALL_CHAMPIONS_ENABLED, value)),
        
        //Champions: button(() => { server.champions.uinput(opts).catch(() => { /* Ignore */ }) }),
        //SpellsEnabled: checkbox(server.spells.value.length > 0, value => { server.spells.value = value ? [] : [] })
        //SummonerSpells: button(() => { server.spells.uinput(opts).catch(() => { /* Ignore */ }) }, !game.features.isSpellsEnabled),

        ClientServerCombinationToUse: option(
            combinations
                .filter(({ server }) => server.version != KnownServers.Unknown)
                .map(({ client, server }, id) => ({ id, text: `${server.name} + ${client.name}` })),
            (index),
            (index) => {
                setCombo(index)
                const isDefaultVersion =
                    game.serverVersion != KnownServers.Default ||
                    game.clientVersion != KnownClients.Default
                if(!isDefaultVersion)
                    game.features.set(Features.FIREWALL_ENABLED, false)
                view.update(form({
                    GameMap: gameMap(),
                    GameMode: gameMode(),
                    Firewall: checkbox(game.features.isFirewallEnabled, undefined, isDefaultVersion),
                }))
            },
        ),

        PlayAlone: button(() => { game.isPrivate = true; view.resolve() }, false),
        PublishGame: button(() => { game.isPrivate = false; view.resolve() }, false),
        Quit: button(() => view.reject(new AbortPromptError()))
    }), opts)

    await view.promise

    if(!game.features.isSpellsEnabled)
        game.spells.value = []
    else if(!game.features.isAllChampionsEnabled)
        game.spells.value = combo.spells.keys().toArray()
    else
        game.spells.value = spells.keys().toArray()

    if(!game.features.isAllChampionsEnabled)
        game.champions.value = combo.champions.keys().toArray()
    else
        game.champions.value = champions.keys().toArray()
}
