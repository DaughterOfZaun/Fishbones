import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { tcp } from '@libp2p/tcp'
import { createLibp2p } from 'libp2p'
import { torrentPeerDiscovery } from './torrent-discovery'
import { pubsubPeerDiscovery } from './pubsub-discovery'
import { hash } from 'uint8-util'
import { getAnnounceAddrs } from './trackers'
import { identify, identifyPush } from '@libp2p/identify'
import { ping } from '@libp2p/ping'
import { defaultLogger } from '@libp2p/logger'
import select, { Separator } from './dynamic-select'
import { map2str, maps, mode2str, modes } from './constants'
import { input } from '@inquirer/prompts'
import { Peer as PBPeer } from './peer'
import { fillGameCreationForm } from './ui'
import colors from 'yoctocolors'

const port = 5118
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

const name = node.peerId.toString().slice(-8)

while(true){
    const defaultItems = [
        { value: ['host'], name: 'Create a custom game lobby' },
        { value: ['exit'], name: 'Exit' },
    ]
    let [action, ...args] = await select<any[]>({
        message: 'Select a custom game lobby',
        choices: defaultItems,
        cb(setItems) {
            pspd.addEventListener('update', () => setItems(
                pspd.getPeersWithData()
                .flatMap(pwd => pwd.data!.gameInfos.map(gameInfo => ({
                    id: pwd.id,
                    name: pwd.data!.name,
                    serverSettings: pwd.data!.serverSettings!,
                    gameInfo
                })))
                .map(({ id, name, gameInfo, serverSettings }) => ({
                    value: ['join', id],
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
            ))
        },
    })
    if(action == 'exit'){
        /*await*/ node.stop()
        break
    }
    if(action == 'host'){

        let opts = await fillGameCreationForm()
    
        let data: PBPeer.AdditionalData = {
            name,
            serverSettings: {
                name: 'Server',
                maps: 0,
                modes: 0,
                tickRate: 0,
                champions: []
            },
            gameInfos: [
                {
                    name: opts.name,
                    map: opts.map,
                    mode: opts.mode,
                    players: 1,
                    playersMax: opts.players,
                    features: 0,
                    passwordProtected: !!opts.password
                }
            ],
        }
        
        pspd.setData(data)
        while(true){
            let [action, ...args] = await select({
                message: 'Waiting for players...',
                choices: [
                    { value: ['switch-team'], name: `Join ` },
                    new Separator(),
                    { value: ['noop'], name: `[${node.peerId.toString().slice(-8)}] ${name}` },
                    new Separator(),
                    { value: ['exit'], name: 'Exit' },
                ]
            })
            if(action == 'exit'){
                break
            }
        }
        pspd.setData(null)
    }    
}