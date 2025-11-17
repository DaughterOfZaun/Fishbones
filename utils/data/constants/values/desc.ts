import type { AbortOptions } from "@libp2p/interface"

export abstract class ValueDesc<I, E> {
    public name!: string
    public desc?: string
    public value?: I
    abstract encode(): E
    abstract decodeInplace(v: E): boolean
    abstract uinput(opts: Required<AbortOptions>): Promise<unknown>
    abstract toString(): string
}
