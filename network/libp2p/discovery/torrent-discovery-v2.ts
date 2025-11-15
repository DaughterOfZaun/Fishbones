import { TypedEventEmitter, type ComponentLogger, type Logger, type PeerId, type PeerInfo, type PrivateKey, type Startable, type Upgrader } from "@libp2p/interface"
import { WebRTCMultiaddrConnection } from '../../../node_modules/@libp2p/webrtc/src/maconn.ts'
import { DataChannelMuxerFactory } from '../../../node_modules/@libp2p/webrtc/src/muxer.ts'
import * as WebRTC from '@ipshipyard/node-datachannel/polyfill'

//@ts-expect-error: Could not find a declaration file for module 'torrent-discovery'
import UntypedDiscovery from 'torrent-discovery'
const Discovery = UntypedDiscovery as DiscoveryConstructor
import { isWSTracker, type DiscoveryConstructor, type DiscoveryInit, type DiscoveryInstance, type SimplePeer, type TrackerInit } from "./torrent-discovery-types";

import crypto from 'node:crypto'
import type { BinaryLike } from 'node:crypto'
import { multiaddr } from "@multiformats/multiaddr"
import { rtcConfiguration } from "../../../utils/constants-build.ts"
import { peerIdFromString } from "@libp2p/peer-id"
import { PeerMap } from "@libp2p/peer-collections"
import { bin2hex } from "uint8-util"
//src: bittorrent-dht/client.js
function sha1(buf: BinaryLike){
    return crypto.createHash('sha1').update(buf).digest()
}

const VERSION = '2.6.7'
//import { version as VERSION } from 'webtorrent/package.json'
const USER_AGENT = `WebTorrent/${VERSION} (https://webtorrent.io)`

interface TorrentPeerDiscoveryInit {
    topic: string
    autodial: true
}

interface TorrentPeerDiscoveryComponents {
    peerId: PeerId
    privateKey: PrivateKey
    logger: ComponentLogger
    upgrader: Upgrader
}

interface TorrentPeerDiscoveryEvents {
    'peer': CustomEvent<PeerInfo>
    'connection:begin': CustomEvent<PeerId>
    'connection:fail': CustomEvent<PeerId>
}

export function torrentPeerDiscovery(init: TorrentPeerDiscoveryInit): (components: TorrentPeerDiscoveryComponents) => TorrentPeerDiscovery {
    return (components: TorrentPeerDiscoveryComponents) => new TorrentPeerDiscovery(init, components)
}

enum PeerStatus {
    Disconnected,
    Connecting,
    Connected,
}

export class TorrentPeerDiscovery extends TypedEventEmitter<TorrentPeerDiscoveryEvents> implements Startable {

    private readonly log: Logger
    private controller: AbortController | null = null
    private discovery: DiscoveryInstance | null = null
    private readonly statuses = new PeerMap<PeerStatus>()

    constructor(
        private readonly init: TorrentPeerDiscoveryInit,
        private readonly components: TorrentPeerDiscoveryComponents
    ){
        super()
        this.log = components.logger.forComponent('libp2p:torrent-discovery')
    }

    start(){
        if(this.controller){
            this.log('already started')
            return
        }
        this.controller = new AbortController()

        const hash = sha1

        const optsDHT = false
        const optsTracker: TrackerInit = {
            //rtcConfig: { iceServers: rtcConfiguration.iceServers[0]!.urls },
            rtcConfig: rtcConfiguration,
            wrtc: WebRTC,
        }

        const optsDiscovery: DiscoveryInit = {
            port: 5119,

            infoHash: hash(this.init.topic),
            peerId: hash(this.components.privateKey.publicKey.raw),
            userAgent: USER_AGENT,
            
            lsd: false,
            
            tracker: optsTracker,
            announce: [ //TODO: Unhardcode.
                'wss://tracker.ghostchu-services.top:443/announce',
                'ws://tracker.ghostchu-services.top:80/announce',
                'wss://tracker.openwebtorrent.com:443/announce',
                'wss://tracker.webtorrent.dev:443/announce',
                'wss://tracker.btorrent.xyz:443/announce',
                'wss://tracker.files.fm:7073/announce',
                'ws://tracker.files.fm:7072/announce',
            ],

            dht: optsDHT,
            dhtPort: 0,
        }
        const discovery = this.discovery = new Discovery(optsDiscovery)
        discovery.addListener('peer', this.onPeer)
        discovery.addListener('error', this.onError)
        discovery.addListener('warning', this.onWarning)
        discovery.addListener('trackerAnnounce', () => {
            this.log('trackerAnnounce')
        })

        const usedConnections = new Map<string, SimplePeer>()
        
        discovery.tracker?._trackers.forEach(tracker => {

            if(!isWSTracker(tracker)){
                this.log('skipping non-ws tracker')
                return
            }

            let nextPeerId: string | undefined
            const tracker_onAnnounceResponse = tracker._onAnnounceResponse.bind(tracker)
            tracker._onAnnounceResponse = (data) => {
                if(data.peer_id && data.offer){
                    nextPeerId = bin2hex(data.peer_id)
                    if(usedConnections.has(nextPeerId)){
                        nextPeerId = undefined
                        delete data.offer
                    }
                }
                if(data.peer_id && data.answer && data.offer_id){
                    const localId = bin2hex(tracker.client._peerIdBinary)
                    const remoteId = bin2hex(data.peer_id)
                    const offerId = bin2hex(data.offer_id)
                    const incomingConnection = tracker.peers[offerId]
                    const outgoingConnection = usedConnections.get(remoteId)
                    if(incomingConnection && !outgoingConnection){
                        usedConnections.set(remoteId, incomingConnection)
                    }
                    if(incomingConnection && outgoingConnection){
                        const remoteNumber = parseInt(remoteId.slice(-6), 16)
                        const localNumber = parseInt(localId.slice(-6), 16)
                        if(remoteNumber > localNumber){
                            outgoingConnection.destroy()
                        } else {
                            incomingConnection.destroy()

                            const peer = incomingConnection
                            
                            clearTimeout(peer.trackerTimeout!)
                            peer.trackerTimeout = null
                            delete tracker.peers[offerId]

                            delete data.answer
                        }
                    }
                }
                return tracker_onAnnounceResponse(data)
            }

            const tracker_createPeer = tracker._createPeer.bind(tracker)
            tracker._createPeer = (opts) => {
                
                type Data = { peerId?: string, sdp?: string }
                type Peer = { peerId?: PeerId } & SimplePeer
                
                const peerIdSDPRegex = /a=peer-id:(?<peerId>.*)\s\n/
                const peer = tracker_createPeer(opts) as Peer

                const peer_once = peer.once.bind(peer)
                peer.once = (event, listener) => {
                    if(event == 'signal'){
                        this.log('overriding peer.once.signal listener')
                        return peer_once('signal', (data: Data) => {
                            const peerId = this.components.peerId
                            //TODO: data.signature
                            //data.peerId = peerId.toString()
                            if(data.sdp){
                                data.sdp = data.sdp.replace(peerIdSDPRegex, '')
                                data.sdp += `a=peer-id:${peerId.toString()}\r\n`
                            }
                            return listener(data, undefined!)
                        })
                    } else {
                        this.log('passing peer.once.signal listener as is')
                        return peer_once(event, listener)
                    }
                }
                
                const peer_signal = peer.signal.bind(peer)
                peer.signal = (data: Data) => {
                    //TODO: data.signature
                    //if(typeof data.peerId === 'string'){
                    //    this.log('got a peerId string')
                    //    peer.peerId = peerIdFromString(data.peerId)
                    //    delete data.peerId
                    //}
                    data.sdp?.replace(/a=peer-id:(?<peerId>.*)\s\n/, (m, peerIdString: string) => {
                        this.log('got a peerId string')
                        const peerId = peerIdFromString(peerIdString)
                        peer.peerId = peerId
                        const info: PeerInfo = { id: peerId, multiaddrs: [] }
                        this.safeDispatchEvent('peer', { detail: info })
                        const currentStatus = this.statuses.get(peerId) ?? PeerStatus.Disconnected
                        if(currentStatus == PeerStatus.Disconnected){
                            this.statuses.set(peerId, PeerStatus.Connecting)
                            this.safeDispatchEvent('connection:begin', { detail: peerId })
                        }
                        return ''
                    })
                    return peer_signal(data)
                }

                const peer_id = nextPeerId
                nextPeerId = undefined
                if(peer_id){
                    usedConnections.set(peer_id, peer)
                }
                
                const onFail = (reason: string, err?: Error) => {
                    this.log(`peer.${reason}`, err)

                    const peerId = peer.peerId
                    if(peerId){
                        const currentStatus = this.statuses.get(peerId) ?? PeerStatus.Disconnected
                        if(currentStatus == PeerStatus.Connecting){
                            const event = { detail: peerId }
                            this.safeDispatchEvent('connection:fail', event)
                        }
                        this.statuses.delete(peerId)
                    }

                    if(peer_id){
                        usedConnections.delete(peer_id)
                    }
                }

                peer.on('error', onFail.bind(this, 'error'))
                peer.on('close', onFail.bind(this, 'close'))
                peer.on('disconnect', onFail.bind(this, 'disconnect'))
                peer.on('connect', () => {
                    const peerId = peer.peerId
                    if(!peerId) return
                    this.statuses.set(peerId, PeerStatus.Connected)
                })
                
                return peer
            }
        })
    }

    async stop(){
        if(!this.controller){
            this.log('already stopped')
            return
        }
        this.controller.abort()
        this.controller = null

        const discovery = this.discovery
        if(!discovery) return

        discovery.removeListener('peer', this.onPeer)
        discovery.removeListener('error', this.onError)
        discovery.removeListener('warning', this.onWarning)

        return new Promise<void>(resolve => {
            discovery.destroy(() => resolve())
        })
    }

    private knownPeers = new Set<SimplePeer>()
    private onPeer = (peer: string | SimplePeer) => {
        this.log('peer')
        
        if(typeof peer === 'string') return
        if(this.knownPeers.has(peer)) return
        this.knownPeers.add(peer)

        if(peer.connected){
            this.log('peer.connected')
            void this.handleConnectedPeer(peer) //TODO: Handle errors.
        } else {
            peer.once('connect', () => {
                this.log('peer.connect')
                void this.handleConnectedPeer(peer) //TODO: Handle errors.
            })
        }
    }

    private async handleConnectedPeer(peer: SimplePeer){

        const signal = this.controller?.signal
        if(!signal){
            this.log.error('not started. destroying peer')
            peer.destroy()
            return
        }

        const peerConnection = peer._pc
        const muxerFactory = new DataChannelMuxerFactory(this.components, {
            //dataChannelOptions: this.init.dataChannel,
            peerConnection,
        })

        const peerId = (peer as SimplePeer & { peerId?: PeerId }).peerId
        if(!peerId){
            this.log.error('peer.peerId is undefined. destroying peer')
            peer.destroy()
            return
        }

        const remoteAddress = multiaddr(`/ip${peer.remoteFamily?.replace('IPv', '')}/${peer.remoteAddress}/udp/${peer.remotePort}/webrtc/p2p/${peerId.toString()}`)
        const webRTCConn = new WebRTCMultiaddrConnection(this.components, {
            peerConnection,
            timeline: { open: (new Date()).getTime() },
            //metrics: this.metrics?.listenerEvents,
            remoteAddr: remoteAddress,
        })

        if(peer.initiator){
            this.log('upgrading outbound connection')
            //const connection =
            await this.components.upgrader.upgradeOutbound(webRTCConn, {
                //onProgress: options.onProgress,
                skipProtection: true,
                skipEncryption: true,
                muxerFactory,
                signal,
            })
        } else {
            this.log('upgrading inbound connection')
            await this.components.upgrader.upgradeInbound(webRTCConn, {
                skipEncryption: true,
                skipProtection: true,
                muxerFactory,
                signal,
            })
        }
    }

    private onError = (err: Error) => {
        this.log.error('error', err)
    }
    private onWarning = (err: Error) => {
        this.log.error('warning', err)
    }
}