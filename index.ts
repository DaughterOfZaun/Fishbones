import select, { type Choice } from './ui/dynamic-select'
import { type Game } from './game'
import color from 'yoctocolors-cjs'
import { AbortPromptError } from '@inquirer/core'
import { RemoteGame } from './game-remote'
import { LocalGame } from './game-local'
import type { GamePlayer, PPP } from './game-player'
import { LocalServer, RemoteServer } from './server'
import spinner from './ui/spinner'
import * as Data from './data'
import type { Peer as PBPeer } from './message/peer'
import { createNode } from './index-node'

await Data.repair()

const getNamedArg = (name: string, defaultValue: string) => {
    const index = process.argv.indexOf(name)
    return (index >= 0 && index + 1 < process.argv.length) ?
        process.argv[index + 1]! :
        defaultValue
}

const port = parseInt(getNamedArg('--port', '5119'))
const node = await createNode(port)
const pubsub = node.services.pubsub //TODO: Replace with "pspd".
const pspd = node.services.pubsubPeerWithDataDiscovery

const name = 'Player'
//const name = node.peerId.toString().slice(-8)

await main()

async function main(){
    type Action = ['join', RemoteGame] | ['host'] | ['exit'] | ['noop']
    
    const getChoices = () => {
        let ret = pspd.getPeersWithData()
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
            const players = ('' + game.getPlayersCount()).padStart(2, ' ')
            const playersMax = ('' + 2 * (game.playersMax.value ?? 0)).padEnd(2, ' ')
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
                line = color.gray(line)

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
                [ { value: ['noop'], name: color.gray('Waiting for the servers to appear...') } ] :
                [ { value: ['noop'], name: color.red('Failed to initialize the network...') } ]
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
        })
        if(action == 'host' && pubsub.isStarted() == false){
            const server = await LocalServer.create(node)
            const game = await LocalGame.create(node, server)
            
            game.startListening()
            await game.join(name, undefined)
            await lobby(game)
            game.stopListening()
        }
        if(action == 'host' && pubsub.isStarted() == true){
            const server = await LocalServer.create(node)
            const game = await LocalGame.create(node, server)

            game.startListening()
            await game.join(name, undefined)

            const data = {
                name: name,
                serverSettings: server.encode(),
                gameInfos: [ game.encode() ],
            } as PBPeer.AdditionalData
            pspd.setData(data)
            
            broadcast(true)
            function broadcast(announce: boolean){
                if(announce || pspd.getBroadcastEnabled()){
                    pspd.setBroadcastEnabled(announce)
                    pspd.broadcast(announce)
                }
            }
            
            let prevPlayerCount = 0
            game.addEventListener('update', update)
            function update(){
                const gi = data.gameInfos[0]!
                gi.players = game.getPlayersCount()
                if(gi.players != prevPlayerCount){
                    prevPlayerCount = gi.players
                    broadcast(game.isJoinable())
                }
            }
            game.addEventListener('start', start)
            function start(){ broadcast(game.isJoinable()) }
            game.addEventListener('stop', stop)
            function stop(){ broadcast(game.isJoinable()) }
            
            await lobby(game)
            game.stopListening()

            game.removeEventListener('update', update)
            game.removeEventListener('start', start)
            game.removeEventListener('stop', stop)
            pspd.setData(null)
            broadcast(false)
        }
        if(action == 'join'){
            const game = args[0]!

            await game.connect()
            if(game.password.isSet)
                await game.password.uinput()
            await game.join(name, game.password.encode())
            await lobby(game)
            game.disconnect()
        }
        if(action == 'exit'){
            //await node.services.pubsubPeerWithDataDiscovery?.beforeStop()
            //await node.services.pubsubPeerDiscovery?.stop()
            //await node.services.torrentPeerDiscovery?.beforeStop()
            //await node.services.torrentPeerDiscovery?.stop()
            //await node_services_upnpNAT?.stop()
            await node.stop()
            break loop
        }
    }
}

function playerChoices<T>(game: Game, cb: (player: GamePlayer) => T){
    return game.getPlayers().map(player => {
        const colorFunc = color[player.team.color()]
        const playerId = player.id.toString(16).padStart(8, '0')
        const champion = player.champion.toString()
        const spell1 = player.spell1.toString()
        const spell2 = player.spell2.toString()
        const locked = player.lock.toString()
        return ({
            value: cb(player),
            name: colorFunc(
                [`[${playerId}] ${player.name}`, champion, spell1, spell2, locked].join(' - ')
            )
        })
    }) as Choice<T>[]
}

type Context = {
    signal: AbortSignal,
    clearPromptOnDone: boolean,
    controller: AbortController,
    game: Game,
}

async function lobby(game: Game){
    type View = null | ((opts: Context) => Promise<unknown>)

    let controller = new AbortController()
    const ctx: Context = {
        signal: controller.signal,
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
    const handlers_keys = Object.keys(handlers) as (keyof typeof handlers)[]
    for(const name of handlers_keys)
        game.addEventListener(name, handlers[name])
    
    let view: View = lobby_gather
    while(view){
        try {
            await view(ctx)
            //break
        } catch(error) {
            if (error instanceof AbortPromptError){
                controller = new AbortController()
                ctx.signal = controller.signal
                view = error.cause as View
            } else throw error
        }
    }

    for(const name of handlers_keys)
        game.removeEventListener(name, handlers[name])
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
            /*await*/ game.start()
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
        await game.pick(prop, ctx.signal)
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
            await game.set('lock', +true)
            //break loop
        } else if(action == 'pick'){
            const prop = args[0]!
            await game.pick(prop, ctx.signal)
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
        /*await*/ game.relaunch()
        //return await lobby_wait_for_end(ctx)
        throw new AbortPromptError({ cause: lobby_wait_for_end })   
    } else if(action == 'exit'){
        throw new AbortPromptError({ cause: null })
    }
}
