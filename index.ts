import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { tcp } from '@libp2p/tcp'
import { createLibp2p } from 'libp2p'
import { torrentPeerDiscovery } from './torrent-discovery'
import { pubsubPeerDiscovery } from './pubsub-discovery'
import { hash } from 'uint8-util'
import { getAnnounceAddrs } from './trackers'
import { select } from '@inquirer/prompts';

const port = 5118
const node = await createLibp2p({
    addresses: {
        listen: [ `/ip4/0.0.0.0/tcp/${port}` ]
    },
    transports: [ tcp() ],
    streamMuxers: [ yamux() ],
    connectionEncrypters: [ noise() ],
    //peerDiscovery: [],
    services: {
        pubsub: gossipsub(),
        torrentPeerDiscovery: torrentPeerDiscovery({
            infoHash: (await hash(`jinx/launcher/${0}`, 'hex', 'sha-1')) as string,
            port: port,
            announce: await getAnnounceAddrs(),
            dht: true,
            dhtPort: 5117,
            tracker: true,
            lsd: true,
        }),
        pubsubPeerDiscovery: pubsubPeerDiscovery({
            interval: 10000,
            listenOnly: true,
        }),
    }
})

switch(await select<'host'|'join'|'exit'>({
    message: `What do you want to do?`,
    choices: [
        { value: 'host', name: 'Host Game', },
        { value: 'join', name: 'Join Game', },
        { value: 'exit', name: 'Exit', },
    ],
})){
    case 'host': break;
    case 'join': break;

    case 'exit': break;
}
