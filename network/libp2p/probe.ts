import { sleep, udpSocket } from "bun"
import { TypedEventEmitter, type PeerId, type PeerStore, type Startable } from "@libp2p/interface"
import { parseIPv4 } from '@chainsafe/is-ip/parse'
import { Packet } from '../../message/probe'
import { bytesToUInt32, uInt32ToBytes } from "../../utils/binary"
import { Circuit } from '@multiformats/multiaddr-matcher'
import { randomBytes } from '@libp2p/crypto'
import { PeerMap } from "@libp2p/peer-collections"
import { sortInplace } from "../../utils/helpers"

const DATA_SIZE = 32
const ATTEMPTS_COUNT = 3
const ATTEMPTS_INTERVAL = 1000

interface ProbeInit {}
interface ProbeEvents {}
interface ProbeComponents {
    peerStore: PeerStore
}

export function probe(init: ProbeInit = {}): (components: ProbeComponents) => Probe {
  return (components) => new Probe(init, components)
}

class Peer {
    constructor(
        public readonly peerId: PeerId,
        public address?: Address,
    ){}
}

class Address {
    constructor(
        public readonly host: string,
        public readonly port: number,
        public packetsReceived: number = 0,
        public packetsSent: number = 0,
        public totalPing: number = 0,
    ){}
}

class Message {
    constructor(
        public readonly destination: Address,
        public readonly createdAt: number,
        public arrivedAt?: number,
    ){}
}

type Socket = Bun.udp.Socket<'buffer'>
type ReceiveFlags = Bun.udp.ReceiveFlags
class Probe extends TypedEventEmitter<ProbeEvents> implements Startable {
    
    private port = 0
    private socket: Socket | null = null
    private readonly peers = new PeerMap<Peer>()
    private readonly pendingRequests = new Map<string, Message>()

    constructor(
        private readonly init: ProbeInit,
        private readonly components: ProbeComponents,
    ){
        super()
    }

    async start(){
        this.socket = await udpSocket<'buffer'>({
            hostname: '0.0.0.0', port: this.port,
            socket: {
                data: (socket, data, port, address, flags) => {
                    return this.onData(socket, data, port, address, flags)
                },
            },
        })
        this.port = this.socket.address.port
    }

    public getPort(){
        return this.port
    }

    //drain = (socket: Socket) => {}
    //error = (socket: Socket, error: Error) => {}
    private onData(socket: Socket, rawdata: Buffer, port: number, address: string, flags: ReceiveFlags){
        
        let pkt: Packet.Ping | undefined
        try {
            pkt = Packet.decode(rawdata).ping
        } catch(err){
            // Ignore.
        }
        if(!pkt) return

        if(pkt.action == Packet.Ping.Action.Request){
            const parsedIPv4Address = parseIPv4(address)
            const encoded = Packet.encode({
                ping: {
                    data: pkt.data,
                    action: Packet.Ping.Action.Response,
                    observed: !(parsedIPv4Address) ? undefined : {
                        host: bytesToUInt32(parsedIPv4Address),
                        port,
                    },
                }
            })
            socket.send(encoded, port, address)
        }
        else
        if(pkt.action == Packet.Ping.Action.Response){
            const msgId = pkt.data.toBase64()
            const msg = this.pendingRequests.get(msgId)
            if(msg){
                msg.arrivedAt = Date.now()
                const ping = msg.arrivedAt - msg.createdAt
                msg.destination.totalPing += ping
                msg.destination.packetsReceived += 1
                this.pendingRequests.delete(msgId)

                //const { host, port } = msg.destination
                //console.log(`Received response from ${host}:${port}`)
                //const observedHost = uInt32ToBytes(pkt.observed!.host).join('.')
                //const observerdPort = pkt.observed!.port
                //console.log(`Observed host:port is ${observedHost}:${observerdPort}`)
            }
        }
    }

    public async ping(peerId: PeerId, port: number){

        const ps = this.components.peerStore
        const info = await ps.get(peerId)
        const hosts = new Set<string>()
        for(const { multiaddr: addr } of info.addresses){
            if(!Circuit.exactMatch(addr)){
                const component = addr.getComponents().at(0)
                if(component?.name == 'ip4' && component.value){
                    const host = component.value
                    hosts.add(host)
                }
            }
        }

        const msgs = new Map<string, Message>()
        const addresses = [...hosts].map(host => new Address(host, port))
        for(let attempt = 0; attempt < ATTEMPTS_COUNT; attempt++){

            for(const addr of addresses){
                const { host, port } = addr

                const data = randomBytes(DATA_SIZE)
                const msgId = data.toBase64()
                const msg = new Message(addr, Date.now())
                const encoded = Packet.encode({
                    ping: {
                        data,
                        action: Packet.Ping.Action.Request,
                    }
                })

                msgs.set(msgId, msg)
                this.pendingRequests.set(msgId, msg)
                this.socket!.send(encoded, port, host)

                addr.packetsSent++
            }
            await sleep(ATTEMPTS_INTERVAL)
        }
        
        for(const [ msgId, msg ] of msgs.entries()){
            this.pendingRequests.delete(msgId)
        }

        sortInplace(addresses, (addr) => {
            const MAX_PING = ATTEMPTS_COUNT * ATTEMPTS_INTERVAL
            const addr_packetsLost = addr.packetsSent - addr.packetsReceived
            return (addr.totalPing + addr_packetsLost * MAX_PING) / addr.packetsSent
        }, 'asc')

        let peer = this.peers.get(peerId)
        if(!peer){
            peer = new Peer(peerId)
            this.peers.set(peerId, peer)
        }
        peer.address = addresses.at(0)
    }

    public getIPv4Addr(peerId: PeerId){
        const addr = this.peers.get(peerId)?.address
        if(addr && addr.packetsReceived > 0){
            const { host, port } = addr
            return { host, port }
        }
    }

    stop(){
        this.socket?.close()
        this.socket = null
    }
}
