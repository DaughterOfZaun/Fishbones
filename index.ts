import { gossipsub } from '@chainsafe/libp2p-gossipsub'
//import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { tcp } from '@libp2p/tcp'
import { createLibp2p } from 'libp2p'
import { torrentPeerDiscovery } from './network/torrent-discovery'
import { pubsubPeerDiscovery } from './network/pubsub-discovery'
import { hash } from 'uint8-util'
import { getAnnounceAddrs } from './utils/trackers'
import { identify, identifyPush } from '@libp2p/identify'
import { ping } from '@libp2p/ping'
import { defaultLogger } from '@libp2p/logger'
import select from './ui/dynamic-select'
import { map2str, mode2str, PLAYER_PICKABLE_PROPS, PLAYER_PICKABLE_PROPS_KEYS, team2color, type PlayerPickableProp } from './utils/constants'
import { type Game, LocalGame, RemoteGame } from './game'
import type { PeerId } from '@libp2p/interface'
import type { Peer } from './message/peer'
import color from 'yoctocolors'
import { noise } from '@chainsafe/libp2p-noise'
import { AbortPromptError } from '@inquirer/core'
import type { Context } from '@inquirer/type'

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
            announce: await getAnnounceAddrs(),
            dht: true,
            dhtPort: portDHT,
            tracker: true,
            lsd: true,
        }),
    }
})
/*await*/ node.start()

const pspd = node.services.pubsubPeerDiscovery

const name = 'Player'
//const name = node.peerId.toString().slice(-8)

/*await*/ main()
async function main(){
    type Action = ['host'] | ['exit'] | ['join', PeerId, Peer.AdditionalData.GameInfo]
    
    const getChoices = () =>
        pspd.getPeersWithData()
        .flatMap(pwd => pwd.data!.gameInfos.map(gameInfo => ({
            id: pwd.id,
            name: pwd.data!.name,
            serverSettings: pwd.data!.serverSettings!,
            gameInfo
        })))
        .map(({ id, name, gameInfo, serverSettings }) => ({
            value: ['join', id, gameInfo] as Action,
            name: [
                `[${id.toString().slice(-8)}] ${name}'s ${gameInfo.name} at ${serverSettings.name}`,
                [
                    ` `,
                    `(${('' + gameInfo.players).padStart(2, ' ')}/${('' + 2 * gameInfo.playersMax).padEnd(2, ' ')})`,
                    `${mode2str(gameInfo.mode)} at ${map2str(gameInfo.map)}`,
                ].join(' '),
                //TODO: `  ${gameInfo.features}`,
            ].join('\n')
        }))
        .concat(defaultItems)
    
    const defaultItems = [
        { value: ['host'] as Action, name: 'Create a custom game lobby' },
        { value: ['exit'] as Action, name: 'Exit' },
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
            const game = await LocalGame.create(node)

            const data = game.getData()
            pspd.setData(data)
            pspd.setBroadcastEnabled(true)
            const update = () => {
                data.gameInfos[0]!.players = game.getPlayers().length
                pspd.broadcast(true)
            }
            game.addEventListener('update', update)
            
            game.join(name)
            await lobby(game)
            game.leave()

            game.removeEventListener('update', update)
            pspd.broadcast(false)
            pspd.setBroadcastEnabled(false)
            pspd.setData(null)
        }
        if(action == 'join'){
            const [ id, gameInfo ] = args
            const game = await RemoteGame.create(node, id!, gameInfo!)
            game.join(name)
            await lobby(game)
            game.leave()
        }
        if(action == 'exit'){
            /*await*/ node.stop()
            break loop
        }
    }
}

async function lobby(game: Game){
    type Action = ['noop'] | ['start'] | ['pick'] | ['pick', PlayerPickableProp] | ['exit']
    const getChoices = () => ([
        { value: ['start'] as Action, name: 'Start Game', disable: game.canStart() },
        ...game.getPlayers().map(player => ({
            value: ['noop'] as Action, name: color[team2color(player.team)](`[${player.id.toString().slice(-8)}] ${player.name}`)
        })),
        { value: ['exit'] as Action, name: 'Quit' },
    ])
    const controller = new AbortController()
    const onexit = () => controller.abort(['exit'])
    const onpick = () => controller.abort(['pick'])
    game.addEventListener('kick', onexit)
    game.addEventListener('pick', onpick)
    const opts = {
        signal: controller.signal,
        clearPromptOnDone: true,
    }
    const handleAbort = (error: unknown) => {
        if (error instanceof AbortPromptError)
            return error.cause as Action
        else throw error
    }
    while(true){
        const [action, ...args] = await select<Action>({
            message: 'Waiting for players...',
            choices: getChoices(),
            cb: (setItem) => {
                const listener = () => setItem(getChoices())
                game.addEventListener('update', listener)
                return () => game.removeEventListener('update', listener)
            }
        }, opts).catch(handleAbort)
        if(action == 'start' || (action == 'pick' && args.length == 0)){
            if(action == 'start') game.start()
            for(const prop of PLAYER_PICKABLE_PROPS_KEYS){
                const [action] = await pick(prop, game, opts).catch(handleAbort)
                if(action === 'exit'){
                    break
                }
            }
        }
        if(action == 'exit'){
            break
        }
    }
    game.removeEventListener('kick', onexit)
    game.removeEventListener('pick', onpick)
}

async function pick(prop: PlayerPickableProp, game: Game, opts: Context){
    type Action = ['pick', number]
    const [action, ...args] = await select<Action>({
        message: `Pick your ${prop}!`,
        choices: PLAYER_PICKABLE_PROPS[prop].map((v, i) => ({ value: ['pick', i], name: v}))
    }, opts)
    if(action == 'pick')
        game.pick(prop, args[0])
    return ['noop']
}
