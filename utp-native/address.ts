import { read, type Pointer } from 'bun:ffi'
import os from 'node:os'

enum AddressFamily {
    INET = 2,
    INET6 = 10,
}

type BELE = 'BE' | 'LE'
const BELE: BELE = os.endianness()
Buffer.prototype.writeUint16 = Buffer.prototype[`writeUint16${BELE}`]
Buffer.prototype.writeUint32 = Buffer.prototype[`writeUint32${BELE}`]
type BufferType = ReturnType<(typeof Buffer<ArrayBuffer>)['alloc']>
declare global {
    interface Buffer {
        writeUint16: BufferType[`writeUint16${BELE}`]
        writeUint32: BufferType[`writeUint32${BELE}`]
    }
}

export class UTPAddress {
    public constructor(
        public readonly family: AddressFamily,
        public readonly host: string,
        public readonly port: number,
    ){}
    private buf?: Buffer
    public get buffer(){
        let { buf } = this
        if(buf !== undefined){
            return buf
        }
        const { family, host, port } = this
        switch(family){
            case AddressFamily.INET: {
                this.buf = buf = Buffer.allocUnsafe(16)
                buf.writeUint16(AddressFamily.INET, 0)
                buf.writeUint16BE(port, 2)
                const parts = host.split('.')
                for(let i = 0; i < 4; i++){
                    buf.writeUint8(parseInt(parts[i] || '0'), 4 + i)
                }
                //buf.writeUint32(0,  8) // pad
                //buf.writeUint32(0, 12) // pad
                return buf //break;
            }
            case AddressFamily.INET6: {
                this.buf = buf = Buffer.allocUnsafe(28)
                buf.writeUint16(AddressFamily.INET6, 0)
                buf.writeUint16BE(port, 2)
                //buf.writeUint32(0, 4) // flowinfo
                const parts = host.split(':')
                for(let i = 0; i < 8; i++){
                    buf.writeUint16(parseInt(parts[i] || '0'), 8 + i * 2)
                }
                //buf.writeUint32(0, 4) // scope_id
                return buf //break;
            }
        }
    }
    
    static fromPointer(ptr: Pointer) {
        const family = read.u16(ptr, 0)
        const port = read.u16(ptr, 2) //TODO: BE
        const host = (family == AddressFamily.INET) ? [
            read.u8(ptr, 4 + 0),
            read.u8(ptr, 4 + 1),
            read.u8(ptr, 4 + 2),
            read.u8(ptr, 4 + 3),
         ].join('.') : [
            read.u16(ptr, 8 + 0 * 2),
            read.u16(ptr, 8 + 1 * 2),
            read.u16(ptr, 8 + 2 * 2),
            read.u16(ptr, 8 + 3 * 2),
            read.u16(ptr, 8 + 4 * 2),
            read.u16(ptr, 8 + 5 * 2),
            read.u16(ptr, 8 + 6 * 2),
            read.u16(ptr, 8 + 7 * 2),
        ].join(':')
        return new UTPAddress(family, host, port)
    }
}
