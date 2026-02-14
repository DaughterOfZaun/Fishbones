import type { LibP2PNode } from "../../node/node"
import type { PeerId, AbortOptions } from "@libp2p/interface"
import { Scheduler, type TimeSource } from "./proxy-scheduler"
import { Peer, type WrappedPacket } from "./peer"
import { Wrapped } from '../../message/proxy'
import { Role } from "./shared"
import { Proxy } from "./proxy"
import { type PeerData, type SocketToProgram } from "./proxy"

//import { LOCALHOST } from "./constants"
const LOCALHOST = "127.0.0.1"

export class ClientServerProxy extends Proxy {

    private scheduler: Scheduler
    private timeSource: TimeSource
    private peerToClient: Peer | null = null
    private socketToClient: SocketToProgram | null = null
    private ownPeer: PeerData | null = null
    private delay: number = 150

    public constructor(node: LibP2PNode){
        super(node, Role.ClientServer)
        this.timeSource = node.services.time
        this.scheduler = new Scheduler(this.timeSource)
    }

    public setDelay(ping: number){
        this.delay = ping
    }

    public async start(peerIds: PeerId[], opts: Required<AbortOptions>){
        //ourLog(this.node.peerId.toString(), 'start', JSON.stringify(peerIds.map(id => id.toString()), null, 4))

        for(const peerId of peerIds){
            const peer: PeerData = {
                peerId,
                socketToRemote: undefined!,
                socketToProgram: undefined!,
            }
            this.peersByPeerId.set(peerId.toString(), peer)
        }

        this.ownPeer = this.peersByPeerId.get(this.node.peerId.toString())!
        console.assert(this.ownPeer, 'Assertion failed: typeof this.ownPeer != "object"')

        const clientPort = 0
        const serverPort = 0
        
        await Promise.all([
            
            (async () => {
                const peer = this.ownPeer!
                this.socketToClient = await this.createSocketToProgram(
                    LOCALHOST, clientPort, this.onClientData.bind(this, peer), opts
                )
            })(),
            
            ...this.peersByPeerId.values()
                .map(async (peer) => {
                    peer.socketToProgram = await this.createSocketToProgram(
                        LOCALHOST, serverPort, this.onServerData.bind(this, peer), opts
                    )
                }),
            
            this.strategy.createMainSocketToRemote(opts),

            ...this.peersByPeerId.values()
                .filter(peer => peer != this.ownPeer)
                .map(async (peer) => {
                    peer.socketToRemote = await this.strategy.createSocketToRemote(
                        peer.peerId, this.onRemoteData.bind(this, peer), opts
                    )
                }),
        ])

        await Bun.sleep(1000) //HACK: By this time the main socket should be created on all machines.
        await this.strategy.connectSockets(opts)
    }

    public afterStart(serverPort: number){
        //ourLog(formatPeer(this.node), 'afterStart', serverPort)

        this.peerToClient = new Peer('peerToClient')
        this.peerToClient.onsend = (data) => {
            //console.log('peerToClient', 'send', this.peerToClient!.readPackets(data))
            try {
                this.socketToClient!.send(data)
            } catch(error) {
                const errno = error as ErrnoException
                if(errno.syscall === 'send' && errno.errno === -22 && errno.code === "EINVAL"){ /* Ignore. */ }
                else console.log(error)
            }
        }

        for(const peer of this.peersByPeerId.values()){
            peer.socketToProgram.setPort(serverPort)

            //if(peer === this.ownPeer) continue
            
            peer.peerToProgram = new Peer('peerToProgram')
            peer.peerToProgram.onsend = (data) => {
                //console.log('peerToProgram', 'send', peer.peerToProgram!.readPackets(data))
                peer.socketToProgram.send(data)
            }
            peer.peerToProgram.connect()
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private onClientData = (peer: PeerData, rawdata: Buffer, hostport: string) => {
        //ourLog(formatPeer(this.node), 'onClientData', formatData(rawdata), 'from', formatPeer(peer) + '/' + hostport)

        const packets = this.peerToClient!.receivePackets(rawdata)
        if(packets.length === 0) return

        const wrapped = Buffer.from(Wrapped.encode({ time: this.timeSource.now(), packets }))
        for(const peer of this.peersByPeerId.values()){
            if(peer === this.ownPeer){
                //ourLog(formatPeer(this.node), 'Sending', formatData(packets[0]!.data), 'to', 'localhost')
                this.onRemoteData(peer, wrapped, 'localhost')
            } else {
                //ourLog(formatPeer(this.node), 'Sending', formatData(packets[0]!.data), 'to', peer.socketToRemote.targetHostPort)
                peer.socketToRemote.send(wrapped)
            }
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private onRemoteData = (peer: PeerData, rawdata: Buffer, hostport: string) => {
        //ourLog(formatPeer(this.node), 'onRemoteData', formatData(rawdata), 'from', formatPeer(peer) + '/' + hostport)
        
        const unwrapped = Wrapped.decode(rawdata)
        const time = unwrapped.time
        const packets = unwrapped.packets.map(packet => ({
            fragment: packet.fragment,
            channelID: packet.channelID,
            data: Buffer.from(packet.data),
        }))

        //ourLog(formatPeer(this.node), 'Delaying', formatData(packets[0]!.data), 'to', peer.socketToProgram.targetHostPort)
        this.scheduler.enqueue(time + this.delay, peerSendUnreliable, this.node, peer, packets)
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private onServerData = (peer: PeerData, rawdata: Buffer, hostport: string) => {
        //ourLog(formatPeer(this.node), 'onServerData', formatData(rawdata), 'from', formatPeer(peer) + '/' + hostport)
        
        const packets = peer.peerToProgram!.receivePackets(rawdata)
        if(packets.length === 0) return

        if(peer === this.ownPeer){
            //ourLog(formatPeer(this.node), 'Sending', formatData(packets[0]!.data), 'to', this.socketToClient!.targetHostPort)
            this.peerToClient!.sendUnreliable(packets)
        }
    }

    public getClientPort(){
        return this.socketToClient?.port
    }

    public stop(){
        this.scheduler.stop()
        this.closeSockets()
        this.socketToClient = null
        this.ownPeer = null
    }
}

//function peerSend(this_node: LibP2PNode, peer: PeerData, data: Buffer){
//    ourLog(formatPeer(this_node), 'Sending', formatData(data), 'to', peer.socketToProgram.targetHostPort)
//    peer.socketToProgram.send(data)
//}

function peerSendUnreliable(this_node: LibP2PNode, peer: PeerData, packets: WrappedPacket[]){
    //ourLog(formatPeer(this_node), 'Sending', formatData(packets[0]!.data), 'to', peer.socketToProgram.targetHostPort)
    peer.peerToProgram!.sendUnreliable(packets)
}
