/**
 * @packageDocumentation
 *
 * When the discovery module is started by libp2p it subscribes to the discovery pubsub topic(s)
 *
 * It will immediately broadcast your peer data via pubsub and repeat the broadcast on the configured `interval`
 *
 * ## Security Considerations
 *
 * It is worth noting that this module does not include any message signing for broadcasts. The reason for this is that libp2p-pubsub supports message signing and enables it by default, which means the message you received has been verified to be from the originator, so we can trust that the peer information we have received is indeed from the peer who owns it. This doesn't mean the peer can't falsify its own records, but this module isn't currently concerned with that scenario.
 *
 * ## Requirements
 *
 * This module *MUST* be used on a libp2p node that is running [Pubsub](https://github.com/libp2p/js-libp2p-pubsub). If Pubsub does not exist, or is not running, this module will not work.
 *
 * To run a PubSub service, include a `pubsub` implementation in your services map such as `@chainsafe/libp2p-gossipsub`.
 *
 * For more information see the [docs on customizing libp2p](https://github.com/libp2p/js-libp2p/blob/main/doc/CONFIGURATION.md#customizing-libp2p).
 *
 * @example Usage in js-libp2p
 *
 * See the [js-libp2p configuration docs](https://github.com/libp2p/js-libp2p/blob/main/doc/CONFIGURATION.md#customizing-peer-discovery) for how to include this module as a peer discovery module in js-libp2p.
 *
 * If you are only interested in listening to the global pubsub topic the minimal configuration for using this with libp2p is:
 *
 * ```js
 * import { createLibp2p } from 'libp2p'
 * import { websockets } from '@libp2p/websockets'
 * import { yamux } from '@chainsafe/libp2p-yamux'
 * import { noise } from '@chainsafe/libp2p-noise'
 * import { gossipsub } from '@chainsafe/libp2p-gossipsub'
 * import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery'
 * import { identify } from 'libp2p/identify'
 *
 * const node = await createLibp2p({
 *   transports: [
 *     websockets()
 *   ], // Any libp2p transport(s) can be used
 *   streamMuxers: [
 *     yamux()
 *   ],
 *   connectionEncryption: [
 *     noise()
 *   ],
 *   peerDiscovery: [
 *     pubsubPeerDiscovery()
 *   ],
 *   services: {
 *     pubsub: gossipsub(),
 *     identify: identify()
 *   }
 * })
 * ```
 *
 * @example Customizing Pubsub Peer Discovery
 *
 * There are a few options you can use to customize `Pubsub Peer Discovery`. You can see the detailed [options](#options) below.
 *
 * ```js
 * // ... Other imports from above
 * import PubSubPeerDiscovery from '@libp2p/pubsub-peer-discovery'
 *
 * // Custom topics
 * const topics = [
 *   `myApp._peer-discovery._p2p._pubsub`, // It's recommended but not required to extend the global space
 *   '_peer-discovery._p2p._pubsub' // Include if you want to participate in the global space
 * ]
 *
 * const node = await createLibp2p({
 *   // ...
 *   peerDiscovery: [
 *     pubsubPeerDiscovery({
 *       interval: 10000,
 *       topics: topics, // defaults to ['_peer-discovery._p2p._pubsub']
 *       listenOnly: false
 *     })
 *   ]
 * })
 * ```
 *
 * ## Options
 *
 * | Name       | Type            | Description                                                                                                    |
 * | ---------- | --------------- | -------------------------------------------------------------------------------------------------------------- |
 * | interval   | `number`        | How often (in `ms`), after initial broadcast, your node should broadcast your peer data. Default (`10000ms`)   |
 * | topics     | `Array<string>` | An Array of topic strings. If set, the default topic will not be used and must be included explicitly here     |
 * | listenOnly | `boolean`       | If true it will not broadcast peer data. Dont set this unless you have a specific reason to. Default (`false`) |
 *
 * ## Default Topic
 *
 * The default pubsub topic the module subscribes to is `_peer-discovery._p2p._pubsub`, which is also set on `PubsubPeerDiscovery.TOPIC`.
 */

import { publicKeyFromProtobuf, publicKeyToProtobuf } from '@libp2p/crypto/keys'
import { TypedEventEmitter, peerDiscoverySymbol } from '@libp2p/interface'
import { peerIdFromPublicKey } from '@libp2p/peer-id'
import { multiaddr } from '@multiformats/multiaddr'
import { Peer as PBPeer } from './peer.js'
import type { PeerDiscovery, PeerDiscoveryEvents, PeerId, PeerInfo, Message, PubSub, Startable, ComponentLogger, Logger } from '@libp2p/interface'
import type { AddressManager } from '@libp2p/interface-internal'

export const TOPIC = '_peer-discovery._p2p._pubsub'

export interface PubsubPeerDiscoveryInit {
  /**
   * How often (ms) we should broadcast our infos
   */
  interval?: number

  /**
   * What topics to subscribe to. If set, the default will NOT be used.
   */
  topics?: string[]

  /**
   * If true, we will not broadcast our peer data
   */
  listenOnly?: boolean
}

export interface PubSubPeerDiscoveryComponents {
  peerId: PeerId
  pubsub?: PubSub
  addressManager: AddressManager
  logger: ComponentLogger
}

/**
 * A Peer Discovery Service that leverages libp2p Pubsub to find peers.
 */
export class PubSubPeerDiscovery extends TypedEventEmitter<PeerDiscoveryEvents> implements PeerDiscovery, Startable {
  public readonly [peerDiscoverySymbol] = true
  public readonly [Symbol.toStringTag] = '@libp2p/pubsub-peer-discovery'

  private readonly interval: number
  private readonly listenOnly: boolean
  private readonly topics: string[]
  private intervalId?: ReturnType<typeof setInterval>
  private readonly components: PubSubPeerDiscoveryComponents
  private readonly log: Logger

  constructor (components: PubSubPeerDiscoveryComponents, init: PubsubPeerDiscoveryInit = {}) {
    super()

    const {
      interval,
      topics,
      listenOnly
    } = init

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

    this._onMessage = this._onMessage.bind(this)
  }

  isStarted (): boolean {
    return this.intervalId != null
  }

  start (): void {

  }

  /**
   * Subscribes to the discovery topic on `libp2p.pubsub` and performs a broadcast
   * immediately, and every `this.interval`
   */
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

  /**
   * Unsubscribes from the discovery topic
   */
  stop (): void {
    if (this.intervalId != null) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
    }
  }

  /**
   * Performs a broadcast via Pubsub publish
   */
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

  /**
   * Handles incoming pubsub messages for our discovery topic
   */
  _onMessage (event: CustomEvent<Message>): void {
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

      this.safeDispatchEvent<PeerInfo>('peer', {
        detail: {
          id: peerId,
          multiaddrs: peer.addrs.map(b => multiaddr(b))
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
