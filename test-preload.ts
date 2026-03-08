import { createLibp2p } from "libp2p";
import { ProxyClient } from "./utils/proxy/proxy-client";
import { firewall } from "./utils/proxy/proxy-firewall";
import type { LibP2PNode } from "./node/node";
import { ProxyServer } from "./utils/proxy/proxy-server";
import { launchServer } from "./utils/process/server";
import { blowfishKey, LOCALHOST } from "./utils/constants";
import { proxy } from "./utils/proxy/strategy-libp2p";
import { defaultGameInfo, preloadClient, launchClient, clientPreloaderCallbacks } from "./utils/process/client-preloader";
import { sleep } from "bun";

const opts = { signal: new AbortController().signal }

console.log('preloading client')
await preloadClient(opts)

console.log('waiting')
await sleep(20 * 1000)

console.log('creating node')
const node = (await createLibp2p({
    services: {
        proxy: proxy(),
    }
})) as LibP2PNode

const gameInfo = defaultGameInfo

console.log('lauching server')
const server = await launchServer(gameInfo, opts)

console.log('starting server proxy')
const proxyServer = firewall(new ProxyServer(node), true)
await proxyServer.start(server.port, [ node.peerId ], opts)

console.log('connecting client proxy')
const proxyClient = firewall(new ProxyClient(node), true, clientPreloaderCallbacks)
await proxyClient.connect(node.peerId, proxyServer, opts)

console.log('launching client')
await launchClient(LOCALHOST, proxyClient.getPort()!, blowfishKey, 1, gameInfo, opts)
