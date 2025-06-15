import { noise } from "@chainsafe/libp2p-noise"
import { yamux } from "@chainsafe/libp2p-yamux"
import { tcp } from "@libp2p/tcp"
import { /*webRTC,*/ webRTCDirect } from "@libp2p/webrtc"
import { createLibp2p } from "libp2p"
import { LOCALHOST } from "./constants"
import { createSocket, ProxyClient, ProxyServer } from "./data-proxy"
import { pipe } from "it-pipe"

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

await test1()
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
    
    client.send("Hello!", /*server.port, "127.0.0.1"*/);

    await new Promise(res => setTimeout(res, 300))

    server.close()
    client.close()
}

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
    
    try {

        console.log('patching peerStore...')
        await serverNode.peerStore.patch(clientNode.peerId, { multiaddrs: clientNode.getMultiaddrs() })
        await clientNode.peerStore.patch(serverNode.peerId, { multiaddrs: serverNode.getMultiaddrs() })

        console.log('creating proxies...')
        const proxyServer = new ProxyServer(serverNode)
        const proxyClient = new ProxyClient(clientNode)

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

        serverNode.stop()
        clientNode.stop()
    }
}