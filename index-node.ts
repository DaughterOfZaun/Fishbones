/* eslint-disable @typescript-eslint/no-unused-vars */

import { GossipSub, gossipsub, type GossipSubComponents } from '@chainsafe/libp2p-gossipsub'
import { yamux } from '@chainsafe/libp2p-yamux'
import { tcp } from '@libp2p/tcp'
import { createLibp2p } from 'libp2p'
//torrent-discovery:
import { torrentPeerDiscovery } from './network/torrent-discovery'
import { pubsubPeerDiscovery as pubsubPeerWithDataDiscovery } from './network/pubsub-discovery'
//import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery'
//torrent-discovery: 
import { hash } from 'uint8-util'
import { identify, identifyPush } from '@libp2p/identify'
import { ping } from '@libp2p/ping'
import { defaultLogger } from '@libp2p/logger'
import { noise } from '@chainsafe/libp2p-noise'
import { patchedCrypto } from './utils/crypto'
import { circuitRelayServer, circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { dcutr } from '@libp2p/dcutr'
import { autoNATv2 } from '@libp2p/autonat-v2'
import { uPnPNAT } from '@libp2p/upnp-nat'
//import { webRTC, webRTCDirect } from '@libp2p/webrtc'
import { kadDHT, removePrivateAddressesMapper } from '@libp2p/kad-dht'
import { bootstrap } from '@libp2p/bootstrap'
import { mdns } from '@libp2p/mdns'
//import { contentPeerDiscovery } from './network/content-discovery'
//import { CID } from 'multiformats/cid'
//import * as json from 'multiformats/codecs/json'
//import { sha256 } from 'multiformats/hashes/sha2'
import { autodial } from './network/autodial'
//import { webSockets } from '@libp2p/websockets'
//import { webTransport } from '@libp2p/webtransport'
//import * as Data from './data'
import { utp } from './network/tcp'
//TODO: rendezvous

const port = Number(process.argv[2]) || 5116
const appName = ['com', 'github', 'DaughterOfZaun', 'Fishbones']
/*
//const cid = 'bagaaierawchtonvxlm4szp7txp5qtrp63ncsqygzqbd6kma65nwjqg4ltila'
const cid = CID.create(1, json.code,
    await sha256.digest(
        json.encode({ appName })
    )
)
*/
const node = await createLibp2p({
    addresses: {
        listen: [
            `/ip4/0.0.0.0/udp/${port}/utp`,
            `/ip4/0.0.0.0/tcp/${port}`,
            ...Array(1).fill(`/p2p-circuit`),
            //`/ip4/0.0.0.0/tcp/${0}/ws`,
            //`/ip4/0.0.0.0/udp/${0}/webrtc-direct`,
            //`/webrtc`,
        ]
    },
    transports: [
        tcp(),
        utp({
            outboundSocketInactivityTimeout: Infinity,
            inboundSocketInactivityTimeout: Infinity,
            maxConnections: Infinity,
            //closeServerOnMaxConnections: null,
        }),
        circuitRelayTransport(), // Default relay-tag.value = 1
        //webSockets(),
        //webRTCDirect(),
        //webRTC(),
        //webTransport(),
    ],
    streamMuxers: [ yamux() ],
    connectionEncrypters: [ noise({
        // ChaCha20-Poly1305 is currently not supported in Bun.
        //crypto: pureJsCrypto //WALKAROUND:
        crypto: patchedCrypto //HACK:
    }) ],
    //peerDiscovery: [],
    services: {
        //contentPeerDiscovery: contentPeerDiscovery({ cid }),
        bootstrap: bootstrap({
            list: [...new Set([
                //src: https://github.com/ipfs/kubo/blob/master/config/bootstrap_peers.go
                "/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN",
                "/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa", // rust-libp2p-server
                "/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb",
                "/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt",
                "/dnsaddr/va1.bootstrap.libp2p.io/p2p/12D3KooWKnDdG3iXw9eTFijk3EWSunZcFi54Zka4wmtqtt6rPxc8", // js-libp2p-amino-dht-bootstrapper
                "/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ",           // mars.i.ipfs.io
                "/ip4/104.131.131.82/udp/4001/quic-v1/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ",   // mars.i.ipfs.io

                //src: https://github.com/ipfs/helia/blob/main/packages/helia/src/utils/bootstrappers.ts
                "/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN",
                "/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb",
                "/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt",
                // va1 is not in the TXT records for _dnsaddr.bootstrap.libp2p.io yet
                // so use the host name directly
                "/dnsaddr/va1.bootstrap.libp2p.io/p2p/12D3KooWKnDdG3iXw9eTFijk3EWSunZcFi54Zka4wmtqtt6rPxc8",
                "/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ",

                //src: https://github.com/libp2p/js-libp2p/blob/main/packages/peer-discovery-bootstrap/src/index.ts
                "/ip4/104.131.131.82/tcp/4001/ipfs/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ",
                "/dnsaddr/bootstrap.libp2p.io/ipfs/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN",
                "/dnsaddr/bootstrap.libp2p.io/ipfs/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa",

                //src: https://github.com/libp2p/cpp-libp2p/blob/master/example/02-kademlia/rendezvous_chat.cpp
                "/dnsaddr/bootstrap.libp2p.io/ipfs/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN",
                "/dnsaddr/bootstrap.libp2p.io/ipfs/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa",
                "/dnsaddr/bootstrap.libp2p.io/ipfs/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb",
                "/dnsaddr/bootstrap.libp2p.io/ipfs/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt",
                "/ip4/104.131.131.82/tcp/4001/ipfs/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ",            // mars.i.ipfs.io
                "/ip4/104.236.179.241/tcp/4001/ipfs/QmSoLPppuBtQSGwKDZT2M73ULpjvfd3aZ6ha4oFGL1KrGM",           // pluto.i.ipfs.io
                "/ip4/128.199.219.111/tcp/4001/ipfs/QmSoLSafTMBsPKadTEgaXctDQVcqN88CNLHXMkTNwMKPnu",           // saturn.i.ipfs.io
                "/ip4/104.236.76.40/tcp/4001/ipfs/QmSoLV4Bbm51jM9C4gDYZQ9Cy3U6aXMJDAbzgu2fzaDs64",             // venus.i.ipfs.io
                "/ip4/178.62.158.247/tcp/4001/ipfs/QmSoLer265NRgSp2LA3dPaeykiS1J6DifTC88f5uVQKNAd",            // earth.i.ipfs.io
                "/ip6/2604:a880:1:20::203:d001/tcp/4001/ipfs/QmSoLPppuBtQSGwKDZT2M73ULpjvfd3aZ6ha4oFGL1KrGM",  // pluto.i.ipfs.io
                "/ip6/2400:6180:0:d0::151:6001/tcp/4001/ipfs/QmSoLSafTMBsPKadTEgaXctDQVcqN88CNLHXMkTNwMKPnu",  // saturn.i.ipfs.io
                "/ip6/2604:a880:800:10::4a:5001/tcp/4001/ipfs/QmSoLV4Bbm51jM9C4gDYZQ9Cy3U6aXMJDAbzgu2fzaDs64", // venus.i.ipfs.io
                "/ip6/2a03:b0c0:0:1010::23:1001/tcp/4001/ipfs/QmSoLer265NRgSp2LA3dPaeykiS1J6DifTC88f5uVQKNAd", // earth.i.ipfs.io
            ])],
        }), // Default tag.value = 50
        //mdns: mdns(),
        ping: ping(),
        pubsub: gossipsub({
            tagMeshPeers: true, // Default [topic]tag.value = 100
            //batchPublish: true,
            //doPX: true,
        }) as (components: GossipSubComponents) => GossipSub,
        identify: identify(),
        identifyPush: identifyPush(),
        logger: defaultLogger,
        //pubsubPeerDiscovery: pubsubPeerDiscovery(), // Default values only.
        pubsubPeerWithDataDiscovery: pubsubPeerWithDataDiscovery({
            interval: 10000,
            enableBroadcast: false,
            topics: [ `${appName.join('.')}._peer-discovery._p2p._pubsub` ]
        }),
        //torrent-discovery: 
        torrentPeerDiscovery: torrentPeerDiscovery({
            infoHash: (await hash(`${appName.join('/')}/${0}`, 'hex', 'sha-1')) as string,
            //announce: await Data.getAnnounceAddrs(),
        }),
        dcutr: dcutr(),
        upnpNAT: uPnPNAT(),
        autoNAT: autoNATv2(),
        relay: circuitRelayServer(), // Default relay+keepalive-tag.value = 1 + 1
        aminoDHT: kadDHT({
            peerInfoMapper: removePrivateAddressesMapper,
        }), // Default close-tag.value = 50; peer-tag.value = 1
        autodial: autodial(),
    },
    start: true,
    connectionManager: {
        //maxConnections: 500,
        dialTimeout: 10_000,
    }
})

let sigints = 0
process.on('SIGINT', () => {
    if(node.status === 'started') node.stop()
    if(node.status === 'stopped' || ++sigints == 2) process.exit()
})

const ABORT_ERR = 20
const ERR_UNHANDLED_ERROR = 'ERR_UNHANDLED_ERROR'
process.on('uncaughtException', (err: Error & { code?: string, context?: Error & { code?: number } }) => {
    if(
        //err.message.startsWith('Unhandled error. (') &&
        //err.message.endsWith(')') &&
        err.code === ERR_UNHANDLED_ERROR &&
        err.context?.code === ABORT_ERR//&&
        //err.context?.name === 'AbortError' &&
        //err.context?.message === 'The operation was aborted.'
    ){
        // Ignore.
    } else {
        //console.log('UNCAUGHT EXCEPTION', err)
        throw err
    }
})