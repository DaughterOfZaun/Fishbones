import { input } from "../../../../ui/remote/remote"
import type { AbortOptions } from "@libp2p/interface"
import { tr } from "../../../translation"
import { ValueDesc } from "./desc"

export function sanitize_str(v: string){
    return v.replace(/\W/g, '').slice(0, 16)
}

export class InputableValue extends ValueDesc<string, string> {
    public value?: string
    public readonly name: string
    constructor(name: string, value?: string){
        super()
        this.name = name
        this.value = value
    }
    public encode(): string {
        return this.value ?? ''
    }
    public decodeInplace(v: string): boolean {
        this.value = sanitize_str(v)
        return true
    }
    public async uinput(opts: Required<AbortOptions>) {
        this.value = await input({
            message: tr(`Enter {this_name}`, { this_name: this.name }),
            //transformer: (v, /*{ isFinal }*/) => sanitize_str(v),
            validate: v => v == sanitize_str(v),
            default: this.value,
        }, {
            clearPromptOnDone: true,
            signal: opts.signal,
        })
    }
    public get [Symbol.toStringTag]() {
        throw new Error("An attempt to output an object without first converting it to a string")
        //return this.toString()
    }
    public toString(): string {
        return this.value?.replace(/./g, '*') ?? tr('undefined')
    }
}
