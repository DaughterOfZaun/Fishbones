import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { identify, identifyPush } from '@libp2p/identify'
import { ping } from '@libp2p/ping'
import { webRTCDirect } from '@libp2p/webrtc'
import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { patchedCrypto } from '../utils/crypto'
import { defaultLogger } from '@libp2p/logger'
import { GossipSub, gossipsub, type GossipSubComponents } from '@chainsafe/libp2p-gossipsub'
import { appDiscoveryTopic, rtcConfiguration } from '../utils/constants-build'
import { rendezvousServer } from "@canvas-js/libp2p-rendezvous/server"
import { circuitRelayServer } from '@libp2p/circuit-relay-v2'
import fs from 'node:fs/promises'
import { generateKeyPair, privateKeyFromRaw } from '@libp2p/crypto/keys'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { pubsubPeerDiscovery } from '../network/libp2p/discovery/pubsub-discovery'
import { pinning } from '../network/libp2p/pinning'
//import { peerIdFromPrivateKey } from '@libp2p/peer-id'

const UDP_PORT = 42451
const TCP_PORT = 41463

const KEY_FILE = './key.txt'
const KEY_ENCODING = 'base64pad'

let keyString
let privateKey
try {
    keyString = await fs.readFile(KEY_FILE, 'utf8')
    privateKey = privateKeyFromRaw(uint8ArrayFromString(keyString, KEY_ENCODING))
} catch {
    privateKey = await generateKeyPair('Ed25519')
    keyString = uint8ArrayToString(privateKey.raw, KEY_ENCODING)
    await fs.writeFile(KEY_FILE, keyString, 'utf8')
}

//console.log(peerIdFromPrivateKey(privateKey).toString())
//process.exit()

const node = await createLibp2p({
    privateKey,
    nodeInfo: {
        //name: NAME,
        //version: VERSION,
        //userAgent: `${NAME}/${VERSION}`
    },
    addresses: {
        listen: [
            `/ip4/0.0.0.0/udp/${UDP_PORT}/webrtc-direct`,
            `/ip4/0.0.0.0/tcp/${TCP_PORT}`,
        ]
    },
    transports: [
        webRTCDirect({ rtcConfiguration }),
        tcp(),
    ],
    connectionEncrypters: [
        noise({
            crypto: patchedCrypto
        })
    ],
    streamMuxers: [ yamux() ],
    connectionGater: {
        denyDialMultiaddr: () => false,
    },
    services: {
        identify: identify(),
        identifyPush: identifyPush(),
        logger: defaultLogger,
        ping: ping(),

        relay: circuitRelayServer(),
        
        rendezvous: rendezvousServer({}),

        pubsub: gossipsub({
            allowedTopics: [ appDiscoveryTopic ],
            allowPublishToZeroTopicPeers: true,
            emitSelf: true,
            doPX: true,
        }) as (components: GossipSubComponents) => GossipSub,
        pubsubPeerDiscovery: pubsubPeerDiscovery({
            topic: appDiscoveryTopic,
        }),
        pinning: pinning(),
    }
})

console.log(node.getMultiaddrs().map(ma => ma.toString()))
