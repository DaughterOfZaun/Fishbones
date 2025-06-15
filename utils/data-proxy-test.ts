import { noise } from "@chainsafe/libp2p-noise"
import { yamux } from "@chainsafe/libp2p-yamux"
import { tcp } from "@libp2p/tcp"
import { webRTC, webRTCDirect } from "@libp2p/webrtc"
import { createLibp2p } from "libp2p"
import { LOCALHOST } from "./constants"

const createNode = async () => {
    const node = await createLibp2p({
        addresses: {
            listen: [
                `/ip4/0.0.0.0/tcp/${0}`,
                `/ip4/0.0.0.0/udp/${0}/webrtc`,
                `/ip4/0.0.0.0/udp/${0}/webrtc-direct`,
            ]
        },
        transports: [
            webRTCDirect(),
            webRTC(),
            tcp(),
        ],
        streamMuxers: [ yamux() ],
        connectionEncrypters: [ noise() ],
        services: {}
    })
    return node
  }

async function testServer(){
    const gss = await Bun.udpSocket({ binaryType: 'uint8array', hostname: LOCALHOST })
    console.log('game server listens on', gss.port)

    const gsc = await Bun.udpSocket({ binaryType: 'uint8array', hostname: LOCALHOST })
    console.log('game client listens on', gsc.port)

    const gsn = await createNode()
    const gcn = await createNode()
}