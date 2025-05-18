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
import { map2str, mode2str, team2color } from './utils/constants'
import { type Game, LocalGame, RemoteGame } from './game'
import type { PeerId } from '@libp2p/interface'
import type { Peer } from './message/peer'
import color from 'yoctocolors'
import { noise } from '@chainsafe/libp2p-noise'

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
                    `(${('' + gameInfo.players).padStart(2, ' ')}/${('' + gameInfo.playersMax).padEnd(2, ' ')})`,
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
        })
        if(action == 'host'){
            const game = await LocalGame.create(node)
            game.join(name)
            pspd.setData(game.getData())
            await lobby(game)
            pspd.setData(null)
            game.leave()
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
    type Action = ['noop'] | ['exit']
    const getChoices = () => ([
        ...game.getPlayers().map(player => ({
            value: ['noop'] as Action, name: color[team2color(player.team)](`[${player.id.toString().slice(-8)}] ${player.name}`)
        })),
        { value: ['exit'] as Action, name: 'Exit' },
    ]);
    while(true){
        const [action] = await select<Action>({
            message: 'Waiting for players...',
            choices: getChoices(),
            cb: (setItem) => {
                const listener = () => setItem(getChoices())
                game.addEventListener('update', listener)
                return () => game.removeEventListener('update', listener)
            }
        })
        if(action == 'exit'){
            break
        }
    }
}