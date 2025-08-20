/* eslint-disable @typescript-eslint/no-unused-vars */

import { noise } from "@chainsafe/libp2p-noise"
import { yamux } from "@chainsafe/libp2p-yamux"
//import { tcp } from "@libp2p/tcp"
//import { webRTC, webRTCDirect } from "@libp2p/webrtc"
import { createLibp2p } from "libp2p"
import { LOCALHOST } from "./constants"
//import { createSocket, ProxyClient, ProxyServer } from "./data-proxy"
import { ProxyClient, ProxyServer } from "./data-proxy-umplex"
//import { pipe } from "it-pipe"
import { utp } from "../network/tcp"
import { multiaddr, type Multiaddr } from "@multiformats/multiaddr"
import { peerIdFromPrivateKey, peerIdFromPublicKey, peerIdFromString } from "@libp2p/peer-id"
import type { PeerId, PrivateKey } from "@libp2p/interface"
import { generateKeyPair, privateKeyFromRaw } from "@libp2p/crypto/keys"

import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'

//const serverKeyPair = await generateKeyPair('Ed25519')
//const clientKeyPair = await generateKeyPair('Ed25519')
//console.log(uint8ArrayToString(serverKeyPair.raw, 'base64pad'))
//console.log(uint8ArrayToString(clientKeyPair.raw, 'base64pad'))
//process.exit()

const serverNodePrivateKey = privateKeyFromRaw(uint8ArrayFromString('6rGSct+R4BauwyNcnbJMAlg8d5GVEK0mTRhPmA9sI9ENgkLg5Vo6nNrgHR1wND+S7z6HQYR+gX6jHHIpJUix6A==', 'base64pad'))
const clientNodePrivateKey = privateKeyFromRaw(uint8ArrayFromString('E8OYT4fqYaFFNm8rvKhhQ5jQHNUV+O9v/s1pyRQ4PD2+9GCrbBFcSzDFT5D2T+RF419dRPcWZg+uJmwAsP7pSQ==', 'base64pad'))
const serverNodePeerId = peerIdFromPrivateKey(serverNodePrivateKey)
const clientNodePeerId = peerIdFromPrivateKey(clientNodePrivateKey)

const createNode = async (privateKey: PrivateKey, port: number) => {
    const node = await createLibp2p({
        privateKey,
        addresses: {
            listen: [
                `/ip4/127.0.0.1/udp/${port}/utp`
                //`/ip4/0.0.0.0/tcp/${port}`,
                //`/ip4/0.0.0.0/udp/${port}/webrtc`,
                //`/ip4/0.0.0.0/udp/${port}/webrtc-direct`,
            ]
        },
        transports: [
            //webRTCDirect(),
            //webRTC(),
            //tcp(),
            utp({
                outboundSocketInactivityTimeout: Infinity,
                inboundSocketInactivityTimeout: Infinity,
                maxConnections: Infinity,
            }),
        ],
        streamMuxers: [ yamux() ],
        connectionEncrypters: [ noise() ],
        services: {}
    })
    return node
}

if(process.argv.includes('server')) await testServer()
if(process.argv.includes('client')) await testClient()
else await testClientServer()

/*
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function test(){
    const server = await createSocket()
    const client = await createSocket(server);

    console.log('server at', server.hostname, server.port)
    console.log('client at', client.hostname, client.port)

    pipe(
        server.stream.source,
        async (source) => {
            for await(const chunk of source){
                console.log('server', chunk.toString())
            }
        }
    )
    
    client.send("Hello!", server.port, server.hostname);

    await new Promise(res => setTimeout(res, 300))

    server.close()
    client.close()
}
*/
/*
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function test2(){
    const sa = await createSocket()
    console.log('sa', sa.hostname, sa.port)
    const sb = await createSocket({ hostname: LOCALHOST, port: sa.port })
    console.log('sb', sb.hostname, sb.port)
    
    pipe(
        sa.stream.source,
        async (source) => {
            for await(const chunk of source){
                console.log('sa', chunk.toString())
            }
        }
    )

    console.log('sb', sb.send(new Uint8Array([1, 2, 3, 4]), sa.port, LOCALHOST))

    await new Promise(res => setTimeout(res, 300))

    sa.close()
    sb.close()
}
*/
/*
async function test1(){
    const gameServerSocket = await Bun.udpSocket({
        binaryType: 'uint8array',
        hostname: LOCALHOST,
        socket: {
            data(socket, data, port, address) {
                console.log('game server socket recieved', data, 'from', port, address)
            },
        },
    })
    console.log('game server listens on', gameServerSocket.port)

    const gameClientSocket = await Bun.udpSocket({
        binaryType: 'uint8array',
        hostname: LOCALHOST,
        socket: {
            data(socket, data, port, address) {
                console.log('game client socket recieved', data, 'from', port, address)
            },
        },
    })
    console.log('game client listens on', gameClientSocket.port)

    const serverNode = await createNode()
    console.log('lobby server node addrs', serverNode.getMultiaddrs().map(ma => ma.toString()))

    const clientNode = await createNode()
    console.log('lobby client node addrs', clientNode.getMultiaddrs().map(ma => ma.toString()))
    
    console.log('creating proxies...')
    const proxyServer = new ProxyServer(serverNode)
    const proxyClient = new ProxyClient(clientNode)

    try {

        console.log('patching peerStore...')
        await serverNode.peerStore.patch(clientNode.peerId, { multiaddrs: clientNode.getMultiaddrs() })
        await clientNode.peerStore.patch(serverNode.peerId, { multiaddrs: serverNode.getMultiaddrs() })

        console.log('client node dialing server node...')
        await clientNode.dial(serverNode.peerId)

        console.log('starting proxy server...')
        await proxyServer.start(gameServerSocket.port, [ clientNode.peerId ])
        
        console.log('starting proxy client...')
        await proxyClient.connect(serverNode.peerId)

        const serverOnClientPort = proxyClient.getPort(serverNode.peerId)!
        console.log('server on client port', serverOnClientPort)
        const clientOnServerPort = proxyServer.getPort(clientNode.peerId)!
        console.log('client on server port', clientOnServerPort)

        console.log('C2S', gameClientSocket.send(new Uint8Array([1, 2, 3, 4]), serverOnClientPort, LOCALHOST))
        console.log('S2C', gameServerSocket.send(new Uint8Array([5, 6, 7, 8]), clientOnServerPort, LOCALHOST))

        await new Promise(res => setTimeout(res, 1000))
        
    } finally {
        console.log('exit')

        gameServerSocket.close()
        gameClientSocket.close()

        proxyServer.stop()
        proxyClient.disconnect()

        serverNode.stop()
        clientNode.stop()
    }
}
*/

async function delay(ms: number){
    return new Promise(res => setTimeout(res, ms))
}

async function testServer(){
    let gameServerSocket, serverNode, proxyServer
    try {
        gameServerSocket = await Bun.udpSocket({
            //binaryType: 'uint8array',
            hostname: LOCALHOST,
            socket: {
                data(socket, data, port, address) {
                    console.log('game server socket recieved', data, 'from', port, address)
                },
            },
        })
        console.log('game server listens on', gameServerSocket.port)

        serverNode = await createNode(serverNodePrivateKey, 5116)
        console.log('lobby server node addrs', serverNode.getMultiaddrs().map(ma => ma.toString()))

        //console.log('patching peerStore...')
        //await serverNode.peerStore.patch(clientNodePeerId, { multiaddrs: [ multiaddr(`/ip4/127.0.0.1/udp/${5117}/utp`) ] })
        
        console.log('waiting for connections...')
        await delay(5000)
        
        console.log('creating proxy...')
        proxyServer = new ProxyServer(serverNode)

        console.log('starting proxy server...')
        await proxyServer.start(gameServerSocket.port, [ clientNodePeerId ])
        
        const clientOnServerPort = proxyServer.getPort(clientNodePeerId)!
        console.log('client on server port', clientOnServerPort)

        console.log('waiting for message...')
        await delay(5000)

        console.log('S2C', gameServerSocket.send(Buffer.from([5, 6, 7, 8]), clientOnServerPort, LOCALHOST))

        console.log('waiting for message...')
        await delay(5000)

    } finally {
        console.log('exit')
        gameServerSocket?.close()
        proxyServer?.stop()
        serverNode?.stop()
    }
}

async function testClient(){
    let gameClientSocket, clientNode, proxyClient
    try {
        gameClientSocket = await Bun.udpSocket({
            //binaryType: 'uint8array',
            hostname: LOCALHOST,
            socket: {
                data(socket, data, port, address) {
                    console.log('game client socket recieved', data, 'from', port, address)
                },
            },
        })
        console.log('game client listens on', gameClientSocket.port)
        
        clientNode = await createNode(clientNodePrivateKey, 5117)
        console.log('lobby client node addrs', clientNode.getMultiaddrs().map(ma => ma.toString()))

        console.log('patching peerStore...')
        await clientNode.peerStore.patch(serverNodePeerId, { multiaddrs: [ multiaddr(`/ip4/127.0.0.1/udp/${5116}/utp`) ] })
        
        console.log('client node dialing server node...')
        await clientNode.dial(serverNodePeerId)

        console.log('waiting for server proxy start...')
        await delay(5000)

        console.log('creating proxy...')
        proxyClient = new ProxyClient(clientNode)

        console.log('connecting proxy client...')
        await proxyClient.connect(serverNodePeerId, undefined)

        const serverOnClientPort = proxyClient.getPort(serverNodePeerId)!
        console.log('server on client port', serverOnClientPort)

        console.log('C2S', gameClientSocket.send(Buffer.from([1, 2, 3, 4]), serverOnClientPort, LOCALHOST))

        console.log('waiting for message...')
        await delay(5000)
        
    } finally {
        console.log('exit')
        gameClientSocket?.close()
        proxyClient?.disconnect()
        clientNode?.stop()
    }
}

async function testClientServer(){
    
    const gameServerSocket = await Bun.udpSocket({
        binaryType: 'buffer',
        hostname: LOCALHOST,
        socket: {
            data(socket, data, port, address) {
                console.log('game server socket recieved', data, 'from', port, address)
            },
        },
    })
    console.log('game server listens on', gameServerSocket.port)

    const gameClientSocket = await Bun.udpSocket({
        binaryType: 'buffer',
        hostname: LOCALHOST,
        socket: {
            data(socket, data, port, address) {
                console.log('game client socket recieved', data, 'from', port, address)
            },
        },
    })
    console.log('game client listens on', gameClientSocket.port)

    const nodePrivateKey = serverNodePrivateKey
    const nodePeerId = serverNodePeerId

    const node = await createNode(nodePrivateKey, 5116)
    console.log('lobby node addrs', node.getMultiaddrs().map(ma => ma.toString()))
    
    console.log('creating proxies...')
    const proxyServer = new ProxyServer(node)
    const proxyClient = new ProxyClient(node)

    try {
        console.log('starting proxy server...')
        await proxyServer.start(gameServerSocket.port, [ nodePeerId ])
        
        console.log('starting proxy client...')
        await proxyClient.connect(nodePeerId, proxyServer)

        const serverOnClientPort = proxyClient.getPort(nodePeerId)!
        console.log('server on client port', serverOnClientPort)
        const clientOnServerPort = proxyServer.getPort(nodePeerId)!
        console.log('client on server port', clientOnServerPort)

        console.log('C2S', gameClientSocket.send(Buffer.from([1, 2, 3, 4]), serverOnClientPort, LOCALHOST))
        await delay(1000)
        console.log('S2C', gameServerSocket.send(Buffer.from([5, 6, 7, 8]), clientOnServerPort, LOCALHOST))

        await delay(1000)
        
    } finally {
        console.log('exit')

        gameServerSocket.close()
        gameClientSocket.close()

        proxyServer.stop()
        proxyClient.disconnect()

        node.stop()
    }
}
