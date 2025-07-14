import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'

import { utp } from './network/tcp'
//import { tcp } from '@libp2p/tcp'

import { pipe } from 'it-pipe'
import toBuffer from 'it-to-buffer'
import { createLibp2p, type Libp2p } from 'libp2p'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import type { ServiceMap } from '@libp2p/interface'
import { multiaddr } from '@multiformats/multiaddr'
import { peerIdFromString } from '@libp2p/peer-id'
import { ping } from '@libp2p/ping'


//@ts-expect-error Could not find a declaration file for module 'bittorrent-dht'. 
import { Client as DHT } from 'bittorrent-dht'
import { createSocket, isDHT } from './network/umplex'

const
dht = new DHT({ socket: createSocket({ type: 'udp4', filter: isDHT }) })
dht.on('warning', (err: Error) => console.log('dht', 'warning', err))
dht.on('error', (err: Error) => console.log('dht', 'error', err))
dht.listen()

//await new Promise<void>(res => setTimeout(() => res(), 1000))

const createNode = async (port: number) => {
  const node = await createLibp2p({
    addresses: {
      // To signal the addresses we want to be available, we use
      // the multiaddr format, a self describable address
      listen: [
        `/ip4/0.0.0.0/udp/${port}/utp`
        //`/ip4/0.0.0.0/tcp/${port}`
      ]
    },
    transports: [
      //tcp(),
      utp({
        outboundSocketInactivityTimeout: Infinity,
        inboundSocketInactivityTimeout: Infinity,
        maxConnections: Infinity,
        //closeServerOnMaxConnections: null,
      }),
    ],
    connectionEncrypters: [ noise() ],
    streamMuxers: [ yamux() ],
    services: {
      ping: ping()
    }
  })

  return node
}

function printAddrs (node: Libp2p<ServiceMap>) {
  console.log(
    'node is listening on:',
    node.getMultiaddrs().map(ma => ma.toString())
  )
}

const node = await createNode(0)
printAddrs(node)

node.handle('/print', async ({ stream }) => {
  const result = await pipe(
    stream,
    async function * (source) {
      for await (const list of source) {
        yield list.subarray()
      }
    },
    toBuffer
  )
  console.log(uint8ArrayToString(result))
})

//const node2 = await createNode(0)
//printAddrs(node2)
//const [targetAddrStr, targetPeerIdStr] = [ node2.getMultiaddrs()[0]?.toString(), node2.peerId.publicKey?.toString() ]

const [targetAddrStr, targetPeerIdStr] = [ process.argv[2], process.argv[3] ]
if(targetAddrStr && targetPeerIdStr){
  const [targetAddr, targetPeerId] = [ multiaddr(targetAddrStr), peerIdFromString(targetPeerIdStr) ]
  await node.peerStore.patch(targetPeerId, {
    multiaddrs: [ targetAddr ]
  })
  const stream = await node.dialProtocol(targetPeerId, '/print')
  await pipe(
    ['Hello', ' ', 'p2p', ' ', 'world', '!'].map(str => uint8ArrayFromString(str)),
    stream
  )
}
