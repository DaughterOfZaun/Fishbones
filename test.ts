import { noise } from "@chainsafe/libp2p-noise"
import { yamux } from "@chainsafe/libp2p-yamux"
import { webRTCDirect } from "@libp2p/webrtc"
import { createLibp2p } from "libp2p"
import { ClientServerProxy } from "./utils/proxy/proxy"
import { peerIdFromPrivateKey } from "@libp2p/peer-id"
import type { PrivateKey } from "@libp2p/interface"
import { privateKeyFromRaw } from "@libp2p/crypto/keys"
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
//import { sleep } from "bun"
import * as fs from 'node:fs/promises'
import { launchServer } from "./utils/process/server"
import type { GameInfo } from "./game/game-info"
import { launchClient } from "./utils/process/client"
import { proxy } from "./utils/proxy/strategy-libp2p"
import type { LibP2PNode } from "./node/node"

const node1PrivateKey = privateKeyFromRaw(uint8ArrayFromString('6rGSct+R4BauwyNcnbJMAlg8d5GVEK0mTRhPmA9sI9ENgkLg5Vo6nNrgHR1wND+S7z6HQYR+gX6jHHIpJUix6A==', 'base64pad'))
const node2PrivateKey = privateKeyFromRaw(uint8ArrayFromString('E8OYT4fqYaFFNm8rvKhhQ5jQHNUV+O9v/s1pyRQ4PD2+9GCrbBFcSzDFT5D2T+RF419dRPcWZg+uJmwAsP7pSQ==', 'base64pad'))
const node1PeerId = peerIdFromPrivateKey(node1PrivateKey)
const node2PeerId = peerIdFromPrivateKey(node2PrivateKey)

const LOCALHOST = "127.0.0.1"

const createNode = async (privateKey: PrivateKey, port: number) => {
    const node = await createLibp2p({
        privateKey,
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
        connectionMonitor: {
            enabled: false,
        }
    })
    return node
}

const opts = { signal: new AbortController().signal }

const [
    node1,
    node2,
] = await Promise.all([
    createNode(node1PrivateKey, 0),
    createNode(node2PrivateKey, 0),
])

console.log('node1 addrs', node1.getMultiaddrs().map(ma => ma.toString()))
console.log('node2 addrs', node2.getMultiaddrs().map(ma => ma.toString()))

await Promise.all([
    node1.peerStore.patch(node2.peerId, { multiaddrs: node2.getMultiaddrs() }),
    node2.peerStore.patch(node1.peerId, { multiaddrs: node1.getMultiaddrs() }),
])

await node1.dial(node2PeerId)

const peerIds = [
    node1PeerId,
    node2PeerId,
]

const gameInfo = JSON.parse(await fs.readFile('./dist/Fishbones_Data/ChildrenOfTheGrave-Gameserver/ChildrenOfTheGraveServerConsole/bin/Debug/net9.0/Settings/GameInfo.json', 'utf8')) as GameInfo

let proxy1: ClientServerProxy
let proxy2: ClientServerProxy

await Promise.all([
    (async () => {
        proxy1 = new ClientServerProxy(node1 as LibP2PNode)
        await proxy1.start(peerIds, opts)
        console.log('Proxy1 started & connected')
    })(),
    (async () => {
        proxy2 = new ClientServerProxy(node2 as LibP2PNode)
        await proxy2.start(peerIds, opts)
        console.log('Proxy2 started & connected')
    })(),
])

const server1 = await launchServer(gameInfo, opts, 5118)
const server2 = await launchServer(gameInfo, opts, 5119)
//const server2 = await Bun.udpSocket({ hostname: LOCALHOST, port: 5119 })

//console.log('Servers are ready on', server1.port, 'and', server2.port)

proxy1!.afterStart(server1.port)
proxy2!.afterStart(server2.port)

//const [server1, server2] = await Promise.all([
    //Bun.udpSocket({ hostname: LOCALHOST, socket: { data: (socket, data, hostport) => { console.log('server1 got', data.toBase64(), 'from', hostport) } } }),
    //launchServer(gameInfo, opts, 5118),
    //Bun.udpSocket({ hostname: LOCALHOST, socket: { data: (socket, data, hostport) => { console.log('server2 got', data.toBase64(), 'from', hostport) } } }),
    //launchServer(gameInfo, opts, 5119),
//])

//const [client1, client2] =
await Promise.all([
    //Bun.udpSocket({ hostname: LOCALHOST, socket: { data: (socket, data, hostport) => { console.log('client1 got', data.toBase64(), 'from', hostport) } } }),
    launchClient(LOCALHOST, proxy1!.getClientPort()!, gameInfo.players[0]!.blowfishKey, 1, opts),
    //Bun.udpSocket({ hostname: LOCALHOST, /*socket: { data: (socket, data, hostport) => {console.log('client2 got', data.toBase64(), 'from', hostport) } }*/ }),
    //await launchClient(LOCALHOST, proxy2!.getClientPort()!, gameInfo.players[1]!.blowfishKey, 2, opts),
])

console.log('Clients started')

//client2.send(Buffer.from([]), server2.port, LOCALHOST)

//send(client1, 'client1 -> server1', proxy1.getClientPort()!)
//send(client2, 'client2 -> server2', proxy2.getClientPort()!)
//send(server1, 'server1 -> client1', proxy1.getPort(node1PeerId)!)
//send(server1, 'server1 -> client2', proxy1.getPort(node2PeerId)!)
//send(server2, 'server2 -> client1', proxy2.getPort(node1PeerId)!)
//send(server2, 'server2 -> client2', proxy2.getPort(node2PeerId)!)

//function send(socket: Bun.udp.Socket<'buffer'>, buffer: string, port: number, host = LOCALHOST){
//    console.log('sending', buffer, 'to', port)
//    socket.send(Buffer.from(buffer), port, host)
//}

//await sleep(1000)

//await Promise.all([
//    node1.stop(),
//    node2.stop(),
//])
