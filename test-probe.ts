import { createLibp2p } from 'libp2p'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
//import { uPnPNAT } from '@libp2p/upnp-nat'
import { tcp } from '@libp2p/tcp'
import { probe } from './network/libp2p/probe'
import os from 'node:os'

//console.log(os.networkInterfaces())
//process.exit()

const createNode = async () => {
    const node = await createLibp2p({
        addresses: {
            listen: [ '/ip4/0.0.0.0/tcp/0' ]
        },
        transports: [ tcp() ],
        streamMuxers: [ yamux() ],
        connectionEncrypters: [ noise() ],
        services: {
            probe: probe(),
            //upnpNAT: uPnPNAT(),
        }
    })
    return node
}

const node1 = await createNode()
const node2 = await createNode()

await node1.dial(node2.getMultiaddrs())
await node2.dial(node1.getMultiaddrs())

const probe1 = node1.services.probe
const probe2 = node2.services.probe

await probe2.ping(node1.peerId, probe1.port)
const addr = probe2.getBestIPv4Address(node1.peerId)
console.log(addr)

await node1.stop()
await node2.stop()
