import { spinner, select, type Choice, AbortPromptError, color, input } from './ui/remote'
import { type Game } from './game'
import type { GamePlayer, PPP } from './game-player'
import { type LibP2PNode } from './index-node-simple'
import { TITLE } from './utils/constants-build'
import type { AbortOptions } from '@libp2p/interface'
import { getLastLaunchCmd } from './utils/data-client'

import { browser } from './index-tui-browser'
import { connections, profilePanel } from './index-tui-connections'
import { setup } from './index-tui-setup'
import { lobby_gather } from './index-tui-lobby'

export async function main(node: LibP2PNode, opts: Required<AbortOptions>){
    process.title = TITLE
    await Promise.race([
        browser(node, lobby, setup, opts),
        profilePanel(node, opts),
        connections(node, opts),
    ])
}

function playerChoices<T>(game: Game, cb: (player: GamePlayer) => { value: T, disabled?: boolean }){
    return game.getPlayers().map(player => {
        const teamColor = player.team.color()
        const playerId = player.id.toString(16).padStart(8, '0').slice(-8)
        const champion = player.champion.toString()
        const spell1 = player.spell1.toString()
        const spell2 = player.spell2.toString()
        const locked = player.lock.toString()
        const { value, disabled } = cb(player)
        return ({
            disabled,
            value,
            name: color(
                teamColor, [`[${playerId}] ${player.name.toString()}`, champion, spell1, spell2, locked].join(' - ')
            ),
        })
    }) as Choice<T>[]
}

interface Context {
    signal: AbortSignal,
    clearPromptOnDone: boolean,
    controller: AbortController,
    game: Game,
}

async function lobby(game: Game, opts: Required<AbortOptions>){
    type View = null | ((opts: Context) => Promise<unknown>)

    let controller = new AbortController()
    const createSignal = () => AbortSignal.any([ controller.signal, opts.signal ]) 
    const ctx: Context = {
        signal: createSignal(),
        clearPromptOnDone: true,
        controller,
        game,
    }
    const handlers = {
        kick: () => controller.abort(null),
        start: () => controller.abort(lobby_pick),
        wait: () => controller.abort(lobby_wait_for_start),
        crash: () => controller.abort(lobby_crash_report),
        launch: () => controller.abort(lobby_wait_for_end),
        stop: () => controller.abort(lobby_gather),
    }
    //TODO: Rework the logic for switching views.
    const views: View[] = [ null, lobby_pick, lobby_wait_for_start, lobby_crash_report, lobby_wait_for_end, lobby_gather ]
    const handlers_keys = Object.keys(handlers) as (keyof typeof handlers)[]
    for(const name of handlers_keys)
        game.addEventListener(name, handlers[name])
    
    try {
        let view: View = lobby_gather
        while(view){
            try {
                await view(ctx)
                //break
            } catch(error) {
                if (error instanceof AbortPromptError && views.includes(error.cause as View)){
                    controller = new AbortController()
                    ctx.signal = createSignal()
                    view = error.cause as View
                } else throw error
            }
        }
    } finally {
        for(const name of handlers_keys)
            game.removeEventListener(name, handlers[name])
    }
}

async function lobby_pick(ctx: Context){
    const { game } = ctx

    type Action = ['lock'] | ['pick', PPP] | ['noop'] | ['exit']

    const getChoices = () => {
        const player = game.getPlayer()!
        const disabled = !!player.lock.value
        return [
            { value: ['lock'] as Action, name: 'Lock In', disabled },
            ...(['champion', 'spell1', 'spell2'] as PPP[]).map(ppp => (
                { value: ['pick', ppp] as Action, name: `${player[ppp].name}: ${player[ppp].toString()}`, disabled }
            )),
            ...playerChoices<Action>(game, () => ({ value: ['noop'] as Action })),
            { value: ['exit'] as Action, name: 'Quit' },
        ]
    }

    for(const prop of ['champion', 'spell1', 'spell2'] as const){
        await game.pick(prop, ctx)
    }

    /*loop:*/ while(true){
        const [action, ...args] = await select<Action>({
            message: 'Waiting for all players to lock their choice...',
            choices: getChoices(),
            cb: (setItem) => {
                const listener = () => setItem(getChoices())
                game.addEventListener('update', listener)
                return () => game.removeEventListener('update', listener)
            },
            pageSize: 20,
        }, ctx)
        if(action == 'lock'){
            game.set('lock', +true)
            //break loop
        } else if(action == 'pick'){
            const prop = args[0]!
            await game.pick(prop, ctx)
        } else if(action == 'noop'){
            continue
        } else if(action == 'exit'){
            throw new AbortPromptError({ cause: null })
        }
    }
}

async function lobby_wait_for_start(ctx: Context){
    const message = 'Waiting for the server to start...'
    await spinner({ message }, ctx)
}

async function lobby_wait_for_end(ctx: Context){
    const message = 'Waiting for the end of the game...'
    await spinner({ message }, ctx)
}

async function lobby_crash_report(ctx: Context){
    const { game } = ctx

    type Action = ['show_cmd'] | ['relaunch'] | ['exit']
    
    while(true){
        const [action] = await select({
            message: 'The client exited unexpectedly',
            choices: [
                { value: ['show_cmd'] as Action, name: 'Show command to run manually' },
                { value: ['relaunch'] as Action, name: 'Restart the client' },
                { value: ['exit'] as Action, name: 'Leave' },
            ],
            pageSize: 20,
        }, ctx)
        if(action === 'relaunch'){
            game.relaunch()
            //return await lobby_wait_for_end(ctx)
            throw new AbortPromptError({ cause: lobby_wait_for_end })   
        } else if(action === 'exit'){
            throw new AbortPromptError({ cause: null })
        } else if(action === 'show_cmd'){
            await input({
                message: 'Run the command in the terminal or paste it into a bat file',
                default: getLastLaunchCmd(),
            })
        }
    }
}
