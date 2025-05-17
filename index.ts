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

const port = 5118
const portDHT = port - 1

const _torrentPeerDiscovery = torrentPeerDiscovery({
    infoHash: (await hash(`jinx/launcher/${0}`, 'hex', 'sha-1')) as string,
    port: port,
    announce: await getAnnounceAddrs(),
    dht: true,
    dhtPort: portDHT,
    tracker: true,
    lsd: true,
})
const _pubsubPeerDiscovery = pubsubPeerDiscovery({
    enableBroadcast: false,
    interval: 10000,
})

const node = await createLibp2p({
    addresses: {
        listen: [ `/ip4/0.0.0.0/tcp/${port}` ]
    },
    transports: [ tcp() ],
    streamMuxers: [ yamux() ],
    connectionEncrypters: [ noise() ],
    peerDiscovery: [
        _pubsubPeerDiscovery,
        _torrentPeerDiscovery,
    ],
    services: {
        ping: ping(),
        pubsub: gossipsub(),
        identify: identify(),
        identifyPush: identifyPush(),
    }
})
