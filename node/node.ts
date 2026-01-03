/* eslint-disable @typescript-eslint/no-unused-vars */

import { createLibp2p } from 'libp2p'
import { pinning } from '../network/libp2p/pinning'
import { patchedCrypto } from '../utils/crypto'

import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'

//import { rendezvousClient } from "@canvas-js/libp2p-rendezvous/client"
import { GossipSub, gossipsub, type GossipSubComponents } from '@chainsafe/libp2p-gossipsub'
import { bootstrap } from '@libp2p/bootstrap'
import { identify, identifyPush } from '@libp2p/identify'
import { kadDHT, removePrivateAddressesMapper } from '@libp2p/kad-dht'
import { mdns } from '@libp2p/mdns'
import { uPnPNAT } from '@libp2p/upnp-nat'
import { autoNATv2 } from '@libp2p/autonat-v2'
import { pubsubPeerDiscovery } from '../network/libp2p/discovery/pubsub-discovery'
import { customPing } from '../network/libp2p/ping'
import { logger as loggerClass } from '../utils/log'
import { proxy } from '../utils/proxy/strategy-libp2p'
import { time } from '../utils/proxy/time'

import { keychain } from '@libp2p/keychain'
import { LevelDatastore } from 'datastore-level'

import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { tcp } from '@libp2p/tcp'
import { webRTC, webRTCDirect } from '@libp2p/webrtc'

import { loadOrCreateSelfKey } from '@libp2p/config'
import { isPeerId, KEEP_ALIVE, type AbortOptions, type ComponentLogger, type Connection, type Libp2pEvents, type Logger, type PeerId, type PeerInfo, type PeerStore, type PrivateKey, type Startable, type TypedEventTarget } from '@libp2p/interface'
import { PeerMap, PeerSet } from '@libp2p/peer-collections'
import { peerIdFromCID, peerIdFromString } from '@libp2p/peer-id'
import { PeerRecord, RecordEnvelope } from '@libp2p/peer-record'
import { CODE_P2P_CIRCUIT, multiaddr, type Multiaddr } from '@multiformats/multiaddr'

import type { RTCDataChannel, RTCPeerConnection } from '@ipshipyard/node-datachannel/polyfill'
import type { ConnectionManager, TransportManager } from '@libp2p/interface-internal'

import { console_log } from '../ui/remote/remote'
import { args } from '../utils/args'
import { appDiscoveryTopic, NAME, rtcConfiguration, VERSION } from '../utils/constants-build'
import { deadlyRace, Deferred } from '../utils/promises'
import { tr } from '../utils/translation'

export type LibP2PNode = Awaited<ReturnType<typeof createNodeInternal>> & {
    components: {
        privateKey: PrivateKey
        transportManager: TransportManager
        connectionManager: ConnectionManager
        events: TypedEventTarget<Libp2pEvents>
        peerStore: PeerStore
    }
} & TypedEventTarget<Libp2pEvents & {
    'same-program-peer:discovery': CustomEvent<PeerId>
    //'connection:progress': OpenConnectionProgressEvents
    'connection:begin': CustomEvent<PeerId>
    'connection:fail': CustomEvent<PeerId>
}>

export async function createNode(port: number, opts: Required<AbortOptions>){
    const node = await (createNodeInternal(port, opts) as Promise<LibP2PNode>)
    //node.services.rendezvous['log'] = forComponent('canvas:rendezvous:client')
    //node.components.connectionManager['log'] = forComponent('libp2p:connection-manager')
    //node.components.connectionManager['dialQueue']['log'] = forComponent('libp2p:connection-manager:dial-queue')
    //node.components.events.addEventListener('self:peer:update', (event) => {
    //   loggerClass.log(
    //       'self:peer:update [\n'
    //       + event.detail.previous?.addresses.map(addr => addr.multiaddr.toString()).join(',\n') + '\n], [\n'
    //       + event.detail.peer.addresses.map(addr => addr.multiaddr.toString()).join(',\n') + '\n]'
    //   )
    //})
    await setup(node, opts)
    return node
}

const customLogger = (): ComponentLogger => ({ forComponent })
const forComponent = (name: string): Logger => {
    loggerClass['stream']!.write('[LOGGER]: Registered component ' + name + '\n')
    return Object.assign(
        log.bind(null, 'INFO', name),
        {
            enabled: true,
            //error: () => {},
            //trace: () => {},
            error: log.bind(null, 'ERROR', name),
            trace: log.bind(null, 'TRACE', name),
            newScope: (scope: string) => forComponent(name + ':' + scope)
        }
    )
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function log(type: string, name: string, ...args: any[]): boolean {
    //if(name !== 'libp2p:gossipsub') return true
    //// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return loggerClass['stream']!.write('[LIBP2P][' + type + '][' + name + ']: ' + args.map(arg => Bun.inspect(arg)).join(' ') /*util.format(...args)*/ + '\n')
}

export const serverPeerIDString = '12D3KooWHHyaqcTuPvphwifkP2su2Qis2wWKLZhaobc9cB5qXQak'
export const serverPeerID = peerIdFromString(serverPeerIDString)
export const serverPeerMultiddrStrings = [
    `/ip4/195.133.146.185/udp/42451/webrtc-direct/certhash/uEiBYh4UvCuTLl07oUNUl_1CNkWJAver2h7jLVdZmE0anig/p2p/${serverPeerIDString}`,
    `/ip4/195.133.146.185/tcp/41463/p2p/${serverPeerIDString}`,
]

async function createNodeInternal(port: number, opts: Required<AbortOptions>){

    opts?.signal?.throwIfAborted()

    const keychainInit = { pass: 'yes-i-know-its-very-secure' } //TODO: Password.

    let datastore: LevelDatastore | undefined
        //datastore = new LevelDatastore(path.join(downloads, 'datastore'))
    try {
        await datastore?.open()
    } catch(err) {
        console_log(tr('Failed to open data store:', {}), Bun.inspect(err))
        datastore = undefined
    }

    opts?.signal?.throwIfAborted()

    let privateKey: PrivateKey | undefined
    if(datastore) try {
        privateKey = await loadOrCreateSelfKey(datastore, keychainInit)
    } catch(err) {
        console_log(tr('Failed to load private key:', {}), Bun.inspect(err))
    }

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
                ...Array<string>(3).fill('/p2p-circuit'),
                //`/ip4/0.0.0.0/tcp/0`,
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
        services: {
            ping: customPing(),
            identify: identify(),
            identifyPush: identifyPush(),

            ...(args.allowInternet.enabled ? {
                kadDHT: kadDHT({
                    protocol: '/ipfs/kad/1.0.0',
                    peerInfoMapper: removePrivateAddressesMapper
                }),
                //rendezvous: rendezvousClient({
                //    autoDiscover: true,
                //    autoRegister: {
                //        namespaces: [ appDiscoveryTopic ],
                //        multiaddrs: serverPeerMultiddrStrings,
                //    },
                //}),
                bootstrap: bootstrap({
                    list: [
                        //TODO: Unhardcode.
                        ...serverPeerMultiddrStrings,
                        //src: https://github.com/ipfs/helia/blob/main/packages/helia/src/utils/bootstrappers.ts
                        '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
                        '/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb',
                        '/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt',
                        '/dnsaddr/va1.bootstrap.libp2p.io/p2p/12D3KooWKnDdG3iXw9eTFijk3EWSunZcFi54Zka4wmtqtt6rPxc8',
                        '/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ',
                    ]
                }),
                //torrentPeerDiscovery: torrentPeerDiscovery({
                //    topic: appDiscoveryTopic,
                //    autodial: true,
                //}),
                autoNATv2: autoNATv2(),
                uPnPNAT: uPnPNAT(),
            } : {}),

            //logger: customLogger,

            pubsub: gossipsub({
                allowPublishToZeroTopicPeers: true,
                emitSelf: true,
                //directPeers: args.allowInternet.enabled ? [
                //    {
                //        id: peerIdFromString(serverPeerIDString),
                //        addrs: serverPeerMultiddrStrings.map(maStr => multiaddr(maStr)),
                //    },
                //] : [],
            }) as (components: GossipSubComponents) => GossipSub,
            pubsubPeerDiscovery: pubsubPeerDiscovery({
                topic: appDiscoveryTopic,
            }),
            pinning: pinning(),
            
            mdns: mdns(),
            
            proxy: proxy(),
            time: time(),
        },
        //@ts-expect-error: Types of parameters 'key' and 'key' are incompatible.
        datastore,
        privateKey,
        keychain: keychain(keychainInit),
        start: false,

        connectionMonitor: {
            //enabled: false,
        },
    })

    opts?.signal?.throwIfAborted()

    return node
}

async function setup(node: LibP2PNode, opts: Required<AbortOptions>){

    if(args.allowInternet.enabled){
       await node.peerStore.patch(peerIdFromString(serverPeerIDString), {
           tags: { [`${KEEP_ALIVE}-rendezvous-server`]: { value: 1 } }
       }, opts)
    }

    //TODO: Reintroduce Autodial.
    const peersDiscoveredByNode = new Set<string>()
    const peersDiscoveredByMechanism = new Set<string>()
    node.services.mdns?.addEventListener('peer', onPeerDiscoveredByMechanism)
    //node.services.rendezvous?.addEventListener('peer', onPeerDiscoveredByMechanism)
    node.services.pubsubPeerDiscovery?.addEventListener('peer', onPeerDiscoveredByMechanism)
    function onPeerDiscoveredByMechanism(event: CustomEvent<PeerInfo>){
        const peer = event.detail
        //console_log('*:peer', peer.id.toString())
        if(!peersDiscoveredByMechanism.has(peer.id.toString())){
            peersDiscoveredByMechanism.add(peer.id.toString())
            if(peersDiscoveredByNode.has(peer.id.toString())){
                node.safeDispatchEvent('same-program-peer:discovery', { detail: peer.id })
                patchAndDial(peer.id).catch((/*err*/) => { /* Ignore */ })
            }
        }
    }
    node.addEventListener('peer:discovery', onPeerDiscoveredByNode)
    function onPeerDiscoveredByNode(event: CustomEvent<PeerInfo>){
        const peer = event.detail
        //console_log('discovery:peer', peer.id.toString())
        if(!peersDiscoveredByNode.has(peer.id.toString())){
            peersDiscoveredByNode.add(peer.id.toString())
            if(peersDiscoveredByMechanism.has(peer.id.toString())){
                node.safeDispatchEvent('same-program-peer:discovery', { detail: peer.id })
                patchAndDial(peer.id).catch((/*err*/) => { /* Ignore */ })
            }
        }
    }
    const patchedPeers = new PeerSet()
    async function patchAndDial(peerId: PeerId){
        if(!patchedPeers.has(peerId)){
            patchedPeers.add(peerId)
            await node.peerStore.patch(peerId, {
                tags: {
                    [`${KEEP_ALIVE}-same-program`]: { value: 1 }
                }
            })
        }
        await node.dial(peerId)
    }

    //const peersDiscoveredByTorrent = new Set<string>()
    //node.services.torrentPeerDiscovery?.addEventListener('peer', (event) => {
    //    const peer = event.detail
    //    //console_log('*:peer', peer.id.toString())
    //    if(!peersDiscoveredByTorrent.has(peer.id.toString())){
    //        peersDiscoveredByTorrent.add(peer.id.toString())
    //        node.safeDispatchEvent('same-program-peer:discovery', { detail: peer.id })
    //    }
    //})
    //node.services.torrentPeerDiscovery?.addEventListener('connection:begin', (event) => {
    //    node.safeDispatchEvent('connection:begin', event)
    //})
    //node.services.torrentPeerDiscovery?.addEventListener('connection:fail', (event) => {
    //    node.safeDispatchEvent('connection:fail', event)
    //})

    const cm = node.components.connectionManager
    const cm_openConnection = cm.openConnection.bind(cm)
    cm.openConnection = async (peer, options) => {

        if(!isPeerId(peer))
            return cm_openConnection(peer, options)

        options ??= {}
        const options_onProgress = options.onProgress
        options.onProgress = (event) => {
            //node.safeDispatchEvent('connection:progress', event)
            if(event.type === 'dial-queue:add-to-dial-queue' && node.getConnections(peer).length === 0){
                node.safeDispatchEvent('connection:begin', { detail: peer })
            }
            options_onProgress?.(event)
        }

        let error: Error | undefined
        let connection: Connection | undefined
        try {
            connection = await cm_openConnection(peer, options)
        } catch(err) {
            error = err as Error
        }

        if(error && node.getConnections(peer).length === 0){
            node.safeDispatchEvent('connection:fail', { detail: peer })
        }

        if(error) throw error
        return connection!
    }

    await node.start()
}

export async function stop(node: LibP2PNode){
    await Promise.all([
        (async () => {
            const pubSubPeerDiscovery = node.services.pubsubPeerDiscovery
            await pubSubPeerDiscovery?.beforeStop()
            pubSubPeerDiscovery.stop()
        })(),
        //(async () => {
        //    const rendezvous = node.services.rendezvous
        //    await rendezvous?.connect(serverPeerID, async (point) => {
        //        //await point.register(appDiscoveryTopic, { ttl: 1 })
        //        await point.unregister(appDiscoveryTopic)
        //    })
        //    rendezvous?.beforeStop()
        //    rendezvous?.stop()
        //})(),
    ])
    const connectionManager = node.components.connectionManager as unknown as Startable
    await connectionManager.stop()
    await node.stop()
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
            return tr('Envelope signature is not valid')
        if(peerId.toString() === node.peerId.toString())
            return tr('Can not dial self')
        if(node.getConnections(peerId).length)
            return tr('Already connected')
        if(node.components.connectionManager.getDialQueue().some(job => job.peerId === peerId))
            return tr('Already in dial queue')
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

export async function obtainConnection(node: LibP2PNode, peerId: PeerId, opts: Required<AbortOptions>, addrs?: Uint8Array[]){
    let connection = getExistingConnection(node, peerId)
    if(!connection){
        connection = await deadlyRace([
            async (opts) => tryConnectTo(node, peerId, opts, addrs),
            async (opts) => waitForConnectionFrom(node, peerId, opts),
        ], opts)
    }
    return connection
}

function getExistingConnection(node: LibP2PNode, peerId: PeerId){
    //TODO: This code block is copied from UseExistingLibP2PConnection (extends ConnectionStrategy)
    const connections = node.getConnections(peerId)
        .filter(connection => connection.status === 'open' && !connection.limits)
    return connections.at(0)
}

async function tryConnectTo(node: LibP2PNode, peerId: PeerId, opts: Required<AbortOptions>, addrs?: Uint8Array[]){
    if(addrs){
        const { peerStore } = node.components
        const multiaddrs = addrs.map(addr => multiaddr(addr))
        await peerStore.patch(peerId, { multiaddrs }, opts)
    }
    const connection = await node.dial(peerId, opts)
    return connection
}

async function waitForConnectionFrom(node: LibP2PNode, peerId: PeerId, opts: Required<AbortOptions>){
    const deferred = new Deferred<Connection>(opts)
    deferred.addEventListener(node, 'connection:open', (event: CustomEvent<Connection>) => {
        const connection = event.detail
        if(connection.remotePeer.toString() === peerId.toString())
            deferred.resolve(connection)
    })
    return deferred.promise
}
