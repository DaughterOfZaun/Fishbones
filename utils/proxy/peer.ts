import { Acknowledge, Connect, Ping, Protocol, ProtocolFlag, ProtocolHeader, Reader, Send, SendFragment, SendReliable, SendUnreliable, VerifyConnect, Version, Writer } from "./enet"

const version = Version.Season12

class Channel {
    public reliableSequenceNumber = 0
    public unreliableSequenceNumber = 0
    constructor(
        public readonly id: number
    ){}
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

    constructor(
        public readonly name: string,
    ){}

    public onsend!: (data: Buffer) => void
    //public ondata!: (data: Buffer) => void

    private send(header: ProtocolHeader, body: Protocol, data?: Buffer){
        const buffer = this.writePacket(header, body, data)
        return this.onsend(buffer)
    }

    public connect(){
        
        this.sessionId = 0x29000000

        const channel = this.channels_get(0xFF)
        const timeSent = Date.now() - this.startTime
        const reliableSequenceNumber = ++channel.reliableSequenceNumber
        const header = assign(new ProtocolHeader(), {
            sessionID: this.sessionId,
            peerID: version.maxPeerID,
            timeSent,
        })
        const body = assign(new Connect(), {
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

        this.send(header, body)
    }

    public receive(data: Buffer){
        
        const request = this.readPacket(data)

        if(!request){
            console.log('ERROR: !request')
            return null
        }

        if(request.body instanceof Connect){

            this.sessionId = request.body.sessionID //TODO:
            this.outgoingId = request.body.outgoingPeerID

            const channel = this.channels_get(0xFF)
            const timeSent = Date.now() - this.startTime
            const reliableSequenceNumber = ++channel.reliableSequenceNumber
            const header = assign(new ProtocolHeader(), {
                sessionID: this.sessionId,
                peerID: this.outgoingId,
                timeSent,
            })
            const body = assign(new VerifyConnect(), {
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

            this.send(header, body)
        
        } else {
        
            if(request.body instanceof VerifyConnect){
                this.sessionId = request.header.sessionID //TODO:
                this.outgoingId = request.body.outgoingPeerID
            }

            if((request.body.flags & ProtocolFlag.ACKNOWLEDGE) != 0){
                
                console.assert(request.header.timeSent !== null, 'Assertion failed: request.header.timeSent is null')

                const channel = this.channels_get(request.body.channelID)
                const header = assign(new ProtocolHeader(), {
                    sessionID: this.sessionId,
                    peerID: this.outgoingId,
                    timeSent: null,
                })
                const body = assign(new Acknowledge(), {
                    flags: ProtocolFlag.NONE,
                    channelID: channel.id,
                    reliableSequenceNumber: channel.reliableSequenceNumber,
                    receivedReliableSequenceNumber: request.body.reliableSequenceNumber,
                    receivedSentTime: request.header.timeSent!,
                    //command: 1,
                    //size: 8,
                })

                this.send(header, body)
            }
        }

        return request
    }

    public sendUnreliable(channelID: number, data: Buffer){
        const channel = this.channels_get(channelID)
        const reliableSequenceNumber = channel.reliableSequenceNumber
        const unreliableSequenceNumber = ++channel.unreliableSequenceNumber
        const header = Object.assign(new ProtocolHeader(), {
            sessionID: this.sessionId,
            peerID: this.outgoingId,
            timeSent: null,
        })
        const body = Object.assign(new SendUnreliable(), {
            flags: 0,
            channelID: channelID,
            reliableSequenceNumber,
            unreliableSequenceNumber,
            dataLength: data.length,
            //command: 7,
            //size: 8,
        })
        const buffer = this.writePacket(header, body, data)
        return this.onsend(buffer)
    }

    public sendReliable(channelID: number, data: Buffer){
        const channel = this.channels_get(channelID)
        const timeSent = Date.now() - this.startTime
        const reliableSequenceNumber = ++channel.reliableSequenceNumber
        const header = Object.assign(new ProtocolHeader(), {
            sessionID: this.sessionId,
            peerID: this.outgoingId,
            timeSent,
        })
        const body = Object.assign(new SendReliable(), {
            flags: ProtocolFlag.ACKNOWLEDGE,
            channelID: channelID,
            reliableSequenceNumber,
            dataLength: data.length,
            //command: 6,
            //size: 6,
        })
        const buffer = this.writePacket(header, body, data)
        return this.onsend(buffer)
    }

    readPacket(buffer: Buffer){
        const reader = new Reader(buffer)
        const header = ProtocolHeader.create(reader, version)
        const body = header ? Protocol.create(reader, version) : null
        const data = (body instanceof Send) ? reader.readBytes(body.dataLength) : null

        if(!header || !body){
            console.log('ERROR: !header || !body')
            return
        }
        
        console.assert(!(body instanceof SendFragment), 'Assertion failed: requestBody instanceof SendFragment')

        const message = { header, body, data }
        if(body instanceof Ping) console.log(this.name, 'read', 'ping')
        else if(body instanceof Acknowledge) console.log(this.name, 'read', 'ack')
        else console.log(this.name, 'read', message)

        console.assert(reader.position === buffer.length, `Assertion failed: reader.position (${reader.position}) != buffer.length (${buffer.length})`)

        return message
    }

    writePacket(header: ProtocolHeader, body: Protocol, data: Buffer | null = null){
        let header_size = version.maxHeaderSizeSend
        if(header.timeSent === null) header_size -= 2

        const dataLength = data?.length ?? 0
        const dataLengthInPacket = (body instanceof Send) ? body.dataLength : 0
        console.assert(dataLength === dataLengthInPacket, `Assertion failed: dataLength (${dataLength}) != dataLengthInPacket (${dataLengthInPacket})`)

        const buffer = Buffer.alloc(header_size + body.size + dataLength)
        const writer = new Writer(buffer)
        header.write(writer, version)
        body.write(writer, version)
        if(data) writer.writeBytes(data)

        const message = { header, body, data }
        if(body instanceof Ping) console.log(this.name, 'write', 'ping')
        else if(body instanceof Acknowledge) console.log(this.name, 'write', 'ack')
        else console.log(this.name, 'write', message)

        return buffer
    }
}