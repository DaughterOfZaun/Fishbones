import { GossipSub, gossipsub, type GossipSubComponents } from '@chainsafe/libp2p-gossipsub'
import { yamux } from '@chainsafe/libp2p-yamux'
import { tcp } from '@libp2p/tcp'
import { createLibp2p } from 'libp2p'
//torrent-discovery:
import { torrentPeerDiscovery } from './network/torrent-discovery'
import { pubsubPeerDiscovery as pubsubPeerWithDataDiscovery } from './network/pubsub-discovery'
//import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery'
import { hash } from 'uint8-util'
import { identify, identifyPush } from '@libp2p/identify'
import { ping } from '@libp2p/ping'
import { defaultLogger } from '@libp2p/logger'
import { noise } from '@chainsafe/libp2p-noise'
import { patchedCrypto } from './utils/crypto'
import { circuitRelayServer, circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { dcutr } from '@libp2p/dcutr'
import { autoNAT } from '@libp2p/autonat'
import { autoNATv2 } from '@libp2p/autonat-v2'
import { uPnPNAT } from '@libp2p/upnp-nat'
//import { webRTC, webRTCDirect } from '@libp2p/webrtc'
import { kadDHT, removePrivateAddressesMapper } from '@libp2p/kad-dht'
import { bootstrap } from '@libp2p/bootstrap'
import { mdns } from '@libp2p/mdns'
import { contentPeerDiscovery } from './network/content-discovery'
import { CID } from 'multiformats/cid'
import * as json from 'multiformats/codecs/json'
import { sha256 } from 'multiformats/hashes/sha2'
import { autodial } from './network/autodial'
//import { webSockets } from '@libp2p/websockets'
//import { webTransport } from '@libp2p/webtransport'
//import * as Data from './data'
import { utp, UTPMatcher } from './network/tcp'
import { isIPv4, isIPv6 } from '@chainsafe/is-ip'
import { multiaddr, type Multiaddr } from '@multiformats/multiaddr'
import type { ConnectionManager, OpenConnectionOptions, TransportManager } from '@libp2p/interface-internal'
import { anySignal } from 'any-signal'
import { setMaxListeners } from 'main-event'
import { TimeoutError, type Address, type PeerId, type PeerInfo } from '@libp2p/interface'

import { certifiedAddressesFirst, circuitRelayAddressesLast, loopbackAddressLast, publicAddressesFirst, reliableTransportsFirst } from './node_modules/libp2p/src/connection-manager/address-sorter.ts'
const utpTransportFirst = (a: Address, b: Address) => {
    return +UTPMatcher.exactMatch(b.multiaddr)
        -  +UTPMatcher.exactMatch(a.multiaddr) as (-1 | 0 | 1)
}
// defaultAddressSorter reversed
const addressSorters = [
    utpTransportFirst, // new
    loopbackAddressLast,
    publicAddressesFirst,
    circuitRelayAddressesLast,
    certifiedAddressesFirst,
    reliableTransportsFirst,
]
const addressSorter = (a: Address, b: Address) => {
    for(const sorter of addressSorters){
        const res = sorter(a, b)
        if(res != 0) return res
    }
    return 0
}

const appName = ['com', 'github', 'DaughterOfZaun', 'Fishbones']

//const cid = 'bagaaierawchtonvxlm4szp7txp5qtrp63ncsqygzqbd6kma65nwjqg4ltila'
const cid = CID.create(1, json.code,
    await sha256.digest(
        json.encode({ appName })
    )
)

type HostPort = { host: string, port: number }
const derive = ({ host: ip, port }: HostPort) => {
    let v = 0
    if(isIPv4(ip)) v = 4
    else if(isIPv6(ip)) v = 6
    else throw new Error(`invalid ip provided: ${ip}`)
    return [
        multiaddr(`/ip${v}/${ip}/udp/${port}/utp`),
        //multiaddr(`/ip${v}/${ip}/tcp/${port}`),
    ]
}

const MAX_PEER_ADDRS_TO_DIAL = 25
const PER_ADDR_DIAL_TIMEOUT = 10_000
const DIAL_TIMEOUT = PER_ADDR_DIAL_TIMEOUT * MAX_PEER_ADDRS_TO_DIAL + 1000

let DISABLE_UTP = true
let DISABLE_MDNS = true
let DISABLE_AUTODIAL = true

let DISABLE_TCP = true
let DISABLE_DHT = true
let DISABLE_BOOTSTRAP = true
let DISABLE_NAT_MIGITATION = true
let DISABLE_CONTENT_DISCOVERY = true

let DISABLE_TORRENT = true

DISABLE_UTP = false
DISABLE_MDNS = false
DISABLE_AUTODIAL = false
if(process.argv.includes('--online')){
    DISABLE_TCP = false
    DISABLE_DHT = false
    DISABLE_BOOTSTRAP = false
    DISABLE_NAT_MIGITATION = false
    DISABLE_CONTENT_DISCOVERY = false
    if(process.argv.includes('--torrent')){
        DISABLE_TORRENT = false
    }
}

export type LibP2PNode = Awaited<ReturnType<typeof createNode>>
export async function createNode(port: number){
    const node = await createLibp2p({
        addresses: {
            listen: [
                ...(DISABLE_UTP ? [] : [`/ip4/0.0.0.0/udp/${port}/utp`]),
                ...(DISABLE_TCP ? [] : [`/ip4/0.0.0.0/tcp/${port}`]),
                ...(DISABLE_NAT_MIGITATION ? [] : Array(10).fill(`/p2p-circuit`))
                //`/ip4/0.0.0.0/udp/${0}/webrtc-direct`,
                //`/ip4/0.0.0.0/tcp/${0}/ws`,
                //`/webrtc`,
            ]
        },
        transports: [
            ...(DISABLE_UTP ? [] : [
                utp({
                    outboundSocketInactivityTimeout: Infinity,
                    inboundSocketInactivityTimeout: Infinity,
                    maxConnections: Infinity,
                    //closeServerOnMaxConnections: null,
                }),
            ]),
            ...(DISABLE_TCP ? [] : [ tcp() ]),
            ...(DISABLE_NAT_MIGITATION ? [] : [
                circuitRelayTransport(), // Default relay-tag.value = 1
            ]),
            //webTransport(),
            //webRTCDirect(),
            //webSockets(),
            //webRTC(),
        ],
        streamMuxers: [ yamux() ],
        connectionEncrypters: [ noise({
            // ChaCha20-Poly1305 is currently not supported in Bun.
            //crypto: pureJsCrypto //WALKAROUND:
            crypto: patchedCrypto //HACK:
        }) ],
        //peerDiscovery: [],
        services: {
            ...(DISABLE_CONTENT_DISCOVERY ? {} : {
                contentPeerDiscovery: contentPeerDiscovery({ cid })
            }),
            ...(DISABLE_BOOTSTRAP ? {} : {
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
            }),
            ...(DISABLE_MDNS? {} : { mdns: mdns() }),
            ping: ping(),
            identify: identify(),
            identifyPush: identifyPush(),
            logger: defaultLogger,
            pubsub: gossipsub({
                tagMeshPeers: true, // Default [topic]tag.value = 100
                //batchPublish: true,
                doPX: true,
            }) as (components: GossipSubComponents) => GossipSub,
            //pubsubPeerDiscovery: pubsubPeerDiscovery(), // Default values only.
            pubsubPeerWithDataDiscovery: pubsubPeerWithDataDiscovery({
                interval: 10000,
                enableBroadcast: false,
                topics: [ `${appName.join('.')}._peer-discovery._p2p._pubsub` ]
            }),
            ...(DISABLE_TORRENT ? {} : {
                torrentPeerDiscovery: torrentPeerDiscovery({
                    infoHash: (await hash(`${appName.join('/')}/${0}`, 'hex', 'sha-1')) as string,
                    //announce: await Data.getAnnounceAddrs(),
                    derive,
                }),
            }),
            ...(DISABLE_NAT_MIGITATION ? {} : {
                dcutr: dcutr({
                    timeout: DIAL_TIMEOUT,
                    retries: 3,
                }),
                upnpNAT: uPnPNAT(),
                autoNAT: autoNAT(),
                autoNATv2: autoNATv2(),
                relay: circuitRelayServer(), // Default relay+keepalive-tag.value = 1 + 1
            }),
            ...(DISABLE_DHT ? {} : {
                aminoDHT: kadDHT({
                    //protocol: '/ipfs/kad/1.0.0',
                    peerInfoMapper: removePrivateAddressesMapper,
                    //logPrefix: 'libp2p:dht-amino',
                    //datastorePrefix: '/dht-amino',
                    //metricsPrefix: 'libp2p_dht_amino',
                    //validators: { ipns: ipnsValidator },
                    //selectors: { ipns: ipnsSelector }
                }), // Default close-tag.value = 50; peer-tag.value = 1
            }),
            ...(DISABLE_AUTODIAL? {} : { autodial: autodial() }),
        },
        //start: true,
        connectionManager: {
            //maxConnections: 500,
            maxPeerAddrsToDial: MAX_PEER_ADDRS_TO_DIAL,
            dialTimeout: DIAL_TIMEOUT,
            addressSorter,
        }
    })

    const nc = (
        node as unknown as {
            components: typeof node.services & {
                transportManager: TransportManager
                connectionManager: ConnectionManager & {
                    dialQueue: {
                        calculateMultiaddrs: (peerId?: PeerId, multiaddrs?: Set<string>, options?: OpenConnectionOptions) => Promise<Address[]>
                    }
                }
            }
        }
    ).components
    
    if(!DISABLE_AUTODIAL && (!DISABLE_MDNS || !DISABLE_TORRENT)){
        const peersToDial = new Set<string>()
        if(!DISABLE_MDNS){
            nc.mdns.addEventListener('peer', ({ detail: info }: CustomEvent<PeerInfo>) => {
                peersToDial.add(info.id.toString())
            })
        }
        if(!DISABLE_TORRENT){
            nc.torrentPeerDiscovery.addEventListener('record', ({ detail: info_id }: CustomEvent<PeerId>) => {
                peersToDial.add(info_id.toString())
            })
            nc.torrentPeerDiscovery.addEventListener('addr', (evt: CustomEvent<Multiaddr[]>) => {
                nc.autodial.onAddressDiscovery(evt)
            })
        }
        node.addEventListener('peer:discovery', (evt) => {
            const { detail: peer } = evt
            if(peersToDial.has(peer.id.toString())){
                nc.autodial.onPeerDiscovery(evt)
            }
        })
    }

    const transports = nc.transportManager.getTransports()
    for(const transport of transports){
        const transport_dial = transport.dial
        transport.dial = async (ma, options) => {
            
            const signalTimeout = AbortSignal.timeout(PER_ADDR_DIAL_TIMEOUT)
            const signal = anySignal([ options.signal, signalTimeout ])
            setMaxListeners(Infinity, signal)

            try {
                return await transport_dial.call(transport, ma, { ...options, signal })
            } catch(unk_err) {
                if(signalTimeout.aborted){
                    //const err = unk_err as AbortError
                    //throw new TimeoutError(err.message)
                    throw new TimeoutError(`The connection to ${ma.toString()} has timed out.`)
                } else {
                    throw unk_err
                }
            } finally {
                signal.clear()
            }
        }
    }

    return node
}
