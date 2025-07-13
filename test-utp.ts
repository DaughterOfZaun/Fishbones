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

/*
//@ts-expect-error Could not find a declaration file for module 'bittorrent-dht'. 
import { Client as DHT } from 'bittorrent-dht'

const dht = new DHT({})
      dht.on('warning', (err: Error) => console.log('dht', 'warning', err))
      dht.on('error', (err: Error) => console.log('dht', 'error', err))
      dht.listen(5002)

await new Promise<void>(res => setTimeout(() => res(), 1000))

*/

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
    streamMuxers: [ yamux() ]
  })

  return node
}

function printAddrs (node: Libp2p<ServiceMap>, number: string) {
  console.log('node %s is listening on:', number)
  node.getMultiaddrs().forEach((ma) => console.log(ma.toString()))
}

const [node1, node2] = await Promise.all([
  createNode(5001),
  createNode(5002),
])

printAddrs(node1, '1')
printAddrs(node2, '2')

node2.handle('/print', async ({ stream }) => {
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

await node1.peerStore.patch(node2.peerId, {
  multiaddrs: node2.getMultiaddrs()
})
const stream = await node1.dialProtocol(node2.peerId, '/print')

await pipe(
  ['Hello', ' ', 'p2p', ' ', 'world', '!'].map(str => uint8ArrayFromString(str)),
  stream
)
/*
await Promise.all([
    node1.stop(),
    node2.stop(),
])
*/