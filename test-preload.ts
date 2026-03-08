import { createLibp2p } from "libp2p";
import { ProxyClient } from "./utils/proxy/proxy-client";
import { firewall } from "./utils/proxy/proxy-firewall";
import type { LibP2PNode } from "./node/node";
import { ProxyServer } from "./utils/proxy/proxy-server";
import { launchServer, stopServer } from "./utils/process/server";
import { blowfishKey, LOCALHOST } from "./utils/constants";
import { proxy } from "./utils/proxy/strategy-libp2p";
import { defaultGameInfo, launchClient, clientPreloaderCallbacks, stopClient } from "./utils/process/client-preloader";
import { sleep } from "bun";
import type { AbortOptions } from "@libp2p/interface";

const opts = { signal: new AbortController().signal }

console.log('creating node')
const node = (await createLibp2p({
    services: {
        proxy: proxy(),
    }
})) as LibP2PNode

const gameInfo = defaultGameInfo

let proxyServer: ProxyServer
let proxyClient: ProxyClient

async function startGame(opts: Required<AbortOptions>){
    console.log('lauching server')
    let server = await launchServer(gameInfo, opts)

    console.log('starting server proxy')
    proxyServer = firewall(new ProxyServer(node), true)
    await proxyServer.start(server.port, [ node.peerId ], opts)

    console.log('connecting client proxy')
    proxyClient = firewall(new ProxyClient(node), true, clientPreloaderCallbacks)
    await proxyClient.connect(node.peerId, proxyServer, opts)

    console.log('launching client')
    await launchClient(LOCALHOST, proxyClient.getPort()!, blowfishKey, 1, gameInfo, opts)
}

async function stopGame(opts: Required<AbortOptions>) {
    console.log('stopping client')
    await stopClient(opts)
    proxyClient.disconnect()

    console.log('stopping server')
    await stopServer(opts)
    proxyServer.stop()
}

await startGame(opts)

console.log('waiting')
await sleep(60 * 1000)

await stopGame(opts)

//console.log('waiting')
//await sleep(20 * 1000)

await startGame(opts)
