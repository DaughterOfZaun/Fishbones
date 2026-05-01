import { LocalGame } from "../../game/game-local";
import type { GamePlayer, PlayerId, PPP } from "../../game/game-player";
import { SwitchViewError } from "../tui";
import { BOTS, players, PLAYERS, Team, type Context } from "./lobby";
import { bar, base, button, checkbox, form, icon, inq2gd, label, option, type Form } from "../../ui/remote/types";
import { render } from "../../ui/remote/view";
import { combinations_find, KnownServers } from "../../utils/data/constants/client-server-combinations";
import { AIDifficulty } from "../../utils/data/constants/champions";
import { getCustomIconPath, getCustomUsername, getName } from "../../utils/namegen/namegen";
import { popup } from "../../ui/remote/remote";
import { tr } from "../../utils/translation";
import { sortInplace } from "../../utils/helpers";

const ms = 1
const s = 1000*ms

const GATHERING_TIMEOUT = 30*s
const GATHERING_TIMEOUT_TICK = 1*s

//export async function lobby(game: Game, opts: Required<AbortOptions>){}
export async function lobby_gather(ctx: Context){
    const { game } = ctx
    
    const localGame = game instanceof LocalGame ? game : undefined
    const game_serverVersion = localGame?.serverVersion ?? KnownServers.Unknown
    const { maps, champions, bots } = combinations_find(game.clientVersion, game_serverVersion)!
    const map = maps.get(game.map.value!)!
    const allBotIDs = new Set([ ...map.bots.keys(), ...bots.keys() ]) //TODO:
    const allBots = champions.values().filter(({ i }) => allBotIDs.has(i))
    const botsItems =
        sortInplace([...allBots], info => info.short, 'asc')
        .map(({ i, name }) => {
            return { id: i, text: name }
        })

    const makePlayerForm = (player: GamePlayer): Form => {
        
        const { name: championName, icon: championIcon } =
            (player.champion.value !== undefined) ?
                champions.get(player.champion.value!)! : {}

        if(!player.isBot){
            const iconPath = getCustomIconPath(player, championIcon)
            const username = getCustomUsername(player, championName)
            const isMe = game.getPlayer() === player
            const playerId = getName(player, isMe)
            return form({
                Username: label(username),
                Name: label(playerId),
                Icon: icon(iconPath),
                Kick: button(undefined, !localGame || isMe),
                Online: checkbox(player.fullyConnected.value),
            })
        } else {
            return form({
                Icon: icon(championIcon, championName),
                Champion: option(botsItems, player.champion.value, undefined, !localGame),
                Difficulty: option(inq2gd(AIDifficulty.choices), player.difficulty.value, undefined, !localGame),
                Kick: button(undefined, !localGame),
            })
        }
    }

    const team = (team: Team) => form({
        Join: button(() => game.set('team', team), game.getPlayer()?.team.value == team),
        AddBot: button(() => localGame?.addBot(team), !localGame || allBotIDs.size === 0),
        //Players: list(players(game, team, PLAYERS, makePlayerForm)),
        //Bots: list(players(game, team, BOTS, makePlayerForm)),
    })

    let gatheringTimeout = (localGame?.isPrivate == false) ? GATHERING_TIMEOUT : 0
    const startbutton = (cb?: () => void) => button(
        cb, !localGame || !game.areAllPlayersFullyConnected() || gatheringTimeout > 0
    )

    const view = render('GatheringLobby', form({
        Quit: button(() => view.reject(new SwitchViewError({ cause: null }))),
        Start: startbutton(() => { if(gatheringTimeout <= 0) localGame?.start() }),
        Explanation: base(false),
        Autofill: button(autofill, !localGame || allBotIDs.size === 0),
        GatheringProgress: bar(0, 0, 100, gatheringTimeout > 0),
        Team1: team(0),
        Team2: team(1),
    }), ctx, [
        {
            regex: /\.\/Team(?<team>\d+)\/(?<type>Player|Bot)s\/(?<playerId>\d+)\/Kick:pressed/,
            listener: (m) => {
                //const team = parseInt(m.groups!.team!)
                const playerId = parseInt(m.groups!.playerId!) as PlayerId
                localGame?.kick(localGame.getPlayer(playerId)!)
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
                localGame?.setBot(prop, index, playerId)
            }
        }
    ])

    updateDynamicElements()
    view.addEventListener(game, 'update', updateDynamicElements)
    function updateDynamicElements(){
        view.get('Team1/Players').setItems(players(game, Team.Blue, PLAYERS, makePlayerForm))
        view.get('Team2/Players').setItems(players(game, Team.Purple, PLAYERS, makePlayerForm))
        view.get('Team1/Bots').setItems(players(game, Team.Blue, BOTS, makePlayerForm))
        view.get('Team2/Bots').setItems(players(game, Team.Purple, BOTS, makePlayerForm))
        view.get('Team1/Join').update(button(undefined, game.getPlayer()?.team.value == Team.Blue))
        view.get('Team2/Join').update(button(undefined, game.getPlayer()?.team.value == Team.Purple))
        view.get('Explanation').update(base(!game.areAllPlayersFullyConnected()))
        view.get('Start').update(startbutton())
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
        localGame?.addBots(countsToAdd)
    }

    if(gatheringTimeout > 0){
        const gatheringTickInterval = setInterval(() => {
            gatheringTimeout -= GATHERING_TIMEOUT_TICK
            if(gatheringTimeout > 0){
                view.update(form({
                    GatheringProgress: bar((1 - gatheringTimeout / GATHERING_TIMEOUT) * 100),
                }))
            } else {
                gatheringTimeout = 0
                clearInterval(gatheringTickInterval)
                view.update(form({
                    GatheringProgress: { $type: 'progress-bar', value: 0, visible: false },
                    Start: startbutton(),
                }))
            }
        }, GATHERING_TIMEOUT_TICK)
        view.addCleanupCallback(() => {
            clearInterval(gatheringTickInterval)
        })
    }

    return view.promise
}
