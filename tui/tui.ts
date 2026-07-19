import { spinner, select, input, AbortPromptError } from '../ui/remote/remote'
import { type Game } from '../game/game'
import { type LibP2PNode } from '../node/node'
import { TITLE } from '../utils/constants-build'
import { type AbortOptions } from '@libp2p/interface'
import { getLastLaunchCmd } from '../utils/process/client'
import { Deferred } from '../utils/promises'

import { browser } from './browser'
import { connections, profilePanel } from './connections'
import { setup } from './setup'
import { lobby_gather } from './lobby/gather'
import { lobby_pick } from './lobby/pick'
import * as masteries from './masteries'
import { chat } from './chat'
import { tr } from '../utils/translation'
import { render } from '../ui/remote/view'
import { base, button, form } from '../ui/remote/types'

export async function main(node: LibP2PNode, opts: Required<AbortOptions>){
    process.title = TITLE
    void chat.prerender(opts)
    void masteries.prerender(opts)
    await Promise.race([
        browser(node, lobby, setup, opts),
        profilePanel(node, masteries.show, opts),
        connections(node, opts),
    ])
}

interface Context {
    signal: AbortSignal,
    clearPromptOnDone: boolean,
    controller: AbortController,
    isSpellCrash: boolean,
    game: Game,
}

export class SwitchViewError extends Error {
    constructor(options: { cause: unknown }){
        super('', options)
    }
}

async function lobby(game: Game, opts: Required<AbortOptions>){
    type View = null | ((opts: Context) => Promise<unknown>)

    chat.bind(game)

    let controller = new AbortController()
    const createSignal = () => AbortSignal.any([ controller.signal, opts.signal ]) 
    const ctx: Context = {
        signal: createSignal(),
        clearPromptOnDone: true,
        isSpellCrash: false,
        controller,
        game,
    }

    const switchView = (to: View) => {
        controller.abort(new SwitchViewError({ cause: to }))
    }
    const handlers = {
        'kick': () => switchView(null),
        'start': () => switchView(lobby_pick),
        'wait': () => switchView(lobby_wait_for_start),
        'crash': (event: CustomEvent<{ isSpellCrash: boolean }>) => {
            ctx.isSpellCrash = event.detail.isSpellCrash
            switchView(lobby_crash_report)
        },
        'launch': () => switchView(lobby_wait_for_end),
        'stop': () => switchView(lobby_gather),
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
                const switchViewError =
                    (error instanceof SwitchViewError) ? error :
                    (error instanceof AbortPromptError && error.cause instanceof SwitchViewError) ? error.cause :
                    undefined
                if (switchViewError !== undefined){
                    controller = new AbortController()
                    ctx.signal = createSignal()
                    view = switchViewError.cause as View
                } else throw error
            }
        }
    } finally {
        chat.unbind()
        for(const name of handlers_keys)
            game.removeEventListener(name, handlers[name])
    }
}

async function lobby_wait_for_start(ctx: Context){
    return abortableSpinner(tr('Waiting for the server to start...'), ctx)
}

async function lobby_wait_for_end(ctx: Context){
    return abortableSpinner(tr('Waiting for the end of the game...'), ctx)
}

async function abortableSpinner(message: string, ctx: Context){
    try {
        await spinner({ message }, ctx)
    } catch(err) {
        if(err instanceof AbortPromptError && !ctx.signal.aborted){
            throw new SwitchViewError({ cause: null })
            //const { game } = ctx
            //if(game instanceof LocalGame)
            //    game.stopListening()
            //else if(game instanceof RemoteGame)
            //    game.disconnect()
        } else {
            throw err
        }
    }
}

async function lobby_crash_report(ctx: Context){
    const { game, isSpellCrash } = ctx
    while(true){
        type Action = ['show_cmd'] | ['relaunch'] | ['exit']
        const view = render<Action>('BugSplat', form({
            Warning: base(isSpellCrash),
            ShowCMD: button(() => view.resolve(['show_cmd']), isSpellCrash),
            Restart: button(() => view.resolve(['relaunch']), isSpellCrash),
            Leave: button(() => view.resolve(['exit'])),
        }), ctx)
        const [action] = await view.promise
        if(action === 'relaunch'){
            game.relaunch()
            //return await lobby_wait_for_end(ctx)
            throw new SwitchViewError({ cause: lobby_wait_for_end })
        } else if(action === 'exit'){
            throw new SwitchViewError({ cause: null })
        } else if(action === 'show_cmd'){
            await input({
                message: tr('Run the command in the terminal or paste it into a bat file'),
                default: getLastLaunchCmd(),
            })
        }
    }
}
