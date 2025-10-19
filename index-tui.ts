import { spinner, select, input } from './ui/remote'
import { type Game } from './game'
import { type LibP2PNode } from './index-node-simple'
import { TITLE } from './utils/constants-build'
import type { AbortOptions } from '@libp2p/interface'
import { getLastLaunchCmd } from './utils/data-client'

import { browser } from './index-tui-browser'
import { connections, profilePanel } from './index-tui-connections'
import { setup } from './index-tui-setup'
import { lobby_gather } from './index-tui-lobby-gather'
import { lobby_pick } from './index-tui-lobby-pick'

export async function main(node: LibP2PNode, opts: Required<AbortOptions>){
    process.title = TITLE
    await Promise.race([
        browser(node, lobby, setup, opts),
        profilePanel(node, opts),
        connections(node, opts),
    ])
}

interface Context {
    signal: AbortSignal,
    clearPromptOnDone: boolean,
    controller: AbortController,
    game: Game,
}

export class SwitchViewError extends Error {
    constructor(options: { cause: unknown }){
        super('', options)
    }
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

    const switchView = (to: View) => {
        controller.abort(new SwitchViewError({ cause: to }))
    }
    const handlers = {
        kick: () => switchView(null),
        start: () => switchView(lobby_pick),
        wait: () => switchView(lobby_wait_for_start),
        crash: () => switchView(lobby_crash_report),
        launch: () => switchView(lobby_wait_for_end),
        stop: () => switchView(lobby_gather),
    }
    
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
                if (error instanceof SwitchViewError){
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
            throw new SwitchViewError({ cause: lobby_wait_for_end })   
        } else if(action === 'exit'){
            throw new SwitchViewError({ cause: null })
        } else if(action === 'show_cmd'){
            await input({
                message: 'Run the command in the terminal or paste it into a bat file',
                default: getLastLaunchCmd(),
            })
        }
    }
}
