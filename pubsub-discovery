import { publicKeyFromProtobuf, publicKeyToProtobuf } from '@libp2p/crypto/keys'
import { TypedEventEmitter, peerDiscoverySymbol } from '@libp2p/interface'
import { peerIdFromPublicKey } from '@libp2p/peer-id'
import { multiaddr } from '@multiformats/multiaddr'
import { Peer as PBPeer } from './peer.js'
import type { PeerDiscovery, PeerDiscoveryEvents, PeerId, PeerInfo, Message, PubSub, Startable, ComponentLogger, Logger } from '@libp2p/interface'
import type { AddressManager } from '@libp2p/interface-internal'

export const TOPIC = '_peer-discovery._p2p._pubsub'

export interface PubsubPeerDiscoveryInit {
  interval?: number
  topics?: string[]
  listenOnly?: boolean
}

export interface PubSubPeerDiscoveryComponents {
  peerId: PeerId
  pubsub?: PubSub
  addressManager: AddressManager
  logger: ComponentLogger
}

export class PubSubPeerDiscovery extends TypedEventEmitter<PeerDiscoveryEvents> implements PeerDiscovery, Startable {
  public readonly [peerDiscoverySymbol] = true
  public readonly [Symbol.toStringTag] = '@libp2p/pubsub-peer-discovery'

  private listenOnly: boolean
  private data: PBPeer.AdditionalData

  private readonly interval: number
  private readonly topics: string[]
  private intervalId?: ReturnType<typeof setInterval>
  private readonly components: PubSubPeerDiscoveryComponents
  private readonly log: Logger

  constructor (components: PubSubPeerDiscoveryComponents, init: PubsubPeerDiscoveryInit = {}) {
    super()

    const { interval, topics, listenOnly } = init

    this.components = components
    this.interval = interval ?? 10000
    this.listenOnly = listenOnly ?? false
    this.log = components.logger.forComponent('libp2p:discovery:pubsub')

    // Ensure we have topics
    if (Array.isArray(topics) && topics.length > 0) {
      this.topics = topics
    } else {
      this.topics = [TOPIC]
    }
  }

  isStarted (): boolean {
    return this.intervalId != null
  }

  start (): void {}

  afterStart (): void {
    if (this.intervalId != null) {
      return
    }

    const pubsub = this.components.pubsub

    if (pubsub == null) {
      throw new Error('PubSub not configured')
    }

    // Subscribe to pubsub
    for (const topic of this.topics) {
      pubsub.subscribe(topic)
      pubsub.addEventListener('message', this._onMessage)
    }

    // Don't broadcast if we are only listening
    if (this.listenOnly) {
      return
    }

    // Broadcast immediately, and then run on interval
    this._broadcast()

    // Periodically publish our own information
    this.intervalId = setInterval(() => {
      this._broadcast()
    }, this.interval)
  }

  beforeStop (): void {
    const pubsub = this.components.pubsub

    if (pubsub == null) {
      throw new Error('PubSub not configured')
    }

    for (const topic of this.topics) {
      pubsub.unsubscribe(topic)
      pubsub.removeEventListener('message', this._onMessage)
    }
  }

  stop (): void {
    if (this.intervalId != null) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
    }
  }

  _broadcast (): void {
    const peerId = this.components.peerId

    if (peerId.publicKey == null) {
      throw new Error('PeerId was missing public key')
    }

    const peer = {
      publicKey: publicKeyToProtobuf(peerId.publicKey),
      addrs: this.components.addressManager.getAddresses().map(ma => ma.bytes)
    }

    const encodedPeer = PBPeer.encode(peer)
    const pubsub = this.components.pubsub

    if (pubsub == null) {
      throw new Error('PubSub not configured')
    }

    for (const topic of this.topics) {
      if (pubsub.getSubscribers(topic).length === 0) {
        this.log('skipping broadcasting our peer data on topic %s because there are no peers present', topic)
        continue
      }

      this.log('broadcasting our peer data on topic %s', topic)
      void pubsub.publish(topic, encodedPeer)
    }
  }

  _onMessage = (event: CustomEvent<Message>): void => {
    if (!this.isStarted()) {
      return
    }

    const message = event.detail

    if (!this.topics.includes(message.topic)) {
      return
    }

    try {
      const peer = PBPeer.decode(message.data)
      const publicKey = publicKeyFromProtobuf(peer.publicKey)
      const peerId = peerIdFromPublicKey(publicKey)

      // Ignore if we received our own response
      if (peerId.equals(this.components.peerId)) {
        return
      }

      this.log('discovered peer %p on %s', peerId, message.topic)

      this.safeDispatchEvent<PeerInfo & { data?: PBPeer.AdditionalData }>('peer', {
        detail: {
          id: peerId,
          multiaddrs: peer.addrs.map(b => multiaddr(b)),
          data: peer.data,
        }
      })
    } catch (err) {
      this.log.error('error handling incoming message', err)
    }
  }
}

export function pubsubPeerDiscovery (init: PubsubPeerDiscoveryInit = {}): (components: PubSubPeerDiscoveryComponents) => PeerDiscovery {
  return (components: PubSubPeerDiscoveryComponents) => new PubSubPeerDiscovery(components, init)
}
