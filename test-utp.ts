import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'

import { utp } from './network/tcp'
//import { tcp } from '@libp2p/tcp'

import { pipe } from 'it-pipe'
import toBuffer from 'it-to-buffer'
import { createLibp2p, type Libp2p } from 'libp2p'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { multiaddr } from '@multiformats/multiaddr'
import { peerIdFromString } from '@libp2p/peer-id'
import { ping } from '@libp2p/ping'
import type { AddressManager } from '@libp2p/interface-internal'
import { getThinWaistAddresses } from '@libp2p/utils/get-thin-waist-addresses'
//import { mdns } from '@libp2p/mdns'

import { createSocket, isDHT } from './network/umplex'

/*
////@ts-expect-error Could not find a declaration file for module 'bittorrent-dht'. 
import { Client as DHT } from 'bittorrent-dht'

const
dht = new DHT({ socket: createSocket({ type: 'udp4', filter: isDHT }) })
dht.on('warning', (err: Error) => console.log('dht', 'warning', err))
dht.on('error', (err: Error) => console.log('dht', 'error', err))
dht.listen()
*/

//await new Promise<void>(res => setTimeout(() => res(), 1000))

const port = 5116

const createNode = async () => {
    const node = await createLibp2p({
        addresses: {
            // To signal the addresses we want to be available, we use
            // the multiaddr format, a self describable address
            listen: [
                `/ip4/0.0.0.0/udp/${port}`
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
            ping: ping(),
            //mdns: mdns(),
        },
        connectionManager: {
            dialTimeout: 60_000
        }
    })

    return node
}

const node = await createNode()
node.addEventListener('self:peer:update', ({ detail: { peer } }) => {
    console.log(
        'node is listening on:',
        node.getMultiaddrs().map(ma => ma.toString()),
        peer.addresses.map(addr => addr.multiaddr.toString())
    )
})

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

type Libp2pClass = Libp2p & {
    components: {
        addressManager: AddressManager
    }
}
const MAX_DATE = 8_640_000_000_000_000

const socket = createSocket({ type: 'udp4', filter: isDHT })
socket.bind(port, '0.0.0.0')

setTimeout(() => {
    const am = (node as unknown as Libp2pClass).components.addressManager
    const external = { hostport: { host: '187.100.87.70', port: 19505 } }
    const now = Date.now()

    const { address: lhost, port: lport } = socket.address()
    const listeningMultiaddr = multiaddr(`/ip4/${lhost}/udp/${lport}`)
    const listeningAddrs = getThinWaistAddresses(listeningMultiaddr)
    
    const { host: ehost, port: eport } = external.hostport!
    const externalMultiaddr = multiaddr(`/ip4/${ehost}/udp/${eport}`)
    
    //ref: libp2p/src/address-manager/index.ts/confirmObservedAddr
    //ref: libp2p/src/address-manager/index.ts/maybeUpgradeToIPMapping
    const filteredListeningAddrs = listeningAddrs
        .map(ma => ma.toOptions())
        .filter(opts => opts.host !== '127.0.0.1')
    
    console.log('external:', externalMultiaddr)
    console.log('listening:', listeningMultiaddr)
    console.log('listening:', listeningAddrs)
    console.log('filtered:', filteredListeningAddrs)
    
    if(filteredListeningAddrs.length === 1){
        console.log('adding public addr mapping')

        const internalAddr = filteredListeningAddrs[0]!
        const { host: ihost, port: iport } = internalAddr
        am.addPublicAddressMapping(ihost, iport, ehost, eport, 'udp')
        am.confirmObservedAddr(externalMultiaddr, {
            type: 'ip-mapping', ttl: MAX_DATE - now
        })
    }
}, 1000)

//const node2 = await createNode(0)
//printAddrs(node2)
//const [targetAddrStr, targetPeerIdStr] = [ node2.getMultiaddrs()[0]?.toString(), node2.peerId.publicKey?.toString() ]

const [targetAddrStr, targetPeerIdStr] = [ process.argv[2], process.argv[3] ]
if(targetAddrStr && targetPeerIdStr){
    const [targetAddr, targetPeerId] = [ multiaddr(targetAddrStr), peerIdFromString(targetPeerIdStr) ]
    try {
        await node.peerStore.patch(targetPeerId, {
            multiaddrs: [ targetAddr ]
        })
        const stream = await node.dialProtocol(targetPeerId, '/print')
        await pipe(
            ['Hello', ' ', 'p2p', ' ', 'world', '!'].map(str => uint8ArrayFromString(str)),
            stream
        )
    } catch(err) {
        console.error(err)
        node.stop()
    }
}

let sigints = 0
process.on('SIGINT', () => {
    if(node.status === 'started') node.stop()
    if(node.status === 'stopped' || ++sigints == 2) process.exit()
})
