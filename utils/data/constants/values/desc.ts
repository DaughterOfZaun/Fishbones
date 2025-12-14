import type { AbortOptions } from "@libp2p/interface"

export abstract class ValueDesc<I, E> {
    public name!: string
    public desc?: string
    public value?: I
    abstract encode(): E
    abstract decodeInplace(v: E): boolean
    constructor(value?: I){
        this.value = value
    }

    //TODO: Deprecate uinput.
    // eslint-disable-next-line @typescript-eslint/promise-function-async, @typescript-eslint/no-unused-vars
    uinput(opts: Required<AbortOptions>): Promise<unknown> {
        throw new Error("Method not implemented.")
    }
    toString(): string {
        throw new Error("Method not implemented.")
    }
}
