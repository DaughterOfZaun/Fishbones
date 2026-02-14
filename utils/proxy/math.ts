import { Reader, Writer } from "./enet"

const arraybuffer1 = new ArrayBuffer(2*4)
const float16array1 = new Float16Array(arraybuffer1)
const bigint64array1 = new BigUint64Array(arraybuffer1)

const arraybuffer2 = new ArrayBuffer(2*4)
const float16array2 = new Float16Array(arraybuffer2)
const bigint64array2 = new BigUint64Array(arraybuffer2)

export type Vector2 = bigint & { readonly brand: unique symbol }
export type Vector3 = bigint & { readonly brand: unique symbol }
export type Vector4 = bigint & { readonly brand: unique symbol }
export type Vector = Vector2 | Vector3 | Vector4

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

export function vec2(x: number, z: number): Vector2 {
    float16array1[0] = x
    float16array1[2] = 0
    float16array1[1] = z
    float16array1[3] = 0
    return bigint64array1[0] as Vector2
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

export function getX(v: Vector2 | Vector3 | Vector4){
    bigint64array1[0] = v
    return float16array1[0]!
}

export function getY(v: Vector3 | Vector4){
    bigint64array1[2] = v
    return float16array1[2]!
}

export function getZ(v: Vector2 | Vector3 | Vector4){
    bigint64array1[1] = v
    return float16array1[1]!
}

export function getW(v: Vector4){
    bigint64array1[1] = v
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

export function getBitFlagLE(buffer: Buffer, index: number){
    return ((buffer[Math.floor(index / 8)]! >> (index % 8)) & 1) != 0
}

export function makeWanderPoint(point: Vector3, distance: number) {
    return Vector3.Zero //TODO:
}

const arraybuffer3 = new ArrayBuffer(4)
const float32array3 = new Float32Array(arraybuffer3)
const uint32array3 = new Uint32Array(arraybuffer3)
export function float32ToUInt32(value: number){
  float32array3[0] = value
  return uint32array3[0]!
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
    ]
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
