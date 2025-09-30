import { read as BunRead, FFIType, type Pointer as BunPointer } from "bun:ffi"
export { ptr, dlopen, JSCallback } from "bun:ffi"

const is64Bit = ['arm64', 'ppc64', 'x64', 's390x'].includes(process.arch)

const bits = is64Bit ? 64 : 32
export const sizeof = {
    ptr_t: bits / 8,
    size_t: bits / 8,
    uint32: 32 / 8,
    int: 32 / 8,
}

export const int = FFIType.int as const
//export const ptr_t = 'ptr' as const
//export const ptr_t = 'uint64_t' as const
export const ptr_t = is64Bit ? FFIType.u64 as const : FFIType.u32 as const
export const void_t = FFIType.void as const
export const ssize_t = is64Bit ? FFIType.i64 as const : FFIType.i32 as const
export const size_t = is64Bit ? FFIType.u64 as const : FFIType.u32 as const
export const socklen_t = FFIType.u32 as const
export const uint16 = FFIType.u16 as const
export const callback = 'callback' as const
export const uint64 = FFIType.u64 as const

export type Pointer = number

export const read = {
    u8: wrap('u8'),
    u16: wrap('u16'),
    u32: wrap('u32'),
    i32: wrap('i32'),
    ptr: is64Bit ? wrap('u64') : wrap('u32'),
}
function wrap(key: keyof typeof BunRead){
    return (ptr: Pointer, offset: number) => {
        //console.trace(key, ptr, offset)
        return Number(BunRead[key](ptr as BunPointer, offset))
    }
}

//HACK: export { toBuffer } from 'bun:ffi'
export function toBuffer(ptr: Pointer, offset: number = 0, len: number = 0){
    if(len !== 0){
        const buffer = Buffer.alloc(len, 0)
        for(let i = 0; i < len; i++)
            buffer[i] = BunRead.u8(ptr as BunPointer, offset + i)
        return buffer
    } else {
        const array = []
        for(let i = 0;; i++){
            const v = BunRead.u8(ptr as BunPointer, offset + i)
            if(v === 0) break
            array.push(v)
        }
        return Buffer.from(array)
    }
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
export const asPointer = (n: number | bigint) => Number(n) as Pointer
