import { Reader, Writer } from "../binary"

const arraybuffer1 = new ArrayBuffer(2*4)
const int16array1 = new Int16Array(arraybuffer1)
const float16array1 = new Float16Array(arraybuffer1)
const float32array1 = new Float32Array(arraybuffer1)
const bigint64array1 = new BigUint64Array(arraybuffer1)

const arraybuffer2 = new ArrayBuffer(2*4)
const int16array2 = new Int16Array(arraybuffer2)
const float16array2 = new Float16Array(arraybuffer2)
const float32array2 = new Float32Array(arraybuffer2)
const bigint64array2 = new BigUint64Array(arraybuffer2)

export type Vector2 = bigint & { readonly brand: unique symbol } // Vector2Half
export type Vector2Int = bigint & { readonly brand: unique symbol }
export type Vector2Single = bigint & { readonly brand: unique symbol }
export type Vector3 = bigint & { readonly brand: unique symbol }
export type Vector4 = bigint & { readonly brand: unique symbol }
export type Vector = Vector2 | Vector3 | Vector4
export type VectorInt = Vector2Int

export namespace Vector4 {
    export function read(reader: Reader, name?: string){
        float16array1[0] = reader.readFloat(`${name}.x`)
        float16array1[2] = reader.readFloat(`${name}.y`)
        float16array1[1] = reader.readFloat(`${name}.z`)
        float16array1[3] = reader.readFloat(`${name}.w`)
        return bigint64array1[0] as Vector4
    }
    export function readFixed(reader: Reader, scale = 1, name?: string){
        float16array1[0] = reader.readSByte(`${name}.x`) * scale
        float16array1[2] = reader.readSByte(`${name}.y`) * scale
        float16array1[1] = reader.readSByte(`${name}.z`) * scale
        float16array1[3] = reader.readSByte(`${name}.w`) * scale
        return bigint64array1[0] as Vector4
    }
}

export namespace Vector3 {
    export const One = vec3(1, 1, 1)
    export const Zero = vec3(0, 0, 0)
    export function write(writer: Writer, v: Vector3){
        bigint64array1[0] = v
        writer.writeFloat(float16array1[0]!)
        writer.writeFloat(float16array1[2]!)
        writer.writeFloat(float16array1[1]!)
    }
    export function read(reader: Reader, name?: string){
        float16array1[0] = reader.readFloat(`${name}.x`)
        float16array1[2] = reader.readFloat(`${name}.y`)
        float16array1[1] = reader.readFloat(`${name}.z`)
        float16array1[3] = 0
        return bigint64array1[0] as Vector3
    }
    export function readFixed(reader: Reader, scale = 1, name?: string){
        float16array1[0] = reader.readSByte(`${name}.x`) * scale
        float16array1[2] = reader.readSByte(`${name}.y`) * scale
        float16array1[1] = reader.readSByte(`${name}.z`) * scale
        float16array1[3] = 0
        return bigint64array1[0] as Vector3
    }
}

export namespace Vector2 {
    export const One = vec2(1, 1)
    export const Zero = vec2(0, 0)
    export function write(writer: Writer, v: Vector2){
        bigint64array1[0] = v
        writer.writeFloat(float16array1[0]!)
        writer.writeFloat(float16array1[1]!)
    }
    export function read(reader: Reader){
        float16array1[0] = reader.readFloat()
        float16array1[2] = 0
        float16array1[1] = reader.readFloat()
        float16array1[3] = 0
        return bigint64array1[0] as Vector2
    }
    export function readFixed(reader: Reader, scale = 1, name?: string){
        float16array1[0] = reader.readSByte(`${name}.x`) * scale
        float16array1[2] = 0
        float16array1[1] = reader.readSByte(`${name}.z`) * scale
        float16array1[3] = 0
        return bigint64array1[0] as Vector2
    }
}

export namespace Vector2Int {
    export function write(writer: Writer, v: Vector2Int){
        bigint64array1[0] = v
        writer.writeInt16(int16array1[0]!)
        writer.writeInt16(int16array1[1]!)
    }
    export function read(reader: Reader){
        int16array1[0] = reader.readInt16()
        int16array1[2] = 0
        int16array1[1] = reader.readInt16()
        int16array1[3] = 0
        return bigint64array1[0] as Vector2Int
    }
}

export namespace Vector2Single {
    export const One = svec2(1, 1)
    export const Zero = svec2(0, 0)
}

export function vec2(x: number, z: number): Vector2 {
    float16array1[0] = x
    float16array1[2] = 0
    float16array1[1] = z
    float16array1[3] = 0
    const v = bigint64array1[0] as Vector2
    //console.log('in ', x, z)
    //console.log('out', getX(v), getZ(v))
    return v
}

export function ivec2(x: number, z: number): Vector2Int {
    int16array1[0] = x
    int16array1[2] = 0
    int16array1[1] = z
    int16array1[3] = 0
    return bigint64array1[0] as Vector2Int
}

export function svec2(x: number, z: number): Vector2Single {
    float32array1[0] = x
    float32array2[1] = z
    return bigint64array1[0] as Vector2Single
}

export function vec3(x: number, y: number, z: number): Vector3 {
    float16array1[0] = x
    float16array1[2] = y
    float16array1[1] = z
    float16array1[3] = 0
    return bigint64array1[0] as Vector3
}

export function vec4(x: number, y: number, z: number, w: number): Vector4 {
    float16array1[0] = x
    float16array1[2] = y
    float16array1[1] = z
    float16array1[3] = w
    return bigint64array1[0] as Vector4
}

export function toString(v: Vector){
    bigint64array1[0] = v
    return `${float16array1[0]}, ${float16array1[2]}, ${float16array1[1]}, ${float16array1[3]}`
}

export function toStringInt(v: VectorInt){
    bigint64array1[0] = v
    return `${int16array1[0]}, ${int16array1[2]}, ${int16array1[1]}, ${int16array1[3]}`
}

export function getX(v: Vector2 | Vector3 | Vector4){
    bigint64array1[0] = v
    return float16array1[0]!
}

export function getXi(v: Vector2Int){
    bigint64array1[0] = v
    return int16array1[0]!
}

export function getY(v: Vector3 | Vector4){
    bigint64array1[0] = v
    return float16array1[2]!
}

export function getZ(v: Vector2 | Vector3 | Vector4){
    bigint64array1[0] = v
    return float16array1[1]!
}

export function getZi(v: Vector2Int){
    bigint64array1[0] = v
    return int16array1[1]!
}

export function getW(v: Vector4){
    bigint64array1[0] = v
    return float16array1[3]!
}

export function add(v1: Vector2, v2: Vector2): Vector2
export function add(v1: Vector2, v2: Vector3): Vector3
export function add(v1: Vector3, v2: Vector2): Vector3
export function add(v1: Vector3, v2: Vector3): Vector3
export function add(v1: Vector, v2: Vector): Vector {
    bigint64array1[0] = v1
    bigint64array2[0] = v2
    float16array1[0]! += float16array2[0]!
    float16array1[1]! += float16array2[1]!
    float16array1[2]! += float16array2[2]!
    float16array1[3]! += float16array2[3]!
    return bigint64array1[0] as Vector
}

export function sadd(v1: Vector2Single, v2: Vector2Single): Vector2Single {
    bigint64array1[0] = v1
    bigint64array2[0] = v2
    float32array1[0]! += float32array2[0]!
    float32array1[1]! += float32array2[1]!
    return bigint64array1[0] as Vector2Single
}

export function sub(v1: Vector2, v2: Vector2): Vector2
export function sub(v1: Vector2, v2: Vector3): Vector3
export function sub(v1: Vector3, v2: Vector2): Vector3
export function sub(v1: Vector3, v2: Vector3): Vector3
export function sub(v1: Vector, v2: Vector): Vector {
    bigint64array1[0] = v1
    bigint64array2[0] = v2
    float16array1[0]! -= float16array2[0]!
    float16array1[1]! -= float16array2[1]!
    float16array1[2]! -= float16array2[2]!
    float16array1[3]! -= float16array2[3]!
    return bigint64array1[0] as Vector
}

export function isub(v1: VectorInt, v2: VectorInt): VectorInt {
    bigint64array1[0] = v1
    bigint64array2[0] = v2
    int16array1[0]! -= int16array2[0]!
    int16array1[1]! -= int16array2[1]!
    int16array1[2]! -= int16array2[2]!
    int16array1[3]! -= int16array2[3]!
    return bigint64array1[0] as VectorInt
}

export function ssub(v1: Vector2Single, v2: Vector2Single): Vector2Single {
    bigint64array1[0] = v1
    bigint64array2[0] = v2
    float32array1[0]! -= float32array2[0]!
    float32array1[1]! -= float32array2[1]!
    return bigint64array1[0] as Vector2Single
}

export function mul(v: Vector2, s: number): Vector2
export function mul(v: Vector3, s: number): Vector3
export function mul(v: Vector4, s: number): Vector4
export function mul(v: Vector, s: number): Vector {
    bigint64array1[0] = v
    float16array1[0]! *= s
    float16array1[1]! *= s
    float16array1[2]! *= s
    float16array1[3]! *= s
    return bigint64array1[0] as Vector
}

export function smul(v: Vector2Single, s: number): Vector2Single {
    bigint64array1[0] = v
    float32array1[0]! *= s
    float32array1[1]! *= s
    return bigint64array1[0] as Vector2Single
}

export function div(v: Vector2, s: number): Vector2
export function div(v: Vector3, s: number): Vector3
export function div(v: Vector4, s: number): Vector4
export function div(v: Vector, s: number): Vector {
    bigint64array1[0] = v
    float16array1[0]! /= s
    float16array1[1]! /= s
    float16array1[2]! /= s
    float16array1[3]! /= s
    return bigint64array1[0] as Vector
}

export function sdiv(v: Vector2Single, s: number): Vector2Single {
    bigint64array1[0] = v
    float32array1[0]! /= s
    float32array1[1]! /= s
    return bigint64array1[0] as Vector2Single
}

export function getBitFlagLE(buffer: Buffer, index: number){
    return ((buffer[Math.floor(index / 8)]! >> (index % 8)) & 1) != 0
}

export function setBitFlagLE(buffer: Buffer, index: number, value: number | boolean){
    const i = Math.floor(index / 8)
    const j = index % 8
    buffer[i]! = buffer[i]! & ~(1 << j) | (+value << j)
}

export function makeWanderPoint(point: Vector3, distance: number): Vector3 {
    return Vector3.Zero //TODO:
}

const arraybuffer3 = new ArrayBuffer(4)
const float32array3 = new Float32Array(arraybuffer3)
const uint32array3 = new Uint32Array(arraybuffer3)
export function float32ToUInt32(value: number): number {
    float32array3[0] = value
    return uint32array3[0]!
}
export function uInt32Tofloat32(value: number): number {
    uint32array3[0] = value
    return float32array3[0]!
}

//const buffer1 = Buffer.alloc(4)
//export function float32ToUInt32(value: number){
//    buffer1.writeFloatLE(value)
//    return buffer1.readUInt32LE()
//}

export function toArray(v: Vector){
    bigint64array1[0] = v
    return [
        float16array1[0]!,
        float16array1[2]!,
        float16array1[1]!,
        float16array1[3]!,
    ] as const
}

export function toObject(v: Vector){
    bigint64array1[0] = v
    return {
        x: float16array1[0]!,
        y: float16array1[2]!,
        z: float16array1[1]!,
        w: float16array1[3]!,
    }
}

export function len(v: Vector): number {
    bigint64array1[0] = v
    return Math.sqrt( 
        + (float16array1[0]! ** 2)
        + (float16array1[2]! ** 2)
        + (float16array1[1]! ** 2)
        + (float16array1[3]! ** 2)
    )
}

export function ilen(v: VectorInt): number {
    bigint64array1[0] = v
    return Math.sqrt( 
        + (int16array1[0]! ** 2)
        + (int16array1[2]! ** 2)
        + (int16array1[1]! ** 2)
        + (int16array1[3]! ** 2)
    )
}

export function slen(v: Vector2Single): number {
    bigint64array1[0] = v
    return Math.sqrt( 
        + (float32array1[0]! ** 2)
        + (float32array1[1]! ** 2)
    )
}

export function fromIntToSingle(v: Vector2Int): Vector2Single {
    bigint64array1[0] = v
    float32array2[0] = int16array1[0]!
    float32array2[1] = int16array1[1]!
    return bigint64array2[0] as Vector2Single
}

export function fromSingleToInt(v: Vector2Single): Vector2Int {
    bigint64array1[0] = v
    int16array2[0] = Math.round(float32array1[0]!)
    int16array2[1] = Math.round(float32array1[1]!)
    int16array2[2] = 0
    int16array2[3] = 0
    return bigint64array2[0] as Vector2Int
}
