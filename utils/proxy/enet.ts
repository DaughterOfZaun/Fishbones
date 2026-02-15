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

const funcs = function(){
const buffer = Buffer.from([])
return {
    BE: {
        readInt8: buffer.readInt8,
        readInt16: buffer.readInt16BE,
        readInt32: buffer.readInt32BE,
        readBigInt64: buffer.readBigInt64BE,

        readUInt8: buffer.readUInt8,
        readUInt16: buffer.readUInt16BE,
        readUInt32: buffer.readUInt32BE,
        readBigUInt64: buffer.readBigUInt64BE,
        readFloat: buffer.readFloatBE,
        
        writeInt8: buffer.writeInt8,
        writeInt16: buffer.writeInt16BE,
        writeInt32: buffer.writeInt32BE,
        writeBigInt64: buffer.writeBigInt64BE,

        writeUInt8: buffer.writeUInt8,
        writeUInt16: buffer.writeUInt16BE,
        writeUInt32: buffer.writeUInt32BE,
        writeBigUInt64: buffer.writeBigUInt64BE,
        writeFloat: buffer.writeFloatBE,
    },
    LE: {
        readInt8: buffer.readInt8,
        readInt16: buffer.readInt16LE,
        readInt32: buffer.readInt32LE,
        readBigInt64: buffer.readBigInt64LE,

        readUInt8: buffer.readUInt8,
        readUInt16: buffer.readUInt16LE,
        readUInt32: buffer.readUInt32LE,
        readBigUInt64: buffer.readBigUInt64LE,
        readFloat: buffer.readFloatLE,

        writeInt8: buffer.writeInt8,
        writeInt16: buffer.writeInt16LE,
        writeInt32: buffer.writeInt32LE,
        writeBigInt64: buffer.writeBigInt64LE,

        writeUInt8: buffer.writeUInt8,
        writeUInt16: buffer.writeUInt16LE,
        writeUInt32: buffer.writeUInt32LE,
        writeBigUInt64: buffer.writeBigUInt64LE,
        writeFloat: buffer.writeFloatLE,
    }
}
}()

export class Reader {

    public position = 0
    public get bytesLeft(){ return this.buffer.length - this.position }
    
    private readonly funcs: any
    
    constructor(
        public readonly buffer: Buffer,
        public readonly endianness: 'BE'|'LE' = 'BE',
        public readonly debug?: boolean,
    ){
        this.funcs = funcs[endianness]
    }

    public readBool(name?: string){
        return this.readByte(name) != 0
    }
    public readSByte(name?: string){
        if(this.debug) console.log('readByte', name, this.buffer.subarray(this.position, this.position + 1))
        const result = this.funcs.readInt8.call(this.buffer, this.position);
        this.position += 1;
        return result
    }
    public readByte(name?: string){
        if(this.debug) console.log('readByte', name, this.buffer.subarray(this.position, this.position + 1))
        const result = this.funcs.readUInt8.call(this.buffer, this.position);
        this.position += 1;
        return result
    }
    public readInt16(name?: string){
        if(this.debug) console.log('readInt16', name, this.buffer.subarray(this.position, this.position + 2))
        const result = this.funcs.readInt16.call(this.buffer, this.position);
        this.position += 2;
        return result
    }
    public readUInt16(name?: string){
        if(this.debug) console.log('readUInt16', name, this.buffer.subarray(this.position, this.position + 2))
        const result = this.funcs.readUInt16.call(this.buffer, this.position);
        this.position += 2;
        return result
    }
    public readInt32(name?: string){
        if(this.debug) console.log('readUInt32', name, this.buffer.subarray(this.position, this.position + 4))
        const result = this.funcs.readInt32.call(this.buffer, this.position);
        this.position += 4;
        return result
    }
    public readUInt32(name?: string){
        if(this.debug) console.log('readUInt32', name, this.buffer.subarray(this.position, this.position + 4))
        const result = this.funcs.readUInt32.call(this.buffer, this.position);
        this.position += 4;
        return result
    }
    public readInt64(name?: string){
        if(this.debug) console.log('readUInt64', name, this.buffer.subarray(this.position, this.position + 8))
        const result = this.funcs.readBigInt64.call(this.buffer, this.position);
        this.position += 8;
        return result
    }
    public readUInt64(name?: string){
        if(this.debug) console.log('readUInt64', name, this.buffer.subarray(this.position, this.position + 8))
        const result = this.funcs.readBigUInt64.call(this.buffer, this.position);
        this.position += 8;
        return result
    }
    public readFloat(name?: string){
        if(this.debug) console.log('readFloat', name, this.buffer.subarray(this.position, this.position + 4))
        const result = this.funcs.readFloat.call(this.buffer, this.position);
        this.position += 4;
        return result
    }
    public readBytes(count: number, name?: string){
        if(this.debug) console.log('readBytes', name, this.buffer.subarray(this.position, this.position + count))
        console.assert(this.position + count <= this.buffer.length, `Assertion failed: this.position (${this.position}) + count (${count}) <= this.buffer.length (${this.buffer.length})`)
        const result = this.buffer.subarray(this.position, this.position + count)
        this.position += result.length
        return result
    }
    public readFixedString(length: number){
        const zeroIndex = this.buffer.indexOf(0, this.position)
        console.assert(zeroIndex <= this.position + length, `Assertion failed: zeroIndex (${zeroIndex}) <= this.position (${this.position}) + length (${length})`)
        console.assert(zeroIndex !== -1, `Assertion failed: buffer.indexOf(0) == -1`)
        const buffer = this.buffer.subarray(this.position, zeroIndex)
        this.position += length
        return buffer.toString('utf8')
    }
    public readString(){
        const zeroIndex = this.buffer.indexOf(0, this.position)
        console.assert(zeroIndex !== -1, `Assertion failed: buffer.indexOf(0) == -1`)
        const buffer = this.buffer.subarray(this.position, zeroIndex)
        this.position += buffer.length
        return buffer.toString('utf8')
    }
}

export class Writer {

    public position = 0

    private readonly funcs: any

    constructor(
        public readonly buffer: Buffer,
        public readonly endianness: 'BE'|'LE' = 'BE',
        public readonly debug?: boolean,
    ){
        this.funcs = funcs[endianness]
    }

    public writeBool(value: boolean){
        return this.writeByte(+value)
    }
    public writeSByte(value: number){
        const result = this.funcs.writeInt8.call(this.buffer, value, this.position);
        this.position += 1;
        return result
    }
    public writeByte(value: number, name?: string){
        const result = this.funcs.writeUInt8.call(this.buffer, value, this.position);
        if(this.debug) console.log('writeByte', name, this.buffer.subarray(this.position, this.position + 1).toString('hex'))
        this.position += 1;
        return result
    }
    public writeInt16(value: number, name?: string){
        const result = this.funcs.writeInt16.call(this.buffer, value, this.position);
        if(this.debug) console.log('writeUInt16', name, this.buffer.subarray(this.position, this.position + 2).toString('hex'))
        this.position += 2;
        return result
    }
    public writeUInt16(value: number, name?: string){
        const result = this.funcs.writeUInt16.call(this.buffer, value, this.position);
        if(this.debug) console.log('writeUInt16', name, this.buffer.subarray(this.position, this.position + 2).toString('hex'))
        this.position += 2;
        return result
    }
    public writeInt32(value: number){
        const result = this.funcs.writeInt32.call(this.buffer, value, this.position);
        this.position += 4;
        return result
    }
    public writeUInt32(value: number, name?: string){
        const result = this.funcs.writeUInt32.call(this.buffer, value, this.position);
        if(this.debug) console.log('writeUInt32', name, this.buffer.subarray(this.position, this.position + 4).toString('hex'))
        this.position += 4;
        return result
    }
    public writeInt64(value: bigint){
        const result = this.funcs.writeBigInt64.call(this.buffer, value, this.position);
        this.position += 8;
        return result
    }
    public writeUInt64(value: bigint){
        const result = this.funcs.writeBigUInt64.call(this.buffer, value, this.position);
        this.position += 8;
        return result
    }
    public writeFloat(value: number){
        const result = this.funcs.writeFloat.call(this.buffer, value, this.position);
        this.position += 4;
        return result
    }
    public writePad(count: number, name?: string){
        if(count % 1 != 0) throw new Error()
        const result = this.buffer.fill(0, this.position, this.position + count, 'binary')
        if(this.debug) console.log('writePad', name, this.buffer.subarray(this.position, this.position + count).toString('hex'))
        this.position += count
        return result
    }
    public writeBytes(data: Buffer){
        const result = this.buffer.set(data, this.position)
        this.position += data.length
        return result
    }
    public writeFixedString(length: number, data: string){
        if(length % 1 != 0) throw new Error()
        console.assert(length >= data.length + 1, `Assertion failed: length (${length}) <= data.length (${ data.length }) + 1`)
        const result = this.buffer.write(data + '\u0000', this.position, 'utf8')
        this.position += length
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
