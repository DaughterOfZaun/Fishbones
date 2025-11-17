import { select, type Choice } from "../../../../ui/remote/remote"
import type { AbortOptions } from "@libp2p/interface"
import type { Enabled } from "./enabled"
import { ValueDesc } from "./desc"

//type OmitFirst<T extends unknown[]> = T extends [unknown, ...infer R] ? R : never
//type PickableValueConstructorArgs = OmitFirst<ConstructorParameters<typeof PickableValue>>
//type PickableValueConstructor = new (...args: ConstructorParameters<typeof PickableValue>) => PickableValue
export interface PickableValueStatics { name: string, values: Record<number, string>, choices: Choice<number>[] }
export class PickableValue extends ValueDesc<number, number> {
    public value?: number
    public readonly name: string
    private readonly values: Record<number, string>
    private readonly choices: Choice<number>[]
    private readonly enabledGetter?: () => Enabled
    //private readonly enabled?: Enabled
    constructor(value?: number, enabledGetter?: () => Enabled){
    //constructor(value?: number, enabled?: Enabled){
        super()
        const statics = this.constructor as unknown as PickableValueStatics
        this.name = statics.name
        this.values = statics.values
        this.choices = statics.choices
        this.value = value
        this.enabledGetter = enabledGetter
        //this.enabled = enabled
    }
    //public encode(){ return (this.value ?? -1) + 1 }
    //public encode(){ return this.value ?? 0 }
    public encode(){ return this.value! }
    public decodeInplace(from: number): boolean {
        if(from === undefined) return false
        //from--
        if(from in this.values){
            this.value = from
            return true
        }
        return false
    }
    public async uinput(opts: Required<AbortOptions>) {
        const enabled = this.enabledGetter?.call(null)
        //const enabled = this.enabled
        if(enabled) for(const choice of this.choices){
            choice.disabled = !enabled.value.includes(choice.value)
        }
        try {
            this.value = await select({
                message: `Select ${this.name}`,
                choices: this.choices,
                pageSize: 20,
            }, {
                clearPromptOnDone: true,
                signal: opts.signal,
            })
        } finally {
            if(enabled) for(const choice of this.choices){
                choice.disabled = false
            }
        }
    }
    public get [Symbol.toStringTag]() {
        throw new Error("An attempt to output an object without first converting it to a string")
        //return this.toString()
    }
    public toString(): string {
        return (this.value != undefined) ? this.values[this.value]! : 'undefined'
    }
    public static normalize(values: Record<number, string>)/*: Choice<number>[]*/{
        return Object.entries(values).map(([k, v]) => ({ value: Number(k), name: v }))
    }
    public setRandom(){
        let enabled = this.enabledGetter?.call(null).value.filter(v => v in this.values)
            enabled ??= Object.keys(this.values).map(k => parseInt(k))
        if(enabled.length > 0)
            this.value = enabled[Math.floor(Math.random() * enabled.length)]
        else
            this.value = undefined
    }
}
