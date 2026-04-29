import { ProxyClient } from "./utils/proxy/proxy-client";
import { firewall, packetsTransmittedByType } from "./utils/proxy/proxy-firewall";
import type { LibP2PNode } from "./node/node";
import { ProxyServer } from "./utils/proxy/proxy-server";
import { launchServer } from "./utils/process/server";
import { bwPkg } from "./utils/data/packages";
import type { GameInfo } from "./game/game-info";
import { launchClient } from "./utils/process/client";
import { blowfishKey, LOCALHOST } from "./utils/constants";
import { proxy } from "./utils/proxy/strategy-libp2p";
import { Proxy } from "./utils/proxy/proxy"
import * as PKT from "./utils/proxy/pkt";

import { createLibp2p } from "libp2p";
import { webRTCDirect } from "@libp2p/webrtc";
import { yamux } from "@chainsafe/libp2p-yamux";
import { noise } from "@chainsafe/libp2p-noise";

import fs from 'node:fs/promises'
import path from 'node:path'

const firewallEnabled = true

console.log('creating nodes')
const [clientNode, serverNode] = await Promise.all([
    createNode(),
    createNode(),
])
async function createNode(port = 0){
    return (await createLibp2p({
        addresses: {
            listen: [
                `/ip4/${LOCALHOST}/udp/${port}/webrtc-direct`,
            ]
        },
        transports: [
            webRTCDirect(),
        ],
        streamMuxers: [ yamux() ],
        connectionEncrypters: [ noise() ],
        services: {
            proxy: proxy(),
        },
    })) as LibP2PNode
}

console.log('patching peer stores')
await Promise.all([
    clientNode.peerStore.patch(serverNode.peerId, { multiaddrs: serverNode.getMultiaddrs() }),
    serverNode.peerStore.patch(clientNode.peerId, { multiaddrs: clientNode.getMultiaddrs() }),
])

const opts = { signal: new AbortController().signal }

console.log('reading game info')
const gameInfo = JSON.parse(await fs.readFile(path.join(bwPkg.infoDir, `GameInfo.json`), 'utf8')) as GameInfo

console.log('lauching server')
const server = await launchServer(gameInfo, opts)

console.log('starting server proxy')
const proxyServer = firewall(new ProxyServer(serverNode), firewallEnabled)
await proxyServer.start(server.port, [ clientNode.peerId ], opts)

console.log('connecting client proxy')
const proxyClient = firewall(new ProxyClient(clientNode), firewallEnabled)
await proxyClient.connect(serverNode.peerId, proxyServer, opts)

console.log('launching client')
const client = await launchClient(LOCALHOST, proxyClient.getPort()!, blowfishKey, 1, opts)

setInterval(() => {
    let dataTransmitted = proxyClient.dataTransmitted + proxyServer.dataTransmitted
    console.log(`data transmitted ${dataTransmitted / 1024} kbps`)
    if((dataTransmitted / 1024) >= 4){
        console.log('----------------------------------')
        for(const [ packet_type, packetsOfType ] of packetsTransmittedByType.entries())
            console.log(PKT.Type[packet_type], packetsOfType.size, packetsOfType.count, packetsOfType.size / packetsOfType.count)
        console.log('----------------------------------')
    }
    packetsTransmittedByType.clear()
    proxyClient.dataTransmitted = 0
    proxyServer.dataTransmitted = 0
    dataTransmitted = 0
}, 1000).unref()
