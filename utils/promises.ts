import { AbortError, type AbortOptions } from '@libp2p/interface'
import defer from 'p-defer'

export async function deadlyRace<T = unknown>(cbs: ((opts: Required<AbortOptions>) => Promise<T>)[], opts: Required<AbortOptions>): Promise<T> {
    return new Promise((resolve, reject) => {
        const controller = new AbortController()
        const signal = AbortSignal.any([ controller.signal, opts.signal ])
        void Promise.race(cbs.map(async cb => {
            return cb({ signal }).catch((reason: Error) => {
                if(controller.signal.aborted) return // Ignore.
                controller.abort(reason)
                reject(reason)
            })
        })).then((result) => {
            controller.abort(new AbortError())
            resolve(result as T)
        })
    })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventCallback = (...args: any[]) => void
interface Emitter {
    addListener: (event: string, callback: EventCallback) => void
    removeListener: (event: string, callback: EventCallback) => void
}

interface EventEmitter<T extends string> {
    addEventListener: (event: T, callback: EventCallback) => void
    removeEventListener: (event: T, callback: EventCallback) => void
}

export class Deferred<T> {
    public readonly promise: Promise<T>
    public readonly resolve: (value: T) => void
    public readonly reject: (err?: Error) => void
    constructor(opts?: AbortOptions){
        const { promise, resolve, reject } = defer<T>()
        this.promise = promise
        this.resolve = (value) => { this.cleanup(); resolve(value) }
        this.reject = (err) => { this.cleanup(); reject(err) }
        if(opts && opts.signal){
            this.addEventListener(opts.signal, 'abort', () => {
                this.reject(opts.signal?.reason as Error)
            })
        }
    }
    private listeners: [ Emitter, string, EventCallback ][] = []
    public addListener<T extends string>(obj: Emitter, event: T, callback: EventCallback){
        this.listeners.push([ obj, event, callback ])
        obj.addListener(event, callback)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private eventListeners: [ EventEmitter<any>, string, EventCallback ][] = []
    public addEventListener<T extends string>(obj: EventEmitter<T>, event: T, callback: EventCallback){
        this.eventListeners.push([ obj, event, callback ])
        obj.addEventListener(event, callback)
    }
    private timeouts: ReturnType<typeof setTimeout>[] = []
    public setTimeout(callback: () => void, ms: number){
        const timeout = setTimeout(callback, ms)
        this.timeouts.push(timeout)
    }
    private callbacks: (() => void)[] = []
    public addCleanupCallback(callback: () => void){
        this.callbacks.push(callback)
    }
    private cleanup(){
        for(const [ obj, event, callback ] of this.listeners)
            obj.removeListener(event, callback)
        for(const [ obj, event, callback ] of this.eventListeners)
            obj.removeEventListener(event, callback)
        for(const timeout of this.timeouts)
            clearTimeout(timeout)
        for(const callback of this.callbacks)
            callback()
    }
}
