import os from 'node:os'

enum AddressFamily {
    INET = 2,
    INET6 = 10,
}

export class UTPAddress {
    public constructor(
        public readonly host: string,
        public readonly port: number,
    ){}
}

type BELE = 'BE' | 'LE'
const BELE: BELE = os.endianness()
Buffer.prototype.writeUint16 = Buffer.prototype[`writeUint16${BELE}`]
type BufferType = ReturnType<(typeof Buffer<ArrayBuffer>)['alloc']>
declare global {
    interface Buffer {
        writeUint16: BufferType[`writeUint16${BELE}`]
    }
}

const SOCKADDR_STORAGE_SIZE = 128
const addr = Buffer.alloc(SOCKADDR_STORAGE_SIZE)
addr.writeUint16(AddressFamily.INET, 0)
addr.writeUint8(127, 2)
addr.writeUint8(0, 3)
addr.writeUint8(0, 4)
addr.writeUint8(1, 5)

const addrlen = 16 // 28 for IPv6
