import { toObject, Vector4, type Vector } from "./math"

export type int = number
export type bool = boolean
export type float = number
export type Color = Vector4

export function assign<T extends {}>(target: T, source: Partial<T>): T {
    return Object.assign(target, source)
}

export function optcall<T, R>(value: T | undefined, callback: (value: T) => R): R | undefined {
    if(value == undefined || value == null) return undefined
    return callback(value)
}

//TODO: replacer + reviver
export function replacer(key: string, value: unknown){
    if(typeof value == 'bigint'){
        if(value > 0xFFFF) return toObject(value as Vector)
        else return { n: value.toString(16) }
    }
    if(value instanceof Map){
        const obj = Object.fromEntries(value.entries())
        obj['$type'] = 'map'
        return obj
    }
    if(value instanceof Set){
        return [...value]
    }
    return value
}
