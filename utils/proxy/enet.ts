export enum ProtocolFlag
{
    NONE = 0,
    ACKNOWLEDGE = 1 << 7,
    UNSEQUENCED = 1 << 6,
}

export enum ProtocolCommand
{
    NONE = 0x00,
    ACKNOWLEDGE = 0x01,
    CONNECT = 0x02,
    VERIFY_CONNECT = 0x03,
    DISCONNECT = 0x04,
    PING = 0x05,
    SEND_RELIABLE = 0x06,
    SEND_UNRELIABLE = 0x07,
    SEND_FRAGMENT = 0x08,
    SEND_UNSEQUENCED = 0x09,
    BANDWIDTH_LIMIT = 0x0A,
    THROTTLE_CONFIGURE = 0x0B,
}

export class Version
{
    public readonly maxPeerID: number
    public readonly checksumSizeSend: number
    public readonly checksumSizeReceive: number
    public readonly bandwidthThrottleInterval: number
    public readonly packetLossInterval: number
    private readonly maxHeaderSizeBase: number
    public get maxHeaderSizeSend(){ return this.checksumSizeSend + this.maxHeaderSizeBase }
    public get maxHeaderSizeReceive(){ return this.checksumSizeReceive + this.maxHeaderSizeBase }

    public static Season12 = new Version(0x7FFF, 0, 0, 8, 1000, 10000)
    public static Season34 = new Version(0x7F, 0, 0, 4, 0xFFFFFFFF, 0xFFFFFFFF)
    public static Patch420 = new Version(0x7F, 4, 4, 4, 0xFFFFFFFF, 0xFFFFFFFF)
    public static Season8_Client = new Version(0x7F, 8, 0, 4, 0xFFFFFFFF, 0xFFFFFFFF)
    public static Season8_Server = new Version(0x7F, 0, 8, 4, 0xFFFFFFFF, 0xFFFFFFFF)

    private constructor(maxPeerID: number, checksumSizeSend: number, checksumSizeReceive: number, maxHeaderSizeBase: number, bandwidthThrottleInterval: number, packetLossInterval: number)
    {
        this.maxPeerID = maxPeerID
        this.checksumSizeSend = checksumSizeSend
        this.checksumSizeReceive = checksumSizeReceive
        this.maxHeaderSizeBase = maxHeaderSizeBase
        this.bandwidthThrottleInterval = bandwidthThrottleInterval
        this.packetLossInterval = packetLossInterval
    }
}

export class Reader {
    public position = 0
    public get bytesLeft(){ return this.buffer.length - this.position }
    constructor(
        public readonly buffer: Buffer
    ){}

    public readByte(){
        const result = this.buffer.readUInt8(this.position);
        this.position += 1;
        return result
    }
    public readUInt16(){
        const result = this.buffer.readUInt16BE(this.position);
        this.position += 2;
        return result
    }
    public readUInt32(){
        const result = this.buffer.readUInt32BE(this.position);
        this.position += 4;
        return result
    }
    public readBytes(count: number){
        console.assert(this.position + count <= this.buffer.length, `Assertion failed: this.position (${this.position}) + count (${count}) <= this.buffer.length (${this.buffer.length})`)
        const result = this.buffer.subarray(this.position, this.position + count)
        this.position += result.length
        return result
    }
}

export class Writer {
    public position = 0
    constructor(
        private readonly buffer: Buffer
    ){}

    public writeByte(value: number){ const result = this.buffer.writeUInt8(value & 0xFF, this.position); this.position += 1; return result }
    public writeUInt16(value: number){ const result = this.buffer.writeUInt16BE(value & 0xFFFF, this.position); this.position += 2; return result }
    public writeUInt32(value: number){ const result = this.buffer.writeUInt32BE(value & 0xFFFFFFFF, this.position); this.position += 4; return result }
    public writeBytes(data: Buffer){
        const result = this.buffer.set(data, this.position)
        this.position += data.length
        return result
    }
}

export class ProtocolHeader
{
    public sessionID: number = 0
    public peerID: number = 0
    public timeSent: number | null = null

    public static create(reader: Reader, version: Version)
    {
        const result = new ProtocolHeader()

        if(reader.bytesLeft < (version.maxHeaderSizeReceive - 2)){
            console.log(`ERROR: reader.bytesLeft (${reader.bytesLeft}) < (version.maxHeaderSizeReceive (${ version.maxHeaderSizeReceive }) - 2)`)
            console.log(`ERROR: reader.buffer.length (${reader.buffer.length}) - reader.position (${reader.position})`)
            console.log(`ERROR:`, reader.buffer)
            return null
        }

        reader.position += version.checksumSizeReceive

        let hasSentTime = false

        if(version.maxPeerID > 0x7F){
            result.sessionID = reader.readUInt32()
            const peerID = reader.readUInt16()
            if((peerID & 0x8000) != 0){
                hasSentTime = true
            }
            result.peerID = peerID & 0x7FFF
        } else {
            result.sessionID = reader.readByte()
            const peerID = reader.readByte()
            if((peerID & 0x80) != 0){
                hasSentTime = true
            }
            result.peerID = peerID & 0x7F
        }

        if(hasSentTime){
            if(reader.bytesLeft < 2){
                console.log('ERROR: reader.bytesLeft < 2')
                return null
            }
            result.timeSent = reader.readUInt16()
        }

        return result
    }

    public write(writer: Writer, version: Version){
        writer.position += version.checksumSizeSend

        if(version.maxPeerID > 0x7F){
            writer.writeUInt32(this.sessionID)
            const peerID = this.peerID | (this.timeSent != null ? 0x8000 : 0)
            writer.writeUInt16(peerID)
        } else {
            writer.writeByte(this.sessionID)
            const peerID = this.peerID | (this.timeSent != null ? 0x80 : 0)
            writer.writeByte(peerID)
        }

        if(this.timeSent != null){
            writer.writeUInt16(this.timeSent)
        }
    }
}

export abstract class Protocol
{
    public flags!: ProtocolFlag
    public channelID!: number
    public reliableSequenceNumber!: number
    public abstract size: number
    public abstract command: ProtocolCommand

    protected abstract readInternal(reader: Reader, version: Version): void
    protected abstract writeInternal(writer: Writer, version: Version): void

    public static create(reader: Reader, version: Version): Protocol | null
    {
        const BASE_SIZE = 4

        if(BASE_SIZE > reader.bytesLeft){
            console.log('ERROR: BASE_SIZE > reader.bytesLeft')
            return null
        }

        const commandFlags = reader.readByte()
        const channel = reader.readByte()
        const reliableSequenceNumber = reader.readUInt16()

        let result: Protocol | null
        switch((commandFlags & 0x0F) as ProtocolCommand){
            case ProtocolCommand.NONE: result = null; break
            case ProtocolCommand.ACKNOWLEDGE: result = new Acknowledge(); break
            case ProtocolCommand.CONNECT: result = new Connect(); break
            case ProtocolCommand.VERIFY_CONNECT: result = new VerifyConnect(); break
            case ProtocolCommand.DISCONNECT: result = new Disconnect(); break
            case ProtocolCommand.PING: result = new Ping(); break
            case ProtocolCommand.SEND_FRAGMENT: result = new SendFragment(); break
            case ProtocolCommand.SEND_RELIABLE: result = new SendReliable(); break
            case ProtocolCommand.SEND_UNRELIABLE: result = new SendUnreliable(); break
            case ProtocolCommand.SEND_UNSEQUENCED: result = new SendUnsequenced(); break
            case ProtocolCommand.BANDWIDTH_LIMIT: result = new BandwidthLimit(); break
            case ProtocolCommand.THROTTLE_CONFIGURE: result = new ThrottleConfigure(); break
            default: result = null; break
        }

        if(result == null || (result.size - BASE_SIZE) > reader.bytesLeft){
            console.log('ERROR: result == null || (result.size - BASE_SIZE) > reader.bytesLeft')
            return null
        }

        result.channelID = channel
        result.flags = (commandFlags & 0xF0) as ProtocolFlag
        result.reliableSequenceNumber = reliableSequenceNumber
        result.readInternal(reader, version)

        return result
    }

    public write(writer: Writer, version: Version){
        writer.writeByte(this.flags | this.command)
        writer.writeByte(this.channelID)
        writer.writeUInt16(this.reliableSequenceNumber)
        this.writeInternal(writer, version)
    }
}

export class Acknowledge extends Protocol
{
    public receivedReliableSequenceNumber!: number
    public receivedSentTime!: number
    public override readonly size = 4 + 4
    public override readonly command = ProtocolCommand.ACKNOWLEDGE

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected override readInternal(reader: Reader, version: Version){
        this.receivedReliableSequenceNumber = reader.readUInt16()
        this.receivedSentTime = reader.readUInt16()
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected override writeInternal(writer: Writer, version: Version){
        writer.writeUInt16(this.receivedReliableSequenceNumber)
        writer.writeUInt16(this.receivedSentTime)
    }
}

export class Connect extends Protocol
{
    public outgoingPeerID!: number
    public mtu!: number
    public windowSize!: number
    public channelCount!: number
    public incomingBandwidth!: number
    public outgoingBandwidth!: number
    public packetThrottleInterval!: number
    public packetThrottleAcceleration!: number
    public packetThrottleDeceleration!: number
    public sessionID!: number

    public override readonly size = 4 + 36
    public override readonly command = ProtocolCommand.CONNECT

    protected override readInternal(reader: Reader, version: Version){
        if(version.maxPeerID > 0x7F){
            this.outgoingPeerID = reader.readUInt16()
        } else {
            this.outgoingPeerID = reader.readByte()
            reader.position += 1
        }

        this.mtu = reader.readUInt16()
        this.windowSize = reader.readUInt32()
        this.channelCount = reader.readUInt32()
        this.incomingBandwidth = reader.readUInt32()
        this.outgoingBandwidth = reader.readUInt32()
        this.packetThrottleInterval = reader.readUInt32()
        this.packetThrottleAcceleration = reader.readUInt32()
        this.packetThrottleDeceleration = reader.readUInt32()

        if(version.maxPeerID > 0x7F){
            this.sessionID = reader.readUInt32()
        } else {
            this.sessionID = reader.readByte()
            reader.position += 3
        }
    }

    protected override writeInternal(writer: Writer, version: Version){
        if(version.maxPeerID > 0x7F){
            writer.writeUInt16(this.outgoingPeerID)
        } else {
            writer.writeByte(this.outgoingPeerID)
            writer.position += 1
        }

        writer.writeUInt16(this.mtu)
        writer.writeUInt32(this.windowSize)
        writer.writeUInt32(this.channelCount)
        writer.writeUInt32(this.incomingBandwidth)
        writer.writeUInt32(this.outgoingBandwidth)
        writer.writeUInt32(this.packetThrottleInterval)
        writer.writeUInt32(this.packetThrottleAcceleration)
        writer.writeUInt32(this.packetThrottleDeceleration)

        if(version.maxPeerID > 0x7F){
            writer.writeUInt32(this.sessionID)
        } else {
            writer.writeByte(this.sessionID)
            writer.position += 3
        }
    }
}

export class VerifyConnect extends Protocol
{
    public outgoingPeerID!: number
    public mtu!: number
    public windowSize!: number
    public channelCount!: number
    public incomingBandwidth!: number
    public outgoingBandwidth!: number
    public packetThrottleInterval!: number
    public packetThrottleAcceleration!: number
    public packetThrottleDeceleration!: number

    public override readonly size = 4 + 32
    public override readonly command = ProtocolCommand.VERIFY_CONNECT

    protected override readInternal(reader: Reader, version: Version){
        if(version.maxPeerID > 0x7F){
            this.outgoingPeerID = reader.readUInt16()
        } else {
            this.outgoingPeerID = reader.readByte()
            reader.position += 1
        }
        this.mtu = reader.readUInt16()
        this.windowSize = reader.readUInt32()
        this.channelCount = reader.readUInt32()
        this.incomingBandwidth = reader.readUInt32()
        this.outgoingBandwidth = reader.readUInt32()
        this.packetThrottleInterval = reader.readUInt32()
        this.packetThrottleAcceleration = reader.readUInt32()
        this.packetThrottleDeceleration = reader.readUInt32()
    }

    protected override writeInternal(writer: Writer, version: Version){
        if(version.maxPeerID > 0x7F){
            writer.writeUInt16(this.outgoingPeerID)
        } else {
            writer.writeByte(this.outgoingPeerID)
            writer.position += 1
        }
        writer.writeUInt16(this.mtu)
        writer.writeUInt32(this.windowSize)
        writer.writeUInt32(this.channelCount)
        writer.writeUInt32(this.incomingBandwidth)
        writer.writeUInt32(this.outgoingBandwidth)
        writer.writeUInt32(this.packetThrottleInterval)
        writer.writeUInt32(this.packetThrottleAcceleration)
        writer.writeUInt32(this.packetThrottleDeceleration)
    }
}

export class BandwidthLimit extends Protocol
{
    public incomingBandwidth!: number
    public outgoingBandwidth!: number

    public override readonly size = 4 + 8
    public override readonly command = ProtocolCommand.BANDWIDTH_LIMIT

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected override readInternal(reader: Reader, version: Version){
        this.incomingBandwidth = reader.readUInt32()
        this.outgoingBandwidth = reader.readUInt32()
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected override writeInternal(writer: Writer, version: Version){
        writer.writeUInt32(this.incomingBandwidth)
        writer.writeUInt32(this.outgoingBandwidth)
    }
}

export class ThrottleConfigure extends Protocol
{
    public packetThrottleInterval!: number
    public packetThrottleAcceleration!: number
    public packetThrottleDeceleration!: number

    public override readonly size = 4 + 12
    public override readonly command = ProtocolCommand.THROTTLE_CONFIGURE

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected override readInternal(reader: Reader, version: Version){
        this.packetThrottleInterval = reader.readUInt32()
        this.packetThrottleAcceleration = reader.readUInt32()
        this.packetThrottleDeceleration = reader.readUInt32()
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected override writeInternal(writer: Writer, version: Version){
        writer.writeUInt32(this.packetThrottleInterval)
        writer.writeUInt32(this.packetThrottleAcceleration)
        writer.writeUInt32(this.packetThrottleDeceleration)
    }
}

export class Disconnect extends Protocol
{
    public data!: number

    public override readonly size = 4 + 4
    public override readonly command = ProtocolCommand.DISCONNECT

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected override readInternal(reader: Reader, version: Version){
        this.data = reader.readUInt32()
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected override writeInternal(writer: Writer, version: Version){
        writer.writeUInt32(this.data)
    }
}

export class Ping extends Protocol
{
    public override readonly size = 4 + 0
    public override readonly command = ProtocolCommand.PING

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected override readInternal(reader: Reader, version: Version){}

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected override writeInternal(writer: Writer, version: Version){}
}

//// eslint-disable-next-line @typescript-eslint/no-unused-vars
export class None extends Protocol
{
    public override readonly size = 4 + 0
    public override readonly command = ProtocolCommand.NONE

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected override readInternal(reader: Reader, version: Version){}

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected override writeInternal(writer: Writer, version: Version){}
}

export abstract class Send extends Protocol
{
    public abstract data: Buffer
}

export class SendReliable extends Send
{
    public override data!: Buffer

    public override readonly size = 4 + 2
    public override readonly command = ProtocolCommand.SEND_RELIABLE

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected override readInternal(reader: Reader, version: Version){
        const dataLength = reader.readUInt16()
        this.data = reader.readBytes(dataLength)
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected override writeInternal(writer: Writer, version: Version){
        writer.writeUInt16(this.data.length)
        writer.writeBytes(this.data)
    }
}

export class SendUnreliable extends Send
{
    public unreliableSequenceNumber!: number
    public data!: Buffer

    public override readonly size = 4 + 4
    public override readonly command = ProtocolCommand.SEND_UNRELIABLE

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected override readInternal(reader: Reader, version: Version){
        this.unreliableSequenceNumber = reader.readUInt16()
        const dataLength = reader.readUInt16()
        this.data = reader.readBytes(dataLength)
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected override writeInternal(writer: Writer, version: Version){
        writer.writeUInt16(this.unreliableSequenceNumber)
        writer.writeUInt16(this.data.length)
        writer.writeBytes(this.data)
    }
}

//TODO: Merge SendUnsequenced with SendUnreliable.
export class SendUnsequenced extends Send
{
    public unsequencedGroup!: number
    public data!: Buffer

    public override readonly size = 4 + 4
    public override readonly command = ProtocolCommand.SEND_UNSEQUENCED

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected override readInternal(reader: Reader, version: Version){
        this.unsequencedGroup = reader.readUInt16()
        const dataLength = reader.readUInt16()
        this.data = reader.readBytes(dataLength)
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected override writeInternal(writer: Writer, version: Version){
        writer.writeUInt16(this.unsequencedGroup)
        writer.writeUInt16(this.data.length)
        writer.writeBytes(this.data)
    }
}

export class SendFragment extends Send
{
    public startSequenceNumber!: number
    public fragmentCount!: number
    public fragmentNumber!: number
    public totalLength!: number
    public fragmentOffset!: number

    public data!: Buffer

    public override readonly size = 4 + 20
    public override readonly command = ProtocolCommand.SEND_FRAGMENT

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected override readInternal(reader: Reader, version: Version){
        this.startSequenceNumber = reader.readUInt16()
        const dataLength = reader.readUInt16()
        this.fragmentCount = reader.readUInt32()
        this.fragmentNumber = reader.readUInt32()
        this.totalLength = reader.readUInt32()
        this.fragmentOffset = reader.readUInt32()
        this.data = reader.readBytes(dataLength)
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected override writeInternal(writer: Writer, version: Version){
        writer.writeUInt16(this.startSequenceNumber)
        writer.writeUInt16(this.data.length)
        writer.writeUInt32(this.fragmentCount)
        writer.writeUInt32(this.fragmentNumber)
        writer.writeUInt32(this.totalLength)
        writer.writeUInt32(this.fragmentOffset)
        writer.writeBytes(this.data)
    }
}
