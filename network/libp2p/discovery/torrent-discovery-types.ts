import type { BinaryLike } from 'node:crypto'

import type { RTCPeerConnection } from '@ipshipyard/node-datachannel/polyfill'

export type { SimplePeer }
import type { SimplePeer as SimplePeerNamespace, Instance as SimplePeerInstance } from 'simple-peer'
interface SimplePeer extends SimplePeerInstance {
    _id: string
    _pc: RTCPeerConnection
    initiator: boolean
    trackerTimeout: string | number | undefined | null
    remoteAddress: string | undefined
    remoteFamily: 'IPv4' | 'IPv6' | undefined
    remotePort: number | undefined
}

type KRPCSocket = unknown
type Socket = unknown
type KRPC = unknown

export interface KRPCSocketInit {
    timeout?: number //= 2000
    isIP?: (input: string) => number
    socket?: Socket
}

export interface KRPCInit extends KRPCSocketInit {
    idLength?: number //= 20
    id?: string | Buffer | ArrayBufferView
    nodeId?: string | Buffer | ArrayBufferView
    krpcSocket?: KRPCSocket
    nodes?: boolean | { host: string, port: number }[]
    bootstrap?: boolean | { host: string, port: number }[]
    concurrency?: number //= 16
    backgroundConcurrency?: number //= 4
    k?: number //= 20
}

export interface DHTInit extends KRPCInit {
    maxTables?: number //= 1000
    maxValues?: number //= 1000
    maxAge?: number //= 0
    maxPeers?: number //= 10000
    hash?: (data: BinaryLike) => Buffer
    krpc?: KRPC
    verify?: (signature: Uint8Array, data: Uint8Array, publicKeyRaw: Uint8Array) => boolean //= null
    host?: string //= null
    timeBucketOutdated?: number //= 15 * 60 * 1000
    bootstrap?: boolean //= true
}

export interface DiscoveryInit {
    peerId: string | Buffer
    infoHash: string | Buffer
    port: number

    userAgent?: string
    announce?: string[] //= []
    intervalMs?: number //= 15 * 60 * 1000
    tracker?: boolean | TrackerInit
    dht?: boolean | DHTInit
    dhtPort?: number
    lsd?: boolean
}

export interface TrackerInit {
    getAnnounceOpts?: () => unknown
    rtcConfig?: unknown
    wrtc?: unknown
    proxyOpts?: unknown
}

export interface DiscoveryConstructor {
    new(opts?: DiscoveryInit): DiscoveryInstance
}

export interface DiscoveryInstance {

    tracker?: TrackerInstance

    addListener(event: 'peer', cb: (peer: string | SimplePeer, src: 'dht' | 'tracker' | 'lsd') => void): void;
    addListener(event: 'error', cb: (err: Error) => void): void;
    addListener(event: 'warning', cb: (err: Error) => void): void;
    addListener(event: 'dhtAnnounce', cb: () => void): void;
    addListener(event: 'trackerAnnounce', cb: () => void): void;

    removeListener(event: 'peer', cb: (peer: string | SimplePeer) => void): void;
    removeListener(event: 'error', cb: (err: Error) => void): void;
    removeListener(event: 'warning', cb: (err: Error) => void): void;
    removeListener(event: 'dhtAnnounce', cb: () => void): void;
    removeListener(event: 'trackerAnnounce', cb: () => void): void;

    destroy(cb: (err: Error, res: unknown) => void): void;
}

export interface TrackerInstance {
    _trackers: TrackerStrategy[]
}

type TrackerStrategy = HTTPTracker | UDPTracker | WebSocketTracker
type HTTPTracker = { constructor: { name: 'HTTPTracker' } }
type UDPTracker = { constructor: { name: 'UDPTracker' } }
export interface WebSocketTracker {
    client: { _peerIdBinary: string }
    constructor: { name: 'WebSocketTracker' }
    peers: Record<string, SimplePeer>
    _createPeer(opts?: ConstructorParameters<SimplePeerNamespace>[0]): SimplePeer
    _onAnnounceResponse(data: {
        peer_id?: string, offer_id?: string, offer?: object, answer?: object 
    }): void
}

export function isWSTracker(tracker: TrackerStrategy): tracker is WebSocketTracker {
    return tracker.constructor.name === 'WebSocketTracker'
}