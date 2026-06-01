export const is64Bit = ['arm64', 'ppc64', 'x64', 's390x'].includes(process.arch)
export const bits = is64Bit ? 64 : 32
export const sizeof = {
    ptr_t: bits / 8,
    size_t: bits / 8,
    uint64: 64 / 8,
    uint32: 32 / 8,
    uint16: 16 / 8,
    uint8: 8 / 8,
    int: 32 / 8,
}

export function bytesToUInt32(bytes: Record<number, number>){
    return 0
        | bytes[3]! << 8 * 0
        | bytes[2]! << 8 * 1
        | bytes[1]! << 8 * 2
        | bytes[0]! << 8 * 3
}

export function uInt32ToBytes(num: number){
    return [
        (num >> 8 * 3) & 0xFF,
        (num >> 8 * 2) & 0xFF,
        (num >> 8 * 1) & 0xFF,
        (num >> 8 * 0) & 0xFF,
    ]
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

    public readBool(name?: string): boolean {
        return this.readByte(name) != 0
    }
    public readSByte(name?: string): number {
        if(this.debug) console.log('readByte', name, this.buffer.subarray(this.position, this.position + 1))
        const result = this.funcs.readInt8.call(this.buffer, this.position);
        this.position += 1;
        return result
    }
    public readByte(name?: string): number {
        if(this.debug) console.log('readByte', name, this.buffer.subarray(this.position, this.position + 1))
        const result = this.funcs.readUInt8.call(this.buffer, this.position);
        this.position += 1;
        return result
    }
    public readInt16(name?: string): number {
        if(this.debug) console.log('readInt16', name, this.buffer.subarray(this.position, this.position + 2))
        const result = this.funcs.readInt16.call(this.buffer, this.position);
        this.position += 2;
        return result
    }
    public readUInt16(name?: string): number {
        if(this.debug) console.log('readUInt16', name, this.buffer.subarray(this.position, this.position + 2))
        const result = this.funcs.readUInt16.call(this.buffer, this.position);
        this.position += 2;
        return result
    }
    public readInt32(name?: string): number {
        if(this.debug) console.log('readUInt32', name, this.buffer.subarray(this.position, this.position + 4))
        const result = this.funcs.readInt32.call(this.buffer, this.position);
        this.position += 4;
        return result
    }
    public readUInt32(name?: string): number {
        if(this.debug) console.log('readUInt32', name, this.buffer.subarray(this.position, this.position + 4))
        const result = this.funcs.readUInt32.call(this.buffer, this.position);
        this.position += 4;
        return result
    }
    public readInt64(name?: string): bigint {
        if(this.debug) console.log('readUInt64', name, this.buffer.subarray(this.position, this.position + 8))
        const result = this.funcs.readBigInt64.call(this.buffer, this.position);
        this.position += 8;
        return result
    }
    public readUInt64(name?: string): bigint {
        if(this.debug) console.log('readUInt64', name, this.buffer.subarray(this.position, this.position + 8))
        const result = this.funcs.readBigUInt64.call(this.buffer, this.position);
        this.position += 8;
        return result
    }
    public readFloat(name?: string): number {
        if(this.debug) console.log('readFloat', name, this.buffer.subarray(this.position, this.position + 4))
        const result = this.funcs.readFloat.call(this.buffer, this.position);
        this.position += 4;
        return result
    }
    public readBytes(count: number, name?: string): Buffer {
        if(this.debug) console.log('readBytes', name, this.buffer.subarray(this.position, this.position + count))
        console.assert(this.position + count <= this.buffer.length, `Assertion failed: this.position (${this.position}) + count (${count}) <= this.buffer.length (${this.buffer.length})`)
        const result = this.buffer.subarray(this.position, this.position + count)
        this.position += result.length
        return result
    }
    public readFixedString(length: number, name?: string): string {
        if(this.debug) console.log('readFixedString', name, this.buffer.subarray(this.position, this.position + length))
        const zeroIndex = this.buffer.indexOf(0, this.position)
        console.assert(zeroIndex <= this.position + length, `Assertion failed: zeroIndex (${zeroIndex}) <= this.position (${this.position}) + length (${length})`)
        console.assert(zeroIndex !== -1, `Assertion failed: buffer.indexOf(0) == -1`)
        const buffer = this.buffer.subarray(this.position, zeroIndex)
        this.position += length
        return buffer.toString('utf8')
    }
    public readString(name?: string): string {
        const zeroIndex = this.buffer.indexOf(0, this.position)
        console.assert(zeroIndex !== -1, `Assertion failed: buffer.indexOf(0) == -1`)
        const buffer = this.buffer.subarray(this.position, zeroIndex)
        this.position += buffer.length + 1
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

    public writeBool(value: boolean, name?: string){
        return this.writeByte(+value, name)
    }
    public writeSByte(value: number, name?: string){
        const result = this.funcs.writeInt8.call(this.buffer, value, this.position);
        if(this.debug) console.log('writeSByte', name, this.buffer.subarray(this.position, this.position + 1).toString('hex'))
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
        if(this.debug) console.log('writeInt16', name, this.buffer.subarray(this.position, this.position + 2).toString('hex'))
        this.position += 2;
        return result
    }
    public writeUInt16(value: number, name?: string){
        const result = this.funcs.writeUInt16.call(this.buffer, value, this.position);
        if(this.debug) console.log('writeUInt16', name, this.buffer.subarray(this.position, this.position + 2).toString('hex'))
        this.position += 2;
        return result
    }
    public writeInt32(value: number, name?: string){
        const result = this.funcs.writeInt32.call(this.buffer, value, this.position);
        if(this.debug) console.log('writeInt32', name, this.buffer.subarray(this.position, this.position + 4).toString('hex'))
        this.position += 4;
        return result
    }
    public writeUInt32(value: number, name?: string){
        const result = this.funcs.writeUInt32.call(this.buffer, value, this.position);
        if(this.debug) console.log('writeUInt32', name, this.buffer.subarray(this.position, this.position + 4).toString('hex'))
        this.position += 4;
        return result
    }
    public writeInt64(value: bigint | number){
        const result = this.funcs.writeBigInt64.call(this.buffer, BigInt(value), this.position);
        this.position += 8;
        return result
    }
    public writeUInt64(value: bigint | number, name?: string){
        const result = this.funcs.writeBigUInt64.call(this.buffer, BigInt(value), this.position);
        if(this.debug) console.log('writeUInt64', name, this.buffer.subarray(this.position, this.position + 8).toString('hex'))
        this.position += 8;
        return result
    }
    public writeFloat(value: number, name?: string){
        const result = this.funcs.writeFloat.call(this.buffer, value, this.position);
        if(this.debug) console.log('writeFloat', name, this.buffer.subarray(this.position, this.position + 4).toString('hex'))
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
    public writeFixedString(length: number, data: string, name?: string){
        if(length % 1 != 0) throw new Error()
        console.assert(length >= data.length + 1, `Assertion failed: length (${length}) <= data.length (${ data.length }) + 1`)
        const result = this.buffer.write(data + '\u0000', this.position, 'utf8')
        if(this.debug) console.log('writeFixedString', name, this.buffer.subarray(this.position, this.position + length).toString('hex'))
        this.position += length
        return result
    }
    public writeString(data: string, name?: string){
        const length = data.length + 1
        const result = this.buffer.write(data + '\u0000', this.position, 'utf8')
        if(this.debug) console.log('writeFixedString', name, this.buffer.subarray(this.position, this.position + length).toString('hex'))
        this.position += length
        return result
    }
}
