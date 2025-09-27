import { spinner, select, type Choice, AbortPromptError, color } from './ui/remote'
import { type Game } from './game'
import { RemoteGame } from './game-remote'
import { LocalGame } from './game-local'
import type { GamePlayer, PPP } from './game-player'
import { LocalServer, RemoteServer } from './server'
import type { Peer as PBPeer } from './message/peer'
import type { LibP2PNode } from './index-node'
import { TITLE } from './utils/constants-build'
import type { AbortOptions } from '@libp2p/interface'

export async function main(node: LibP2PNode, opts: Required<AbortOptions>){
    
    process.title = TITLE

    const pubsub = node.services.pubsub //TODO: Replace with "pspd".
    const pspd = node.services.pubsubPeerWithDataDiscovery
    //const name = node.peerId.toString().slice(-8)
    const name = 'Player'

    type Action = ['join', RemoteGame] | ['host'] | ['exit'] | ['noop']
    
    const getChoices = () => {
        let ret: Choice<Action>[] = pspd.getPeersWithData()
        .filter(pwd => pwd.data?.serverSettings)
        //.filter(pwd => {
        //    const gi = pwd.data?.gameInfos[0]
        //    return gi && gi.players < 2 * gi.playersMax
        //})
        .flatMap(pwd => {
            const server = RemoteServer.create(node, pwd.id, pwd.data!.serverSettings!) //TODO: Cache
            
            if(!server.validate()) return []

            return pwd.data!.gameInfos.map(gameInfo => ({
                id: pwd.id,
                name: pwd.data!.name,
                server: server,
                game: RemoteGame.create(node, server, gameInfo) //TODO: Cache
            }))
        })
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .map(({ id, name, game, server }) => {
            //const ownerId = id.toString().slice(-8)
            //const gameName = game.name.toString()
            //const serverName = server.name.toString()
            const players = game.getPlayersCount().toString().padStart(2, ' ')
            const playersMax = (2 * (game.playersMax.value ?? 0)).toString().padEnd(2, ' ')
            const mode = game.mode.toString()
            const map = game.map.toString()
            //const password = (game.password.isSet ? '[P] ' : '   ')
            const features = game.features.asString().replaceAll(' ', '_').replaceAll('][', ' ').replace(/\[|\]/g, '')
            //const ping = Math.min(100, 999).toString().padStart(3, ' ')
            
            let line = [
                `${players}/${playersMax}`,
                name.padEnd(16, ' '),
                map.padEnd(24, ' '),
                mode.padEnd(7, ' '),
                features
            ]
            //.map(segment => color.underline(segment))
            .join(' | ')

            if(game.password.isSet)
                line = color('gray', line)

            return ({
                value: ['join', game] as Action,
                name: line,
                
                // name: [
                //     `[${players}/${playersMax}] ${name}'s ${gameName} at ${serverName}`,
                //     [` `, password, `${mode} at ${map}`, features].join(' '),
                // ].join('\n')
            })
        })
        if(ret.length == 0){
            ret = pubsub.isStarted() ?
                [ { value: ['noop'], name: color('white', 'Waiting for the servers to appear...'), disabled: true } ] :
                [ { value: ['noop'], name: color('red', 'Failed to initialize the network...') , disabled: true } ]
        }
        return ret.concat(defaultItems)
    }
    const defaultItems = [
        { value: ['host'] as Action, name: 'Create a custom game lobby' },
        { value: ['exit'] as Action, name: 'Quit' },
    ]
    loop: while(true){
        const [action, ...args] = await select<Action>({
            message: 'Select a custom game lobby',
            choices: getChoices(),
            cb(setItems) {
                const listener = () => setItems(getChoices())
                pspd.addEventListener('update', listener)
                return () => pspd.removeEventListener('update', listener)
            },
            pageSize: 20,
        }, {
            clearPromptOnDone: true,
            signal: opts.signal,
        })
        if(action == 'host' && pubsub.isStarted() == false){
            const server = await LocalServer.create(node, opts)
            const game = await LocalGame.create(node, server, opts)
            try {
                await game.startListening(opts)
                game.join(name, undefined)
                await lobby(game, opts)
            } finally {
                game.stopListening()
            }
        }
        if(action == 'host' && pubsub.isStarted() == true){
            const server = await LocalServer.create(node, opts)
            const game = await LocalGame.create(node, server, opts)
            let data: PBPeer.AdditionalData
            let prevPlayerCount = 0
            try {
                await game.startListening(opts)
                game.join(name, undefined)
                data = {
                    name: name,
                    serverSettings: server.encode(),
                    gameInfos: [ game.encode() ],
                }
                pspd.setData(data)
                pspd_broadcast(true)

                game.addEventListener('update', update)
                game.addEventListener('start', start)
                game.addEventListener('stop', stop)
                
                await lobby(game, opts)

            } finally {
                game.stopListening()

                game.removeEventListener('update', update)
                game.removeEventListener('start', start)
                game.removeEventListener('stop', stop)
                
                pspd.setData(null)
                pspd_broadcast(false)
            }

            function pspd_broadcast(announce: boolean){
                if(announce || pspd.getBroadcastEnabled()){
                    pspd.setBroadcastEnabled(announce)
                    pspd.broadcast(announce)
                }
            }

            function update(){
                const gi = data.gameInfos[0]!
                gi.players = game.getPlayersCount()
                if(gi.players != prevPlayerCount){
                    prevPlayerCount = gi.players
                    pspd_broadcast(game.isJoinable())
                }
            }

            function start(){ pspd_broadcast(game.isJoinable()) }
            function stop(){ pspd_broadcast(game.isJoinable()) }
        }
        if(action == 'join'){
            const game = args[0]!
            try {
                await game.connect(opts)
                if(game.password.isSet)
                    await game.password.uinput(opts)
                game.join(name, game.password.encode())
                await lobby(game, opts)
            } finally {
                game.disconnect()
            }
        }
        if(action == 'exit'){
            break loop
        }
    }
}

function playerChoices<T>(game: Game, cb: (player: GamePlayer) => T){
    return game.getPlayers().map(player => {
        const teamColor = player.team.color()
        const playerId = player.id.toString(16).padStart(8, '0')
        const champion = player.champion.toString()
        const spell1 = player.spell1.toString()
        const spell2 = player.spell2.toString()
        const locked = player.lock.toString()
        return ({
            disabled: true,
            value: cb(player),
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

async function lobby_gather(ctx: Context){
    const { game } = ctx

    type Action = ['noop'] | ['start'] | ['exit']
    
    const getChoices = () => ([
        { value: ['start'] as Action, name: 'Start Game', disabled: !game.canStart },
        ...playerChoices<Action>(game, () => ['noop'] as Action),
        { value: ['exit'] as Action, name: 'Quit' },
    ])
    loop: while(true){
        const [action] = await select<Action>({
            message: 'Waiting for players...',
            choices: getChoices(),
            cb: (setItem) => {
                const listener = () => setItem(getChoices())
                game.addEventListener('update', listener)
                return () => game.removeEventListener('update', listener)
            },
            pageSize: 20,
        }, ctx)
        if(action == 'start'){
            game.start()
            break loop
        } else if(action == 'noop'){
            continue
        } else if(action == 'exit'){
            throw new AbortPromptError({ cause: null })
        }
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
            ...playerChoices<Action>(game, () => ['noop'] as Action),
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

    type Action = ['relaunch'] | ['exit']
    
    const [action] = await select({
        message: 'The client exited unexpectedly',
        choices: [
            { value: ['relaunch'] as Action, name: 'Restart the client' },
            { value: ['exit'] as Action, name: 'Leave' },
        ],
        pageSize: 20,
    }, ctx)
    if(action === 'relaunch'){
        game.relaunch()
        //return await lobby_wait_for_end(ctx)
        throw new AbortPromptError({ cause: lobby_wait_for_end })   
    } else if(action == 'exit'){
        throw new AbortPromptError({ cause: null })
    }
}
