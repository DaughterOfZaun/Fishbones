import { udpSocket, type Socket, type ReceiveFlags } from "../../utils/bun"
import { TypedEventEmitter, type PeerId, type PeerStore, type Startable } from "@libp2p/interface"
import { parseIPv4 } from '@chainsafe/is-ip/parse'
import { Packet } from '../../message/probe'
import { bytesToUInt32, uInt32ToBytes } from "../../utils/binary"
import { Circuit } from '@multiformats/multiaddr-matcher'
import { randomBytes } from '@libp2p/crypto'
import { PeerMap } from "@libp2p/peer-collections"
import { sleep, sortInplace, toBase64 } from "../../utils/helpers"
import type { AbortOptions } from "@multiformats/multiaddr"
import { isLoopback } from '@libp2p/utils/multiaddr/is-loopback'
import { Peer as ENetPeer } from '../../utils/proxy/peer'
import { Connect, ProtocolFlag, Version } from "../../utils/proxy/enet"
import { assign } from "../../utils/proxy/utils"

const DATA_SIZE = 32
const ATTEMPTS_COUNT = 3
const ATTEMPTS_INTERVAL = 1000

class ProbeInit {
    port: number = 0
}
interface ProbeEvents {}
interface ProbeComponents {
    peerStore: PeerStore
}

export function probe(init?: Partial<ProbeInit>): (components: ProbeComponents) => Probe {
  return (components) => new Probe(init, components)
}

class Peer {
    constructor(
        public readonly peerId: PeerId,
        public addresses?: Address[],
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

//type Socket = Bun.udp.Socket<'buffer'>
//type ReceiveFlags = Bun.udp.ReceiveFlags
class Probe extends TypedEventEmitter<ProbeEvents> implements Startable {
    
    private _port = 0
    private set port(to: number){ this._port = to }
    public get port(){ return this._port }

    private socket: Socket | null = null
    private readonly peers = new PeerMap<Peer>()
    private peers_get(peerId: PeerId){
        let peer = this.peers.get(peerId)
        if(!peer){
            peer = new Peer(peerId)
            this.peers.set(peerId, peer)
        }
        return peer
    }
    private readonly pendingRequests = new Map<string, Message>()

    private readonly init: ProbeInit
    constructor(
        init: Partial<ProbeInit> | undefined,
        private readonly components: ProbeComponents,
    ){
        super()
        this.init = Object.assign(new ProbeInit(), init ?? {})
        this.port = this.init.port
    }

    async start(){
        if(this.socket) return
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

    stop(){
        if(!this.socket) return
        this.socket?.close()
        this.socket = null
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

        const msgId = toBase64(pkt.data)
        const msg = this.pendingRequests.get(msgId)

        if(!msg && pkt.action == Packet.Ping.Action.Request){
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
        if(msg && pkt.action == Packet.Ping.Action.Response){
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

    private async resetPeerAddresses(peerId: PeerId, port: number, opts: Required<AbortOptions>){

        const ps = this.components.peerStore
        const info = await ps.get(peerId)
        const hosts = new Set<string>()
        for(const { multiaddr: addr } of info.addresses){
            if(!Circuit.exactMatch(addr) && !(isLoopback(addr) && port == this.port)){
                const component = addr.getComponents().at(0)
                if(component?.name == 'ip4' && component.value){
                    const host = component.value
                    hosts.add(host)
                }
            }
        }

        const addresses = [...hosts].map(host => new Address(host, port))
        const peer = this.peers_get(peerId)
        peer.addresses = addresses

        return addresses
    }

    private async ping(peerId: PeerId, port: number, opts: Required<AbortOptions>){

        const addresses = await this.resetPeerAddresses(peerId, port, opts)
        const msgs = new Map<string, Message>()     

        for(let attempt = 0; attempt < ATTEMPTS_COUNT; attempt++){

            for(const addr of addresses){
                const { host, port } = addr

                const data = randomBytes(DATA_SIZE)
                const msgId = toBase64(data)
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

            await sleep(ATTEMPTS_INTERVAL, opts)
        }
        
        for(const [ msgId, msg ] of msgs.entries()){
            this.pendingRequests.delete(msgId)
        }
    }

    private async ping126(peerId: PeerId, port: number, opts: Required<AbortOptions>){
        const addresses = await this.resetPeerAddresses(peerId, port, opts)
        const peer = new ENetPeer({
            name: 'prober',
            onsend(data){},
        })
        const socket = await udpSocket({
            hostname: '0.0.0.0', port: 0,
            socket: {
                data(socket, data, port, address, flags){

                },
            }
        })
        for(const addr of addresses){
            const { host, port } = addr
            
            const reliableSequenceNumber = 1
            const outgoingPeerID = 0
            const sessionID = 0x29000000
            const packet = assign(new Connect(), {
                flags: ProtocolFlag.ACKNOWLEDGE,
                channelID: 0xFF,
                reliableSequenceNumber,
                outgoingPeerID,
                mtu: 1400,
                windowSize: 32 * 1024,
                channelCount: 7,
                incomingBandwidth: 0,
                outgoingBandwidth: 0,
                packetThrottleInterval: 5000,
                packetThrottleAcceleration: 2,
                packetThrottleDeceleration: 2,
                sessionID,
            })
        }
    }

    public getBestIPv4Address(peerId: PeerId){

        const peer = this.peers.get(peerId)
        let addresses = peer?.addresses
        if(!addresses) return

        addresses = addresses.filter(addr => addr.packetsReceived > 0)
        if(!addresses.length) return

        sortInplace(addresses, (addr) => {
            //const MAX_PING = ATTEMPTS_COUNT * ATTEMPTS_INTERVAL
            //const addr_packetsLost = addr.packetsSent - addr.packetsReceived
            //return (addr.totalPing + addr_packetsLost * MAX_PING) / addr.packetsSent
            if(addr.packetsReceived == 0) return Infinity
            const avgRTT = addr.totalPing / addr.packetsReceived
            const t = addr.packetsSent / addr.packetsReceived
            return avgRTT * t
        }, 'asc')

        const addr = addresses.at(0)!
        const { host, port } = addr
        return { host, port }
    }
}
