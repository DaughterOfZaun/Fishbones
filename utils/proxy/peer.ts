import { Acknowledge, Connect, Protocol, ProtocolFlag, ProtocolHeader, Reader, Send, SendFragment, SendReliable, SendUnreliable, VerifyConnect, Version, Writer } from "./enet"

const version = Version.Season12

class Channel {
    public reliableSequenceNumber = 0
    public unreliableSequenceNumber = 0
    constructor(
        public readonly id: number
    ){}

    public fragmentStartSequenceNumbers = new Map<number, number>() // remote -> local
    public fragmentStartSequenceNumbers_get(remoteNumber: number, defaultValue: number){
        let localNumber = this.fragmentStartSequenceNumbers.get(remoteNumber)
        if(!localNumber){
            localNumber = defaultValue
            this.fragmentStartSequenceNumbers.set(remoteNumber, localNumber)
        }
        return localNumber
    }
}

type Packets = {
    header: ProtocolHeader
    packets: Protocol[]
}

export type WrappedPacket = {
    fragment: {
        startSequenceNumber: number
        fragmentCount: number
        fragmentNumber: number
        totalLength: number
        fragmentOffset: number
    } | undefined,
    channelID: number
    data: Buffer
}

function assign<A extends object>(a: A, b: Partial<{ [ K in keyof A ]: A[K] }>){
    return Object.assign(a, b)
}

export class Peer {

    private sessionId = 0
    private incomingId = 0
    private outgoingId = version.maxPeerID
    private startTime = Date.now()
    private channels = new Map<number, Channel>()
    private channels_get(id: number){
        let channel = this.channels.get(id)
        if(!channel){
            channel = new Channel(id)
            this.channels.set(id, channel)
        }
        return channel
    }

    private readonly name: string
    constructor(nameOrConfig: string | { name: string, onsend: (data: Buffer) => void }){
        if(typeof nameOrConfig == 'string'){
            this.name = nameOrConfig
        } else {
            this.name = nameOrConfig.name
            this.onsend = nameOrConfig.onsend
        }
    }

    public onsend!: (data: Buffer) => void
    //public ondata!: (data: Buffer) => void

    private send(packets: Protocol[]){
        console.assert(packets.length > 0)
        const buffer = this.writePackets(packets)
        //console.log('send', packets, this.readPackets(buffer))
        return this.onsend(buffer)
    }

    public connect(){

        this.sessionId = 0x29000000

        const channel = this.channels_get(0xFF)
        const reliableSequenceNumber = ++channel.reliableSequenceNumber
        const packet = assign(new Connect(), {
            flags: ProtocolFlag.ACKNOWLEDGE,
            channelID: channel.id,
            reliableSequenceNumber,
            outgoingPeerID: this.incomingId,
            mtu: 1400,
            windowSize: 32 * 1024,
            channelCount: 7,
            incomingBandwidth: 0,
            outgoingBandwidth: 0,
            packetThrottleInterval: 5000,
            packetThrottleAcceleration: 2,
            packetThrottleDeceleration: 2,
            sessionID: this.sessionId,
            //command: 2,
            //size: 40,
        })
        this.send([ packet ])
    }

    public receivePackets(data: Buffer): WrappedPacket[] {
        const packets = this.readPackets(data)
        if(packets == null){
            console.log('ERROR: packets == null')
            return []
        }

        const responses: Protocol[] = []
        const { header, packets: requests } = packets
        for(const request of requests){
            const response = this.createResponse(request, header)
            if(response) responses.push(response)
        }

        if(responses.length){
            this.send(responses)
        }

        //console.log('receive', requests)

        return requests
            .filter(packet => packet instanceof Send)
            .map((packet) => {
                //const channel = this.channels_get(packet.channelID)
                const wrapped: WrappedPacket = {
                    fragment: (packet instanceof SendFragment) ? {
                        startSequenceNumber: packet.startSequenceNumber,
                        fragmentCount: packet.fragmentCount,
                        fragmentNumber: packet.fragmentNumber,
                        totalLength: packet.totalLength,
                        fragmentOffset: packet.fragmentOffset,
                    } : undefined,
                    channelID: packet.channelID,
                    data: packet.data,
                }
                return wrapped
            })
    }

    private createResponse(request: Protocol, request_header: ProtocolHeader): Protocol | null {

        if(request instanceof Connect){

            this.sessionId = request.sessionID //TODO:
            this.outgoingId = request.outgoingPeerID

            const channel = this.channels_get(0xFF)
            const reliableSequenceNumber = ++channel.reliableSequenceNumber
            const response = assign(new VerifyConnect(), {
                flags: ProtocolFlag.ACKNOWLEDGE,
                channelID: channel.id,
                reliableSequenceNumber,
                outgoingPeerID: 0,
                mtu: 1400,
                windowSize: 32 * 1024,
                channelCount: 7,
                incomingBandwidth: 0,
                outgoingBandwidth: 0,
                packetThrottleInterval: 5000,
                packetThrottleAcceleration: 2,
                packetThrottleDeceleration: 2,
                //command: 3,
                //size: 36,
            })
            return response
        }

        if(request instanceof VerifyConnect){
            this.sessionId = request_header.sessionID //TODO:
            this.outgoingId = request.outgoingPeerID
        }

        if((request.flags & ProtocolFlag.ACKNOWLEDGE) != 0){

            console.assert(request_header.timeSent !== null, 'Assertion failed: request.header.timeSent is null')

            const channel = this.channels_get(request.channelID)
            const response = assign(new Acknowledge(), {
                flags: ProtocolFlag.NONE,
                channelID: channel.id,
                reliableSequenceNumber: channel.reliableSequenceNumber,
                receivedReliableSequenceNumber: request.reliableSequenceNumber,
                receivedSentTime: request_header.timeSent!,
                //command: 1,
                //size: 8,
            })
            return response
        }

        return null
    }

    public sendUnreliable(wrappedPackets: WrappedPacket[]){
        const packets: Protocol[] = []
        console.assert(wrappedPackets.length > 0, 'Assertion failed: wrappedPackets.length == 0')
        for(const wrappedPacket of wrappedPackets){
            const packet = this.unwrapUnreliablePacket(wrappedPacket)
            packets.push(packet)
        }
        const buffer = this.writePackets(packets)
        return this.onsend(buffer)
    }

    private unwrapUnreliablePacket(wrappedPacket: WrappedPacket): Protocol {
        const { channelID, data } = wrappedPacket

        const channel = this.channels_get(channelID)

        const fragment = wrappedPacket.fragment
        if(fragment){
            const { fragmentCount, fragmentNumber, fragmentOffset, totalLength } = fragment
            const reliableSequenceNumber = ++channel.reliableSequenceNumber
            const startSequenceNumber = channel.fragmentStartSequenceNumbers_get(
                fragment.startSequenceNumber, reliableSequenceNumber
            )
            const packet = assign(new SendFragment(), {
                channelID, flags: 0, //ProtocolFlag.ACKNOWLEDGE,
                reliableSequenceNumber, startSequenceNumber,
                fragmentCount, fragmentNumber, fragmentOffset,
                data, totalLength,
                //command: 8,
                //size: 24,
            })
            return packet
        }

        const reliableSequenceNumber = channel.reliableSequenceNumber
        const unreliableSequenceNumber = ++channel.unreliableSequenceNumber
        const packet = assign(new SendUnreliable(), {
            flags: 0,
            channelID: channelID,
            reliableSequenceNumber,
            unreliableSequenceNumber,
            //command: 7,
            //size: 8,
            data,
        })
        return packet
    }

    private unwrapReliablePacket(wrappedPacket: WrappedPacket): Protocol {
        const { channelID, data } = wrappedPacket

        const channel = this.channels_get(channelID)
        const reliableSequenceNumber = ++channel.reliableSequenceNumber
        const packet = assign(new SendReliable(), {
            flags: ProtocolFlag.ACKNOWLEDGE,
            channelID: channelID,
            reliableSequenceNumber,
            //command: 6,
            //size: 6,
            data,
        })
        return packet
    }

    private readPackets(buffer: Buffer): Packets | null {
        const reader = new Reader(buffer)

        const header = ProtocolHeader.create(reader, version)
        if(!header){
            console.log('ERROR: !header')
            return null
        }

        const packets: Protocol[] = []
        while(true){
            const packet = this.readPacket(reader)
            if(packet != null){
                packets.push(packet)
                if(reader.position == buffer.length){
                    break
                }
            } else {
                console.log('ERROR: packet == null')
                break
            }
        }

        //console.assert(reader.position == buffer.length, `Assertion failed: reader.position (${reader.position}) != buffer.length (${buffer.length})`)
        const result = { header, packets }
        //console.log('read', result)
        return result
    }

    private readPacket(reader: Reader): Protocol | null {

        const packet = Protocol.create(reader, version)
        if(!packet){
            console.log('ERROR: !packet')
            return null
        }

        //if(packet instanceof Ping) console.log(this.name, 'read', 'ping')
        //else if(packet instanceof Acknowledge) console.log(this.name, 'read', 'ack')
        //else console.log(this.name, 'read', packet)

        return packet
    }

    //readonly buffer = Buffer.alloc(32 * 1024)
    private writePackets(packets: Protocol[]): Buffer {
        console.assert(packets.length > 0, 'packets.length == 0')

        const timeSent = (Date.now() - this.startTime) & 0x7FFF
        const header = assign(new ProtocolHeader(), {
            sessionID: this.sessionId,
            peerID: this.outgoingId,
            timeSent,
        })

        //console.log('write', { header, packets })

        const bufferLength = 0
            + this.calculateHeaderSize(header)
            + packets.reduce((a, packet) => a + this.calculatePacketSize(packet), 0)
        const this_buffer = Buffer.alloc(bufferLength)
        console.assert(bufferLength <= this_buffer.length, 'Assertion failed: bufferLength > this.buffer.length')

        const writer = new Writer(this_buffer)
        header.write(writer, version)
        for(const packet of packets){
            this.writePacket(writer, packet)
        }

        console.assert(writer.position == bufferLength, 'Assertion failed: writer.position != bufferLength')
        //return this_buffer.subarray(0, writer.position)
        return this_buffer
    }

    private calculateHeaderSize(header: ProtocolHeader){
        let header_size = version.maxHeaderSizeSend
        if(header.timeSent == null){
            header_size -= 2
        }
        return header_size
    }

    private calculatePacketSize(packet: Protocol){
        let packet_size = packet.size
        if(packet instanceof Send){
            packet_size += packet.data.length
        }
        return packet_size
    }

    private writePacket(writer: Writer, packet: Protocol){
        packet.write(writer, version)

        //if(packet instanceof Ping) console.log(this.name, 'write', 'ping')
        //else if(packet instanceof Acknowledge) console.log(this.name, 'write', 'ack')
        //else console.log(this.name, 'write', packet)
    }
}
