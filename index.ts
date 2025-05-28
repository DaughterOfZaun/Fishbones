import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { yamux } from '@chainsafe/libp2p-yamux'
import { tcp } from '@libp2p/tcp'
import { createLibp2p } from 'libp2p'
import { torrentPeerDiscovery } from './network/torrent-discovery'
import { pubsubPeerDiscovery } from './network/pubsub-discovery'
import { hash } from 'uint8-util'
import { identify, identifyPush } from '@libp2p/identify'
import { ping } from '@libp2p/ping'
import { defaultLogger } from '@libp2p/logger'
import select, { type Choice } from './ui/dynamic-select'
import { type Game } from './game'
import color from 'yoctocolors'
import { noise } from '@chainsafe/libp2p-noise'
import { AbortPromptError } from '@inquirer/core'
import { RemoteGame } from './game-remote'
import { LocalGame } from './game-local'
import type { PPP } from './game-player'
import { LocalServer, RemoteServer } from './server'
import spinner from './ui/spinner'
import * as Data from './data'

//const controller = new AbortController()
///*await*/ spinner({ message: 'Data check and repair' }, {
//    clearPromptOnDone: true,
//    signal: controller.signal,
//}).catch(() => {})
await Data.repair()
//controller.abort()

const port = Number(process.argv[2]) || 5118
const portDHT = port - 1
const node = await createLibp2p({
    start: false,
    addresses: {
        listen: [ `/ip4/0.0.0.0/tcp/${port}` ]
    },
    transports: [ tcp() ],
    streamMuxers: [ yamux() ],
    connectionEncrypters: [ noise() ],
    //peerDiscovery: [],
    services: {
        ping: ping(),
        //@ts-expect-error: Types have separate declarations of a private property 'map'
        pubsub: gossipsub(),
        identify: identify(),
        identifyPush: identifyPush(),
        logger: defaultLogger,
        pubsubPeerDiscovery: pubsubPeerDiscovery({
            enableBroadcast: false,
            interval: 10000,
        }),
        torrentPeerDiscovery: torrentPeerDiscovery({
            infoHash: (await hash(`jinx/launcher/${0}`, 'hex', 'sha-1')) as string,
            port: port,
            announce: await Data.getAnnounceAddrs(),
            dht: true,
            dhtPort: portDHT,
            tracker: true,
            lsd: true,
        }),
    }
})
await node.start()

const pspd = node.services.pubsubPeerDiscovery

const name = 'Player'
//const name = node.peerId.toString().slice(-8)

await main()

//loop: while(true){
//    const action = await select()
//}

async function main(){
    type Action = ['host'] | ['exit'] | ['join', RemoteGame]
    
    const getChoices = () =>
        pspd.getPeersWithData()
        .filter(pwd => pwd.data?.serverSettings)
        .flatMap(pwd => {
            const server = RemoteServer.create(node, pwd.id, pwd.data!.serverSettings!) //TODO: Cache
            
             if(!server.validate()) return []

            return pwd.data!.gameInfos.map(gameInfo => ({
                id: pwd.id,
                name: pwd.data!.name,
                server: server,
                game: RemoteGame.create(node, pwd.id, server, gameInfo) //TODO: Cache
            }))
        })
        .map(({ id, name, game, server }) => ({
            value: ['join', game] as Action,
            name: [
                `[${id.toString().slice(-8)}] ${name}'s ${game.name.toString()} at ${server.name.toString()}`,
                [
                    ` `,
                    `(${('' + game.getPlayersCount()).padStart(2, ' ')}/${('' + 2 * (game.playersMax.value ?? 0)).padEnd(2, ' ')})`,
                    `${game.mode.toString()} at ${game.map.toString()}`,
                ].join(' '),
            ].join('\n')
        }))
        .concat(defaultItems)
    
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
        }, {
            clearPromptOnDone: true,
        })
        if(action == 'host'){
            const server = await LocalServer.create(node)
            const game = await LocalGame.create(node, server)

            const data = game.encodeData()
            pspd.setData(data)
            pspd.setBroadcastEnabled(true)
            const update = () => {
                data.gameInfos[0]!.players = game.getPlayers().length
                pspd.broadcast(true)
            }
            game.addEventListener('update', update)
            
            game.startListening()
            await game.join(name)
            await lobby(game)
            game.stopListening()

            game.removeEventListener('update', update)
            pspd.broadcast(false)
            pspd.setBroadcastEnabled(false)
            pspd.setData(null)
        }
        if(action == 'join'){
            const game = args[0]!

            await game.connect()
            await game.join(name)
            await lobby(game)
            game.disconnect()
        }
        if(action == 'exit'){
            /*await*/ node.stop()
            break loop
        }
    }
}

async function lobby(game: Game){
    type Action = ['noop'] | ['start'] | ['pick'] | ['pick', PPP] | ['lock'] | ['wait'] | ['launch'] | ['stop'] | ['exit']
    
    let action: Action[0] = 'noop'
    let args: [] | [Action[1]] = []

    const getChoices = () => {
        const choices: Choice<Action>[] = []
        if(!game.started){
            choices.push(
                { value: ['start'] as Action, name: 'Start Game', disabled: !game.canStart },
            )
        } else {
            const player = game.getPlayer()!
            const disabled = !!player.lock.value
            choices.push(
                { value: ['lock'] as Action, name: 'Lock In', disabled },
                ...(['champion', 'spell1', 'spell2'] as PPP[]).map(ppp => (
                    { value: ['pick', ppp] as Action, name: `${player[ppp].name}: ${player[ppp].toString()}`, disabled }
                ))
            )
        }
        choices.push(
            ...game.getPlayers().map(player => ({
                value: ['noop'] as Action,
                name: color[player.team.color()]([
                    `[${player.id.toString().slice(-8)}] ${player.name}`,
                    `${player.champion.toString()}`,
                    `${player.spell1.toString()}`,
                    `${player.spell2.toString()}`,
                    `${player.lock.toString()}`,
                ].join(' - '))
            })),
            { value: ['exit'] as Action, name: 'Quit' }
        )
        return choices
    }
    let controller = new AbortController()
    const opts = {
        signal: controller.signal,
        clearPromptOnDone: true,
    }
    const controller_abort = (action: Action) => {
        controller.abort(action)
        controller = new AbortController()
        opts.signal = controller.signal
    }
    const handlers = {
        kick: () => {
            controller.abort([action] = ['exit'] as Action)
        },
        start: () => {
            controller_abort([action] = ['pick'] as Action)
        },
        wait: () => {
            controller_abort([action] = ['wait'] as Action)
        },
        launch: () => {
            controller_abort([action] = ['launch'] as Action)
        },
        stop: () => {
            controller_abort([action] = ['stop'] as Action)
        },
    }
    const handlers_keys = Object.keys(handlers) as (keyof typeof handlers)[]
    for(const name of handlers_keys)
        game.addEventListener(name, handlers[name])
    
    const handleAbort = (error: unknown) => {
        if (error instanceof AbortPromptError){
            controller = new AbortController()
            opts.signal = controller.signal
            return [action] = error.cause as Action
        } else throw error
    }
    loop: while(true){
        
        let message = 'Waiting for players...'
        if(game.started) message = 'Waiting for all players to lock their choice...'
        if(game.launchedServer) message = 'Waiting for the game to start...'

        ;[action, ...args] = await select<Action>({
            message,
            choices: getChoices(),
            cb: (setItem) => {
                const listener = () => setItem(getChoices())
                game.addEventListener('update', listener)
                return () => game.removeEventListener('update', listener)
            },
            theme: {
                style: {
                    //disabled: (text: string) => colors.dim(`${text} - locked`)
                }
            }
        }, opts).catch(handleAbort)

        if(action == 'exit') break loop

        if(action == 'start' || (action == 'pick' && args.length == 0)){
            if(action == 'start'){
                game.start()
            }
            for(const prop of ['champion', 'spell1', 'spell2'] as const){
                ;[action] = ['noop'] as Action
                await game.pick(prop, controller).catch(handleAbort)
                if(action === 'exit') break loop
            }
        }
        if(action == 'pick' && args.length == 1){
            const prop = args[0]!
            ;[action] = ['noop'] as Action
            await game.pick(prop, controller).catch(handleAbort)
            if(action === 'exit') break loop
        }
        if(action == 'lock'){
            ;[action] = ['noop'] as Action
            await game.set('lock', +true).catch(handleAbort)
            if(action === 'exit') break loop
        }
        if(action == 'wait'){
            ;[action] = ['noop'] as Action
            const message = 'Waiting for the server to start...'
            await spinner({ message }, opts).catch(handleAbort)
            if(action === 'exit') break loop
        }
        if(action == 'launch'){
            ;[action] = ['noop'] as Action
            const message = 'Waiting for the end of the game...'
            await spinner({ message }, opts).catch(handleAbort)
            if(action === 'exit') break loop
        }
    }

    for(const name of handlers_keys)
        game.removeEventListener(name, handlers[name])
}
