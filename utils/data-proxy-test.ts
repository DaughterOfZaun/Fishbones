import { noise } from "@chainsafe/libp2p-noise"
import { yamux } from "@chainsafe/libp2p-yamux"
import { tcp } from "@libp2p/tcp"
import { webRTC, webRTCDirect } from "@libp2p/webrtc"
import { createLibp2p } from "libp2p"
import { LOCALHOST } from "./constants"
import { ProxyClient, ProxyServer } from "./data-proxy"

const createNode = async () => {
    const node = await createLibp2p({
        addresses: {
            listen: [
                `/ip4/0.0.0.0/tcp/${0}`,
                //`/ip4/0.0.0.0/udp/${0}/webrtc`,
                `/ip4/0.0.0.0/udp/${0}/webrtc-direct`,
            ]
        },
        transports: [
            webRTCDirect(),
            //webRTC(),
            tcp(),
        ],
        streamMuxers: [ yamux() ],
        connectionEncrypters: [ noise() ],
        services: {}
    })
    return node
  }

await test()
async function test(){
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

    await serverNode.peerStore.patch(clientNode.peerId, { multiaddrs: clientNode.getMultiaddrs() })
    await clientNode.peerStore.patch(serverNode.peerId, { multiaddrs: serverNode.getMultiaddrs() })

    const proxyServer = new ProxyServer(serverNode)
    const proxyClient = new ProxyClient(clientNode)

    await proxyServer.start(gameServerSocket.port, [ clientNode.peerId ])
    await proxyClient.connect(serverNode.peerId)

    const serverOnClientPort = proxyClient.getPort(serverNode.peerId)!
    gameClientSocket.send(new Uint8Array([1, 2, 3, 4]), serverOnClientPort, LOCALHOST)

    //await new Promise(res => setTimeout(res, 100))

    const clientOnServerPort = proxyServer.getPort(clientNode.peerId)!
    gameServerSocket.send(new Uint8Array([1, 2, 3, 4]), clientOnServerPort, LOCALHOST)

    gameServerSocket.close()
    gameClientSocket.close()

    serverNode.stop()
    clientNode.stop()
}