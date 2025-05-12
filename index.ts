import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { tcp } from '@libp2p/tcp'
import { createLibp2p } from 'libp2p'
import { discovery } from './discovery'
import { hash } from 'uint8-util'

const node = await createLibp2p({
    addresses: {
        listen: [ `/ip4/0.0.0.0/tcp/${5118}` ]
    },
    transports: [ tcp() ],
    streamMuxers: [ yamux() ],
    connectionEncrypters: [ noise() ],
    peerDiscovery: [ discovery({
        infoHash: (await hash('', 'hex', 'sha-1')) as string,
        port: 5118,
        announce: [],
        dht: true,
        dhtPort: 5118,
        userAgent: '',
        tracker: true,
        lsd: true,
    }) ],
    services: {
        pubsub: gossipsub()
    }
})