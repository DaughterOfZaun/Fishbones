import type { AbortOptions } from "@libp2p/interface"

export type ErrnoException = Error & {
    code?: string
    errno?: number
    syscall?: string
}

export function toBase64(arr: Uint8Array): string {
    return Buffer.from(arr).toString('base64')
}
export function fromBase64(str: string): Uint8Array {
    return Buffer.from(str, 'base64')
}
export function toHex(arr: Uint8Array): string {
    return Buffer.from(arr).toString('hex')
}
export function fromHex(str: string): Uint8Array {
    return Buffer.from(str, 'hex')
}

export async function sleep(ms: number, opts: Required<AbortOptions>){
    opts.signal.throwIfAborted()
    return new Promise<void>((resolve, reject) => {
        let timeout: ReturnType<typeof setTimeout>
        const onabort = () => {
            const err = opts.signal.reason
            clearTimeout(timeout)
            reject(err)
        }
        opts.signal.addEventListener('abort', onabort)
        timeout = setTimeout(() => {
            opts.signal.removeEventListener('abort', onabort)
            resolve()
        }, ms)
    })
}

export function sortInplace<T>(a: T[], by: (e: T) => (number | string), dir: 'asc' | 'dsc' = 'asc'): T[] {
    const s = dir == 'asc' ? +1 : -1
    a.sort((a, b) => {
        const by_a = by(a)
        const by_b = by(b)
        if(by_a < by_b) return -1 * s
        if(by_b < by_a) return +1 * s
        return 0
    })
    return a
}
