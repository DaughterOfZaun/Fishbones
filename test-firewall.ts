import { createLibp2p } from "libp2p";
import { ProxyClient } from "./utils/proxy/proxy-client";
import { firewall } from "./utils/proxy/proxy-firewall";
import type { LibP2PNode } from "./node/node";
import { ProxyServer } from "./utils/proxy/proxy-server";
import { launchServer } from "./utils/process/server";
import { gsPkg } from "./utils/data/packages";
import type { GameInfo } from "./game/game-info";
import fs from 'node:fs/promises'
import path from 'node:path'
import { launchClient } from "./utils/process/client";
import { blowfishKey, LOCALHOST } from "./utils/constants";
import { proxy } from "./utils/proxy/strategy-libp2p";
import { Proxy } from "./utils/proxy/proxy"

const firewallEnabled = true

console.log('creating node')
const node = (await createLibp2p({
    services: {
        proxy: proxy(),
    }
})) as LibP2PNode
const opts = { signal: new AbortController().signal }

console.log('reading game info')
const gameInfo = JSON.parse(await fs.readFile(path.join(gsPkg.infoDir, `GameInfo.json`), 'utf8')) as GameInfo

console.log('lauching server')
const server = await launchServer(gameInfo, opts)

console.log('starting server proxy')
const proxyServer = firewall(stats(new ProxyServer(node)), firewallEnabled)
await proxyServer.start(server.port, [ node.peerId ], opts)

console.log('connecting client proxy')
const proxyClient = firewall(stats(new ProxyClient(node)), firewallEnabled)
await proxyClient.connect(node.peerId, proxyServer, opts)

console.log('launching client')
const client = await launchClient(LOCALHOST, proxyClient.getPort()!, blowfishKey, 1, opts)

setInterval(() => {
    let dataTransmitted = proxyClient.dataTransmitted + proxyServer.dataTransmitted
    console.log(`data transmitted ${dataTransmitted / 1024} kbps`)
    proxyClient.dataTransmitted = 0
    proxyServer.dataTransmitted = 0
    dataTransmitted = 0
}, 1000).unref()

function stats<T extends Proxy>(proxy: T): T {
    
    // const proxy_strategy = proxy['strategy']
    // const proxy_strategy_createSocketToRemote = proxy_strategy['createSocketToRemote'].bind(proxy_strategy)
    // proxy_strategy['createSocketToRemote'] = async (id, onData, opts) => {
    //     const socketToRemote = await proxy_strategy_createSocketToRemote(id, onData, opts)
    //     const socketToRemote_send = socketToRemote.send.bind(socketToRemote)
    //     socketToRemote.send = (data) => {
    //         dataTransmitted += data.length
    //         return socketToRemote_send(data)
    //     }
    //     return socketToRemote
    // }

    // const super_createSocketToProgram = proxy['createSocketToProgram'].bind(proxy)
    // proxy['createSocketToProgram'] = async function (programHost, programPort, onData, opts) {
    //     const socketToProgram = await super_createSocketToProgram(programHost, programPort, onData, opts)
    //     const socketToProgram_send = socketToProgram.send.bind(socketToProgram)
    //     socketToProgram.send = (data) => {
    //         dataTransmitted += data.length
    //         return socketToProgram_send(data)
    //     }
    //     return socketToProgram
    // }

    return proxy
}