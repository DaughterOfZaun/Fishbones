import { checkbox, type CheckboxChoice } from "../../../../ui/remote/remote"
import type { AbortOptions } from "@libp2p/interface"
import { ValueDesc } from "./desc"
import type { PickableValueStatics } from "./pickable"
import { tr } from "../../../translation"

export function enabled(wrapped: PickableValueStatics){
    return class EnabledSubclass extends Enabled {
        public static readonly name = tr(`{wrapped_name}s Enabled`, { wrapped_name: wrapped.name })
        public static get values(){ return wrapped.values }
        public static get choices(){ return wrapped.choices }
    }
}

export class Enabled extends ValueDesc<number[], number[]>{
    public value: number[] = []
    public readonly name: string
    private readonly values: Record<number, string>
    private readonly choices: CheckboxChoice<number>[]
    constructor(value: number[] = []){
        super()
        this.value = value
        const statics = this.constructor as unknown as PickableValueStatics
        this.name = statics.name
        this.values = statics.values
        this.choices = statics.choices
    }
    encode(): number[] {
        return this.value
    }
    decodeInplace(v: number[]): boolean {
        this.value = v.filter(v => v in this.values)
        return true
    }
    async uinput(opts: Required<AbortOptions>) {
        
        for(const choice of this.choices)
            choice.checked = this.value.includes(choice.value)

        this.value = await checkbox({
            message: tr(`Check {this_name}`, { this_name: this.name }),
            choices: this.choices,
            pageSize: 20,
        }, {
            clearPromptOnDone: true,
            signal: opts.signal,
        })
    }
    public get [Symbol.toStringTag]() {
        throw new Error("An attempt to output an object without first converting it to a string")
        //return this.toString()
    }
    toString(): string {
        return tr(`{this_value_length} of {this_choices_length} checked`, {
            this_value_length: this.value.length,
            this_choices_length: this.choices.length,
        })
    }
    public set(num: number, enabled: boolean){
        const i = this.value.indexOf(num)
        if(enabled && i === -1)
            this.value.push(num)
        if(!enabled && i !== -1)
            this.value.splice(i, 1)
    }
    public get(num: number){
        return this.value.includes(num)
    }
}
