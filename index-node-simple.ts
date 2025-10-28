/* eslint-disable @typescript-eslint/no-unused-vars */

import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { bootstrap } from '@libp2p/bootstrap'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { identify, identifyPush } from '@libp2p/identify'
import { kadDHT, removePrivateAddressesMapper } from '@libp2p/kad-dht'
import { peerIdFromCID, peerIdFromString } from '@libp2p/peer-id'
import { ping } from '@libp2p/ping'
import { webRTC, webRTCDirect } from '@libp2p/webrtc'
import { CODE_P2P_CIRCUIT, multiaddr, type Multiaddr } from '@multiformats/multiaddr'

import { createLibp2p } from 'libp2p'
//import { fromString, toString } from 'uint8arrays'
import type { AbortOptions, Connection, PeerInfo, PrivateKey, PubSubRPC } from '@libp2p/interface'
import { tcp } from '@libp2p/tcp'
import { patchedCrypto } from './utils/crypto'

//import { RTCPeerConnection } from 'node-datachannel/polyfill'
import type { RTCDataChannel, RTCPeerConnection } from '@ipshipyard/node-datachannel/polyfill'
import { defaultLogger } from '@libp2p/logger'

import { pubsubPeerDiscovery } from './network/pubsub-discovery'
import { GossipSub, gossipsub, type GossipSubComponents, type GossipsubOpts } from '@chainsafe/libp2p-gossipsub'
import { PeerRecord, RecordEnvelope } from '@libp2p/peer-record'
import type { ConnectionManager, TransportManager } from '@libp2p/interface-internal'
import { mdns } from '@libp2p/mdns'
import { args } from './utils/args'
import { appDiscoveryTopic, NAME, rtcConfiguration, VERSION } from './utils/constants-build'
import { rendezvousClient } from "@canvas-js/libp2p-rendezvous/client"
//import { loadOrCreateSelfKey } from '@libp2p/config'
import { LevelDatastore } from 'datastore-level'
//import { keychain } from '@libp2p/keychain'
import { downloads } from './utils/data-shared'
import path from 'node:path'
import { console_log } from './ui/remote'
import { toString as uint8ArrayToString } from 'uint8arrays'
import { tiePubSubWithPeerDiscovery } from './index-node-simple-hacks'

export type LibP2PNode = Awaited<ReturnType<typeof createNodeInternal>> & ComponentsContainer
type ComponentsContainer = {
    components: {
        privateKey: PrivateKey
        transportManager: TransportManager
        connectionManager: ConnectionManager
    }
}
export async function createNode(...args: Parameters<typeof createNodeInternal>){
    return createNodeInternal(...args) as Promise<LibP2PNode>
}
async function createNodeInternal(port?: number, opts?: AbortOptions){
    
    opts?.signal?.throwIfAborted()

    //const datastore = new LevelDatastore(path.join(downloads, 'datastore'))
    //await datastore.open()

    opts?.signal?.throwIfAborted()

    //const keychainInit = { /*pass: 'yes-yes-very-secure'*/ }
    //const privateKey = await loadOrCreateSelfKey(datastore, keychainInit)

    opts?.signal?.throwIfAborted()

    const node = await createLibp2p({
        nodeInfo: {
            name: NAME,
            version: VERSION,
            userAgent: `${NAME}/${VERSION}`
        },
        addresses: {
            listen: [
                `/ip4/0.0.0.0/udp/0/webrtc-direct`,
                '/p2p-circuit',
                '/webrtc',
            ]
        },
        transports: [
            webRTCDirect({ rtcConfiguration }),
            ...(args.allowInternet.enabled ? [
                webRTC({ rtcConfiguration }),
                circuitRelayTransport(),
                tcp(),
            ] : []),
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
        //@ts-expect-error Type 'A' is not assignable to type 'B'.
        services: {
            identify: identify(),
            identifyPush: identifyPush(),

            ...(args.allowInternet.enabled ? {
                ping: ping(),
                kadDHT: kadDHT({
                    protocol: '/ipfs/kad/1.0.0',
                    peerInfoMapper: removePrivateAddressesMapper
                }),
                rendezvous: rendezvousClient({
                    autoDiscover: true,
                    autoRegister: {
                        namespaces: [ appDiscoveryTopic ],
                        multiaddrs: [
                            '/ip4/195.133.146.185/udp/42451/webrtc-direct/certhash/uEiBYh4UvCuTLl07oUNUl_1CNkWJAver2h7jLVdZmE0anig/p2p/12D3KooWHHyaqcTuPvphwifkP2su2Qis2wWKLZhaobc9cB5qXQak',
                            '/ip4/195.133.146.185/tcp/41463/p2p/12D3KooWHHyaqcTuPvphwifkP2su2Qis2wWKLZhaobc9cB5qXQak',
                        ],
                    },
                }),
                bootstrap: bootstrap({
                    list: [
                        //src: https://github.com/ipfs/helia/blob/main/packages/helia/src/utils/bootstrappers.ts
                        '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
                        '/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb',
                        '/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt',
                        '/dnsaddr/va1.bootstrap.libp2p.io/p2p/12D3KooWKnDdG3iXw9eTFijk3EWSunZcFi54Zka4wmtqtt6rPxc8',
                        '/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ'
                    ]
                }),
            } : {}),

            logger: defaultLogger,

            pubsub: gossipsub({
                allowPublishToZeroTopicPeers: true,
                emitSelf: true,
            }) as (components: GossipSubComponents) => GossipSub,
            pubsubPeerDiscovery: pubsubPeerDiscovery({
                topic: appDiscoveryTopic,
            }),

            mdns: mdns(),
        },
        ////@ts-expect-error: Types of parameters 'key' and 'key' are incompatible.
        //datastore,
        //privateKey,
        //keychain: keychain(keychainInit),
    })

    opts?.signal?.throwIfAborted()

    //TODO: Reintroduce Autodial.
    const dialedPeers = new Set<string>()
    const peersDiscoveredFirstByNode = new Set<string>()
    const peersDiscoveredFirstByMechanism = new Set<string>()
    node.services.mdns?.addEventListener('peer', onPeerDiscoveredByMechanism)
    node.services.rendezvous?.addEventListener('peer', onPeerDiscoveredByMechanism)
    function onPeerDiscoveredByMechanism(event: CustomEvent<PeerInfo>){
        const peer = event.detail
        //console_log('*:peer', peer.id.toString())
        if(!dialedPeers.has(peer.id.toString()))
        if(peersDiscoveredFirstByNode.has(peer.id.toString())){
            node.dial(peer.id).catch((/*err*/) => { /* Ignore */ })
        } else {
            peersDiscoveredFirstByMechanism.add(peer.id.toString())
        }
    }
    node.addEventListener('peer:discovery', onPeerDiscoveredByNode)
    function onPeerDiscoveredByNode(event: CustomEvent<PeerInfo>){
        const peer = event.detail
        //console_log('discovery:peer', peer.id.toString())
        if(!dialedPeers.has(peer.id.toString()))
        if(peersDiscoveredFirstByMechanism.has(peer.id.toString())){
            node.dial(peer.id).catch((/*err*/) => { /* Ignore */ })
        } else {
            peersDiscoveredFirstByNode.add(peer.id.toString())
        }
    }

    tiePubSubWithPeerDiscovery(node)

    return node
}

const CIRCUIT_RELAY_TRANSPORT = 'CircuitRelayTransport'
function filterDiableMultiaddrs(node: LibP2PNode, multiaddrs: Multiaddr[]){
    //console.log('original', multiaddrs)
    const tm = node.components.transportManager
    const transports = tm.getTransports().filter(transport => {
        return transport.constructor.name !== CIRCUIT_RELAY_TRANSPORT
    })
    multiaddrs = multiaddrs.filter(ma => {
        const decapsulated = ma.decapsulateCode(CODE_P2P_CIRCUIT)
        return transports.some(transport => {
            return transport.dialFilter([ decapsulated ]).length
        })
    })
    //console.log('filtered', multiaddrs)
    return multiaddrs
}

export async function getPeerInfoString(node: LibP2PNode, opts: Required<AbortOptions>): Promise<string> {
    
    const multiaddrs = node.getMultiaddrs()
    if(multiaddrs.length === 0) return ''

    const peerRecord = new PeerRecord({
        peerId: node.peerId,
        multiaddrs,
    })
    const { privateKey } = node.components
    const signedPeerRecord = await RecordEnvelope.seal(peerRecord, privateKey, opts)
    const marshaled = signedPeerRecord.marshal()
    return marshaled.toBase64()
}


function parsePeerInfoString(str: string){
    const buffer = Uint8Array.fromBase64(str)
    const envelope = RecordEnvelope.createFromProtobuf(buffer)
    const peerId = peerIdFromCID(envelope.publicKey.toCID())
    return { buffer, envelope, peerId }
}

export async function validatePeerInfoString(node: LibP2PNode, str: string, opts: Required<AbortOptions>){
    try {
        const { peerId, envelope } = parsePeerInfoString(str)
        const valid = await envelope.validate(PeerRecord.DOMAIN, opts)
        if(!valid)
            return 'Envelope signature is not valid'
        if(peerId.toString() === node.peerId.toString())
            return 'Can not dial self'
        if(node.getConnections(peerId).length)
            return 'Already connected'
        if(node.components.connectionManager.getDialQueue().some(job => job.peerId === peerId))
            return 'Already in dial queue'
    } catch(unk_err) {
        const err = unk_err as Error
        return err.message
    }
}

export async function consumePeerInfoString(node: LibP2PNode, str: string, opts: Required<AbortOptions>){
    const { peerId, buffer } = parsePeerInfoString(str)
    if(peerId.toString() !== node.peerId.toString())
    if(await node.peerStore.consumePeerRecord(buffer, opts)){
        return peerId
    }
}

export async function connectByPeerInfoString(node: LibP2PNode, str: string, opts: Required<AbortOptions>){
    const peerId = await consumePeerInfoString(node, str, opts)
    if(peerId) await node.dial(peerId, opts)
}

type PeerInfoStringified = {
    id: string
    multiaddrs: string[]
}
export function getPlainTextPeerInfoString(node: LibP2PNode){
    const id = node.peerId
    let multiaddrs = node.getMultiaddrs()
    //multiaddrs = removePrivateAddressesMapper({ id, multiaddrs }).multiaddrs
    multiaddrs = filterDiableMultiaddrs(node, multiaddrs)
    return JSON.stringify({
        id: id.toString(),
        multiaddrs: multiaddrs.map(ma => ma.toString()),
    }, null, 4)
}

function isStringifiedPeerInfo(obj: unknown): obj is PeerInfoStringified {
    return typeof obj === 'object' && obj !== null
        && 'id' in obj && typeof obj['id'] === 'string'
        && 'multiaddrs' in obj && Array.isArray(obj['multiaddrs']) &&
        obj['multiaddrs'].every(v => typeof v === 'string')
}

export async function connectByPlainTextPeerInfoString(node: LibP2PNode, str: string, opts: Required<AbortOptions>){
    const obj = JSON.parse(str) as unknown
    if(isStringifiedPeerInfo(obj)){
        const peerId = peerIdFromString(obj.id)
        const multiaddrs = obj.multiaddrs.map(str => multiaddr(str))
        await node.peerStore.patch(peerId, { multiaddrs }, opts)
        await node.dial(peerId, opts)
        //const connection = await node.dial(peerId, opts)
        //const stream = await createUUStream(connection, `/proxy/${0}`)
        //console.log('Connection established to:', connection.remoteAddr)
        //console.log(Bun.inspect(connection))
        //console.log(Bun.inspect(stream))
    }
}

export enum StreamFlags {
    Unordered = 1 << 0,
    Unreliable = 1 << 1,
}
type WebRTCConnection = Connection & {
    maConn: {
        peerConnection: RTCPeerConnection,
    },
    muxer: {
        init: {
            peerConnection: RTCPeerConnection,
        },
        peerConnection: RTCPeerConnection,
    }
}
//src: @ipshipyard/node-datachannel/src/lib/types.ts
interface DataChannelInitConfig {
    protocol?: string;
    negotiated?: boolean;
    id?: number;
    unordered?: boolean;
    maxPacketLifeTime?: number;
    maxRetransmits?: number;
}
type CreateDataChannel = (label: string, config?: DataChannelInitConfig) => RTCDataChannel
export async function createUUStream(connection: Connection, ...newStreamArgs: Parameters<Connection['newStream']>){
    const flags: StreamFlags = StreamFlags.Unordered | StreamFlags.Unreliable
    const webRTCConnection = connection as WebRTCConnection
    const peerConnection = webRTCConnection.maConn.peerConnection
    console.assert(
        webRTCConnection.muxer.init.peerConnection === peerConnection &&
        webRTCConnection.muxer.peerConnection === peerConnection
    )
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const peerConnection_createDataChannel: CreateDataChannel = peerConnection.createDataChannel
    peerConnection.createDataChannel = (label: string, config?: DataChannelInitConfig) => {
        config ??= {}
        if(flags & StreamFlags.Unordered) config.unordered = true
        if(flags & StreamFlags.Unreliable) config.maxRetransmits = 0
        return peerConnection_createDataChannel.call(peerConnection, label, config)
    }
    const stream = await connection.newStream(...newStreamArgs)
    peerConnection.createDataChannel = peerConnection_createDataChannel
    return stream
}
