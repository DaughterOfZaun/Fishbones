/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * @packageDocumentation
 *
 * A [libp2p transport](https://docs.libp2p.io/concepts/transports/overview/) based on the TCP networking stack.
 *
 * @example
 *
 * ```TypeScript
 * import { createLibp2p } from 'libp2p'
 * import { tcp } from '@libp2p/tcp'
 * import { multiaddr } from '@multiformats/multiaddr'
 *
 * const node = await createLibp2p({
 *   transports: [
 *     tcp()
 *   ]
 * })
 *
 * const ma = multiaddr('/ip4/123.123.123.123/tcp/1234')
 *
 * // dial a TCP connection, timing out after 10 seconds
 * const connection = await node.dial(ma, {
 *   signal: AbortSignal.timeout(10_000)
 * })
 *
 * // use connection...
 * ```
 */

import type { ComponentLogger, Connection, CounterGroup, CreateListenerOptions, DialTransportOptions, Listener, ListenerEvents, Logger, MetricGroup, Metrics, MultiaddrConnection, OutboundConnectionUpgradeEvents, Transport, Upgrader } from '@libp2p/interface'
import { AbortError, AlreadyStartedError, InvalidParametersError, NotStartedError, TimeoutError, serviceCapabilities, transportSymbol } from '@libp2p/interface'
import { getThinWaistAddresses } from '@libp2p/utils/get-thin-waist-addresses'
import { ipPortToMultiaddr as toMultiaddr } from '@libp2p/utils/ip-port-to-multiaddr'
import type { AbortOptions, Multiaddr } from '@multiformats/multiaddr'
import { multiaddr } from '@multiformats/multiaddr'
import { TCP as TCPMatcher } from '@multiformats/multiaddr-matcher'
import { TypedEventEmitter, setMaxListeners } from 'main-event'
import type { IpcSocketConnectOpts, ListenOptions, Socket, TcpSocketConnectOpts } from 'net'
//import net from 'net'
import os from 'os'
import type { DeferredPromise } from 'p-defer'
import pDefer from 'p-defer'
import { pEvent } from 'p-event'
import path from 'path'
import type { ProgressEvent } from 'progress-events'
import { CustomProgressEvent } from 'progress-events'
import { raceEvent } from 'race-event'
import { duplex } from 'stream-to-it'
//@ts-expect-error Could not find a declaration file for module 'utp-native'.
import net from 'utp-native'

interface CloseServerOnMaxConnectionsOpts {
  /**
   * Server listens once connection count is less than `listenBelow`
   */
  listenBelow: number

  /**
   * Close server once connection count is greater than or equal to `closeAbove`
   */
  closeAbove: number

  /**
   * Invoked when there was an error listening on a socket
   */
  onListenError?(err: Error): void
}

interface TCPOptions {
  /**
   * An optional number in ms that is used as an inactivity timeout after which the socket will be closed
   */
  inboundSocketInactivityTimeout?: number

  /**
   * An optional number in ms that is used as an inactivity timeout after which the socket will be closed
   */
  outboundSocketInactivityTimeout?: number

  /**
   * When closing a socket, wait this long for it to close gracefully before it is closed more forcibly
   */
  socketCloseTimeout?: number

  /**
   * Set this property to reject connections when the server's connection count gets high.
   * https://nodejs.org/api/net.html#servermaxconnections
   */
  maxConnections?: number

  /**
   * Parameter to specify the maximum length of the queue of pending connections
   * https://nodejs.org/dist/latest-v18.x/docs/api/net.html#serverlisten
   */
  backlog?: number

  /**
   * Close server (stop listening for new connections) if connections exceed a limit.
   * Open server (start listening for new connections) if connections fall below a limit.
   */
  closeServerOnMaxConnections?: CloseServerOnMaxConnectionsOpts

  /**
   * Options passed to `net.connect` for every opened TCP socket
   */
  dialOpts?: TCPSocketOptions

  /**
   * Options passed to every `net.createServer` for every TCP server
   */
  listenOpts?: TCPSocketOptions
}

/**
 * Expose a subset of net.connect options
 */
interface TCPSocketOptions {
  /**
   * @see https://nodejs.org/api/net.html#socketconnectoptions-connectlistener
   */
  noDelay?: boolean

  /**
   * @see https://nodejs.org/api/net.html#socketconnectoptions-connectlistener
   */
  keepAlive?: boolean

  /**
   * @see https://nodejs.org/api/net.html#socketconnectoptions-connectlistener
   */
  keepAliveInitialDelay?: number

  /**
   * @see https://nodejs.org/api/net.html#new-netsocketoptions
   */
  allowHalfOpen?: boolean
}

type TCPDialEvents =
  OutboundConnectionUpgradeEvents |
  ProgressEvent<'tcp:open-connection'>

interface TCPDialOptions extends DialTransportOptions<TCPDialEvents>, TCPSocketOptions {

}

interface TCPCreateListenerOptions extends CreateListenerOptions, TCPSocketOptions {

}

interface TCPComponents {
  metrics?: Metrics
  logger: ComponentLogger
}

interface TCPMetrics {
  events: CounterGroup<'error' | 'timeout' | 'connect' | 'abort'>
  errors: CounterGroup<'outbound_to_connection' | 'outbound_upgrade'>
}

export function tcp (init: TCPOptions = {}): (components: TCPComponents) => Transport {
  return (components: TCPComponents) => {
    return new TCP(components, init)
  }
}

/**
 * @packageDocumentation
 *
 * A [libp2p transport](https://docs.libp2p.io/concepts/transports/overview/) based on the TCP networking stack.
 *
 * @example
 *
 * ```TypeScript
 * import { createLibp2p } from 'libp2p'
 * import { tcp } from '@libp2p/tcp'
 * import { multiaddr } from '@multiformats/multiaddr'
 *
 * const node = await createLibp2p({
 *   transports: [
 *     tcp()
 *   ]
 * })
 *
 * const ma = multiaddr('/ip4/123.123.123.123/tcp/1234')
 *
 * // dial a TCP connection, timing out after 10 seconds
 * const connection = await node.dial(ma, {
 *   signal: AbortSignal.timeout(10_000)
 * })
 *
 * // use connection...
 * ```
 */


class TCP implements Transport<TCPDialEvents> {
  private readonly opts: TCPOptions
  private readonly metrics?: TCPMetrics
  private readonly components: TCPComponents
  private readonly log: Logger

  constructor (components: TCPComponents, options: TCPOptions = {}) {
    this.log = components.logger.forComponent('libp2p:tcp')
    this.opts = options
    this.components = components

    if (components.metrics != null) {
      this.metrics = {
        events: components.metrics.registerCounterGroup('libp2p_tcp_dialer_events_total', {
          label: 'event',
          help: 'Total count of TCP dialer events by type'
        }),
        errors: components.metrics.registerCounterGroup('libp2p_tcp_dialer_errors_total', {
          label: 'event',
          help: 'Total count of TCP dialer events by type'
        })
      }
    }
  }

  readonly [transportSymbol] = true

  readonly [Symbol.toStringTag] = '@libp2p/tcp'

  readonly [serviceCapabilities]: string[] = [
    '@libp2p/transport'
  ]

  async dial (ma: Multiaddr, options: TCPDialOptions): Promise<Connection> {
    options.keepAlive = options.keepAlive ?? true
    options.noDelay = options.noDelay ?? true

    // options.signal destroys the socket before 'connect' event
    const socket = await this._connect(ma, options)

    let maConn: MultiaddrConnection

    try {
      maConn = toMultiaddrConnection(socket, {
        remoteAddr: ma,
        socketInactivityTimeout: this.opts.outboundSocketInactivityTimeout,
        socketCloseTimeout: this.opts.socketCloseTimeout,
        metrics: this.metrics?.events,
        logger: this.components.logger,
        direction: 'outbound'
      })
    } catch (err: any) {
      this.metrics?.errors.increment({ outbound_to_connection: true })
      socket.destroy(err)
      throw err
    }

    try {
      this.log('new outbound connection %s', maConn.remoteAddr)
      return await options.upgrader.upgradeOutbound(maConn, options)
    } catch (err: any) {
      this.metrics?.errors.increment({ outbound_upgrade: true })
      this.log.error('error upgrading outbound connection', err)
      maConn.abort(err)
      throw err
    }
  }

  async _connect (ma: Multiaddr, options: TCPDialOptions): Promise<Socket> {
    options.signal.throwIfAborted()
    options.onProgress?.(new CustomProgressEvent('tcp:open-connection'))

    let rawSocket: Socket

    return new Promise<Socket>((resolve, reject) => {
      const start = Date.now()
      const cOpts = multiaddrToNetConfig(ma, {
        ...(this.opts.dialOpts ?? {}),
        ...options
      }) as (IpcSocketConnectOpts & TcpSocketConnectOpts)

      this.log('dialing %a', ma)
      rawSocket = net.connect(cOpts)

      const onError = (err: Error): void => {
        this.log.error('dial to %a errored - %e', ma, err)
        const cOptsStr = cOpts.path ?? `${cOpts.host ?? ''}:${cOpts.port}`
        err.message = `connection error ${cOptsStr}: ${err.message}`
        this.metrics?.events.increment({ error: true })
        done(err)
      }

      const onTimeout = (): void => {
        this.log('connection timeout %a', ma)
        this.metrics?.events.increment({ timeout: true })

        const err = new TimeoutError(`Connection timeout after ${Date.now() - start}ms`)
        // Note: this will result in onError() being called
        rawSocket.emit('error', err)
      }

      const onConnect = (): void => {
        this.log('connection opened %a', ma)
        this.metrics?.events.increment({ connect: true })
        done()
      }

      const onAbort = (): void => {
        this.log('connection aborted %a', ma)
        this.metrics?.events.increment({ abort: true })
        done(new AbortError())
      }

      const done = (err?: Error): void => {
        rawSocket.removeListener('error', onError)
        rawSocket.removeListener('timeout', onTimeout)
        rawSocket.removeListener('connect', onConnect)

        if (options.signal != null) {
          options.signal.removeEventListener('abort', onAbort)
        }

        if (err != null) {
          reject(err); return
        }

        resolve(rawSocket)
      }

      rawSocket.on('error', onError)
      rawSocket.on('timeout', onTimeout)
      rawSocket.on('connect', onConnect)

      options.signal.addEventListener('abort', onAbort)
    })
      .catch(err => {
        rawSocket?.destroy()
        throw err
      })
  }

  /**
   * Creates a TCP listener. The provided `handler` function will be called
   * anytime a new incoming Connection has been successfully upgraded via
   * `upgrader.upgradeInbound`.
   */
  createListener (options: TCPCreateListenerOptions): Listener {
    return new TCPListener({
      ...(this.opts.listenOpts ?? {}),
      ...options,
      maxConnections: this.opts.maxConnections,
      backlog: this.opts.backlog,
      closeServerOnMaxConnections: this.opts.closeServerOnMaxConnections,
      socketInactivityTimeout: this.opts.inboundSocketInactivityTimeout,
      socketCloseTimeout: this.opts.socketCloseTimeout,
      metrics: this.components.metrics,
      logger: this.components.logger
    })
  }

  /**
   * Takes a list of `Multiaddr`s and returns only valid TCP addresses
   */
  listenFilter (multiaddrs: Multiaddr[]): Multiaddr[] {
    return multiaddrs.filter(ma => TCPMatcher.exactMatch(ma) || ma.toString().startsWith('/unix/'))
  }

  /**
   * Filter check for all Multiaddrs that this transport can dial
   */
  dialFilter (multiaddrs: Multiaddr[]): Multiaddr[] {
    return this.listenFilter(multiaddrs)
  }
}


interface Context extends TCPCreateListenerOptions {
  upgrader: Upgrader
  socketInactivityTimeout?: number
  socketCloseTimeout?: number
  maxConnections?: number
  backlog?: number
  metrics?: Metrics
  closeServerOnMaxConnections?: CloseServerOnMaxConnectionsOpts
  logger: ComponentLogger
}

interface TCPListenerMetrics {
  status?: MetricGroup
  errors?: CounterGroup
  events?: CounterGroup
}

enum TCPListenerStatusCode {
  /**
   * When server object is initialized but we don't know the listening address
   * yet or the server object is stopped manually, can be resumed only by
   * calling listen()
   */
  INACTIVE = 0,
  ACTIVE = 1,
  /* During the connection limits */
  PAUSED = 2
}

type Status = { code: TCPListenerStatusCode.INACTIVE } | {
  code: Exclude<TCPListenerStatusCode, TCPListenerStatusCode.INACTIVE>
  listeningAddr: Multiaddr
  netConfig: NetConfig
}

class TCPListener extends TypedEventEmitter<ListenerEvents> implements Listener {
  private readonly server: net.Server
  /** Keep track of open sockets to destroy in case of timeout */
  private readonly sockets = new Set<net.Socket>()
  private status: Status = { code: TCPListenerStatusCode.INACTIVE }
  private metrics: TCPListenerMetrics
  private addr: string
  private readonly log: Logger
  private readonly shutdownController: AbortController

  constructor (private readonly context: Context) {
    super()

    context.keepAlive = context.keepAlive ?? true
    context.noDelay = context.noDelay ?? true

    this.shutdownController = new AbortController()
    setMaxListeners(Infinity, this.shutdownController.signal)

    this.log = context.logger.forComponent('libp2p:tcp:listener')
    this.addr = 'unknown'
    this.server = net.createServer(context, this.onSocket.bind(this))

    // https://nodejs.org/api/net.html#servermaxconnections
    // If set reject connections when the server's connection count gets high
    // Useful to prevent too resource exhaustion via many open connections on
    // high bursts of activity
    if (context.maxConnections !== undefined) {
      this.server.maxConnections = context.maxConnections
    }

    if (context.closeServerOnMaxConnections != null) {
      // Sanity check options
      if (context.closeServerOnMaxConnections.closeAbove < context.closeServerOnMaxConnections.listenBelow) {
        throw new InvalidParametersError('closeAbove must be >= listenBelow')
      }
    }

    context.metrics?.registerMetricGroup('libp2p_tcp_inbound_connections_total', {
      label: 'address',
      help: 'Current active connections in TCP listener',
      calculate: () => {
        return {
          [this.addr]: this.sockets.size
        }
      }
    })

    this.metrics = {
      status: context.metrics?.registerMetricGroup('libp2p_tcp_listener_status_info', {
        label: 'address',
        help: 'Current status of the TCP listener socket'
      }),
      errors: context.metrics?.registerMetricGroup('libp2p_tcp_listener_errors_total', {
        label: 'address',
        help: 'Total count of TCP listener errors by type'
      }),
      events: context.metrics?.registerMetricGroup('libp2p_tcp_listener_events_total', {
        label: 'address',
        help: 'Total count of TCP listener events by type'
      })
    }

    this.server
      .on('listening', () => {
        // we are listening, register metrics for our port
        const address = this.server.address()

        if (address == null) {
          this.addr = 'unknown'
        } else if (typeof address === 'string') {
          // unix socket
          this.addr = address
        } else {
          this.addr = `${address.address}:${address.port}`
        }

        this.metrics.status?.update({
          [this.addr]: TCPListenerStatusCode.ACTIVE
        })

        this.safeDispatchEvent('listening')
      })
      .on('error', err => {
        this.metrics.errors?.increment({ [`${this.addr} listen_error`]: true })
        this.safeDispatchEvent('error', { detail: err })
      })
      .on('close', () => {
        this.metrics.status?.update({
          [this.addr]: this.status.code
        })

        // If this event is emitted, the transport manager will remove the
        // listener from it's cache in the meanwhile if the connections are
        // dropped then listener will start listening again and the transport
        // manager will not be able to close the server
        if (this.status.code !== TCPListenerStatusCode.PAUSED) {
          this.safeDispatchEvent('close')
        }
      })
      .on('drop', () => {
        this.metrics.events?.increment({ [`${this.addr} drop`]: true })
      })
  }

  private onSocket (socket: net.Socket): void {
    this.metrics.events?.increment({ [`${this.addr} connection`]: true })

    if (this.status.code !== TCPListenerStatusCode.ACTIVE) {
      socket.destroy()
      throw new NotStartedError('Server is not listening yet')
    }

    let maConn: MultiaddrConnection
    try {
      maConn = toMultiaddrConnection(socket, {
        listeningAddr: this.status.listeningAddr,
        socketInactivityTimeout: this.context.socketInactivityTimeout,
        socketCloseTimeout: this.context.socketCloseTimeout,
        metrics: this.metrics?.events,
        metricPrefix: `${this.addr} `,
        logger: this.context.logger,
        direction: 'inbound'
      })
    } catch (err: any) {
      this.log.error('inbound connection failed', err)
      this.metrics.errors?.increment({ [`${this.addr} inbound_to_connection`]: true })
      socket.destroy()
      return
    }

    this.log('new inbound connection %s', maConn.remoteAddr)
    this.sockets.add(socket)

    this.context.upgrader.upgradeInbound(maConn, {
      signal: this.shutdownController.signal
    })
      .then(() => {
        this.log('inbound connection upgraded %s', maConn.remoteAddr)

        socket.once('close', () => {
          this.sockets.delete(socket)

          if (
            this.context.closeServerOnMaxConnections != null &&
            this.sockets.size < this.context.closeServerOnMaxConnections.listenBelow
          ) {
            // The most likely case of error is if the port taken by this
            // application is bound by another process during the time the
            // server if closed. In that case there's not much we can do.
            // resume() will be called again every time a connection is
            // dropped, which acts as an eventual retry mechanism.
            // onListenError allows the consumer act on this.
            this.resume().catch(e => {
              this.log.error('error attempting to listen server once connection count under limit', e)
              this.context.closeServerOnMaxConnections?.onListenError?.(e as Error)
            })
          }
        })

        if (
          this.context.closeServerOnMaxConnections != null &&
          this.sockets.size >= this.context.closeServerOnMaxConnections.closeAbove
        ) {
          this.pause()
        }
      })
      .catch(async err => {
        this.log.error('inbound connection upgrade failed', err)
        this.metrics.errors?.increment({ [`${this.addr} inbound_upgrade`]: true })
        this.sockets.delete(socket)
        maConn.abort(err)
      })
  }

  getAddrs (): Multiaddr[] {
    if (this.status.code === TCPListenerStatusCode.INACTIVE) {
      return []
    }

    const address = this.server.address()

    if (address == null) {
      return []
    }

    if (typeof address === 'string') {
      return [
        multiaddr(`/unix/${encodeURIComponent(address)}`)
      ]
    }

    return getThinWaistAddresses(this.status.listeningAddr, address.port)
  }

  updateAnnounceAddrs (): void {

  }

  async listen (ma: Multiaddr): Promise<void> {
    if (this.status.code === TCPListenerStatusCode.ACTIVE || this.status.code === TCPListenerStatusCode.PAUSED) {
      throw new AlreadyStartedError('server is already listening')
    }

    try {
      this.status = {
        code: TCPListenerStatusCode.ACTIVE,
        listeningAddr: ma,
        netConfig: multiaddrToNetConfig(ma, this.context)
      }

      await this.resume()
    } catch (err) {
      this.status = { code: TCPListenerStatusCode.INACTIVE }
      throw err
    }
  }

  async close (): Promise<void> {
    const events: Array<Promise<void>> = []

    if (this.server.listening) {
      events.push(pEvent(this.server, 'close'))
    }

    // shut down the server socket, permanently
    this.pause(true)

    // stop any in-progress connection upgrades
    this.shutdownController.abort()

    // synchronously close any open connections - should be done after closing
    // the server socket in case new sockets are opened during the shutdown
    this.sockets.forEach(socket => {
      if (socket.readable) {
        events.push(pEvent(socket, 'close'))
        socket.destroy()
      }
    })

    await Promise.all(events)
  }

  /**
   * Can resume a stopped or start an inert server
   */
  private async resume (): Promise<void> {
    if (this.server.listening || this.status.code === TCPListenerStatusCode.INACTIVE) {
      return
    }

    const netConfig = this.status.netConfig

    await new Promise<void>((resolve, reject) => {
      // NOTE: 'listening' event is only fired on success. Any error such as
      // port already bound, is emitted via 'error'
      this.server.once('error', reject)
      this.server.listen(netConfig, resolve)
    })

    this.status = { ...this.status, code: TCPListenerStatusCode.ACTIVE }
    this.log('listening on %s', this.server.address())
  }

  private pause (permanent: boolean = false): void {
    if (!this.server.listening && this.status.code === TCPListenerStatusCode.PAUSED && permanent) {
      this.status = { code: TCPListenerStatusCode.INACTIVE }
      return
    }

    if (!this.server.listening || this.status.code !== TCPListenerStatusCode.ACTIVE) {
      return
    }

    this.log('closing server on %s', this.server.address())

    // NodeJS implementation tracks listening status with `this._handle` property.
    // - Server.close() sets this._handle to null immediately. If this._handle is null, NotStartedError is thrown
    // - Server.listening returns `this._handle !== null` https://github.com/nodejs/node/blob/386d761943bb1b217fba27d6b80b658c23009e60/lib/net.js#L1675
    // - Server.listen() if `this._handle !== null` throws AlreadyStartedError
    //
    // NOTE: Both listen and close are technically not async actions, so it's not necessary to track
    // states 'pending-close' or 'pending-listen'

    // From docs https://nodejs.org/api/net.html#serverclosecallback
    // Stops the server from accepting new connections and keeps existing connections.
    // 'close' event is emitted only emitted when all connections are ended.
    // The optional callback will be called once the 'close' event occurs.

    // We need to set this status before closing server, so other procedures are aware
    // during the time the server is closing
    this.status = permanent ? { code: TCPListenerStatusCode.INACTIVE } : { ...this.status, code: TCPListenerStatusCode.PAUSED }

    // stop accepting incoming connections - existing connections are maintained
    // - any callback passed here would be invoked after existing connections
    // close, we want to maintain them so no callback is passed otherwise his
    // method will never return
    this.server.close()
  }
}


interface ToConnectionOptions {
  listeningAddr?: Multiaddr
  remoteAddr?: Multiaddr
  localAddr?: Multiaddr
  socketInactivityTimeout?: number
  socketCloseTimeout?: number
  metrics?: CounterGroup
  metricPrefix?: string
  logger: ComponentLogger
  direction: 'inbound' | 'outbound'
}

/**
 * Convert a socket into a MultiaddrConnection
 * https://github.com/libp2p/interface-transport#multiaddrconnection
 */
const toMultiaddrConnection = (socket: Socket, options: ToConnectionOptions): MultiaddrConnection => {
  let closePromise: DeferredPromise<void>
  const log = options.logger.forComponent('libp2p:tcp:socket')
  const direction = options.direction
  const metrics = options.metrics
  const metricPrefix = options.metricPrefix ?? ''
  const inactivityTimeout = options.socketInactivityTimeout ?? SOCKET_TIMEOUT
  const closeTimeout = options.socketCloseTimeout ?? CLOSE_TIMEOUT
  let timedOut = false
  let errored = false

  // Check if we are connected on a unix path
  if (options.listeningAddr?.getPath() != null) {
    options.remoteAddr = options.listeningAddr
  }

  if (options.remoteAddr?.getPath() != null) {
    options.localAddr = options.remoteAddr
  }

  // handle socket errors
  socket.on('error', err => {
    errored = true

    if (!timedOut) {
      log.error('%s socket error - %e', direction, err)
      metrics?.increment({ [`${metricPrefix}error`]: true })
    }

    socket.destroy()
    maConn.timeline.close = Date.now()
  })

  let remoteAddr: Multiaddr

  if (options.remoteAddr != null) {
    remoteAddr = options.remoteAddr
  } else {
    if (socket.remoteAddress == null || socket.remotePort == null) {
      // this can be undefined if the socket is destroyed (for example, if the client disconnected)
      // https://nodejs.org/dist/latest-v16.x/docs/api/net.html#socketremoteaddress
      throw new InvalidParametersError('Could not determine remote address or port')
    }

    remoteAddr = toMultiaddr(socket.remoteAddress, socket.remotePort)
  }

  const lOpts = multiaddrToNetConfig(remoteAddr)
  const lOptsStr = lOpts.path ?? `${lOpts.host ?? ''}:${lOpts.port ?? ''}`
  const { sink, source } = duplex(socket)

  // by default there is no timeout
  // https://nodejs.org/dist/latest-v16.x/docs/api/net.html#socketsettimeouttimeout-callback
  socket.setTimeout(inactivityTimeout)

  socket.once('timeout', () => {
    timedOut = true
    log('%s %s socket read timeout', direction, lOptsStr)
    metrics?.increment({ [`${metricPrefix}timeout`]: true })

    // if the socket times out due to inactivity we must manually close the connection
    // https://nodejs.org/dist/latest-v16.x/docs/api/net.html#event-timeout
    socket.destroy(new TimeoutError())
    maConn.timeline.close = Date.now()
  })

  socket.once('close', () => {
    // record metric for clean exit
    if (!timedOut && !errored) {
      log('%s %s socket close', direction, lOptsStr)
      metrics?.increment({ [`${metricPrefix}close`]: true })
    }

    // In instances where `close` was not explicitly called,
    // such as an iterable stream ending, ensure we have set the close
    // timeline
    socket.destroy()
    maConn.timeline.close = Date.now()
  })

  socket.once('end', () => {
    // the remote sent a FIN packet which means no more data will be sent
    // https://nodejs.org/dist/latest-v16.x/docs/api/net.html#event-end
    log('%s %s socket end', direction, lOptsStr)
    metrics?.increment({ [`${metricPrefix}end`]: true })
  })

  const maConn: MultiaddrConnection = {
    async sink (source) {
      try {
        await sink((async function * () {
          for await (const buf of source) {
            if (buf instanceof Uint8Array) {
              yield buf
            } else {
              yield buf.subarray()
            }
          }
        })())
      } catch (err: any) {
        // If aborted we can safely ignore
        if (err.type !== 'aborted') {
          // If the source errored the socket will already have been destroyed by
          // duplex(). If the socket errored it will already be
          // destroyed. There's nothing to do here except log the error & return.
          log.error('%s %s error in sink - %e', direction, lOptsStr, err)
        }
      }

      // we have finished writing, send the FIN message
      socket.end()
    },

    source,

    // If the remote address was passed, use it - it may have the peer ID encapsulated
    remoteAddr,

    timeline: { open: Date.now() },

    async close (options: AbortOptions = {}) {
      if (socket.closed) {
        log('the %s %s socket is already closed', direction, lOptsStr)
        return
      }

      if (socket.destroyed) {
        log('the %s %s socket is already destroyed', direction, lOptsStr)
        return
      }

      if (closePromise != null) {
        return closePromise.promise
      }

      try {
        closePromise = pDefer()

        // close writable end of socket
        socket.end()

        // convert EventEmitter to EventTarget
        const eventTarget = socketToEventTarget(socket)

        // don't wait forever to close
        const signal = options.signal ?? AbortSignal.timeout(closeTimeout)

        // wait for any unsent data to be sent
        if (socket.writableLength > 0) {
          log('%s %s draining socket', direction, lOptsStr)
          await raceEvent(eventTarget, 'drain', signal, {
            errorEvent: 'error'
          })
          log('%s %s socket drained', direction, lOptsStr)
        }

        await Promise.all([
          raceEvent(eventTarget, 'close', signal, {
            errorEvent: 'error'
          }),

          // all bytes have been sent we can destroy the socket
          socket.destroy()
        ])
      } catch (err: any) {
        this.abort(err)
      } finally {
        closePromise.resolve()
      }
    },

    abort: (err: Error) => {
      log('%s %s socket abort due to error - %e', direction, lOptsStr, err)

      // the abortSignalListener may already destroyed the socket with an error
      socket.destroy()

      // closing a socket is always asynchronous (must wait for "close" event)
      // but the tests expect this to be a synchronous operation so we have to
      // set the close time here. the tests should be refactored to reflect
      // reality.
      maConn.timeline.close = Date.now()
    },

    log
  }

  return maConn
}

function socketToEventTarget (obj?: any): EventTarget {
  const eventTarget = {
    addEventListener: (type: any, cb: any) => {
      obj.addListener(type, cb)
    },
    removeEventListener: (type: any, cb: any) => {
      obj.removeListener(type, cb)
    }
  }

  // @ts-expect-error partial implementation
  return eventTarget
}


type NetConfig = ListenOptions | (IpcSocketConnectOpts & TcpSocketConnectOpts)

function multiaddrToNetConfig (addr: Multiaddr, config: NetConfig = {}): NetConfig {
  const listenPath = addr.getPath()

  // unix socket listening
  if (listenPath != null) {
    if (os.platform() === 'win32') {
      // Use named pipes on Windows systems.
      return { path: path.join('\\\\.\\pipe\\', listenPath) }
    } else {
      return { path: listenPath }
    }
  }

  const options = addr.toOptions()

  // tcp listening
  return {
    ...config,
    ...options,
    ipv6Only: options.family === 6
  }
}

// Time to wait for a connection to close gracefully before destroying it manually
const CLOSE_TIMEOUT = 500

// Close the socket if there is no activity after this long in ms
const SOCKET_TIMEOUT = 2 * 60_000 // 2 mins
