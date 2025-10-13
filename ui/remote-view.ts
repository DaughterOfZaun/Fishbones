import type { AbortOptions } from "@libp2p/interface"
import { Deferred } from "../utils/data-process"
import { handlers, sendCall, sendFollowupNotification, type JSONDict, type JSONValue } from "./remote-jrpc"
//import * as jrpc from "./remote-jrpc"
import type { Control, View as IView } from "./remote-types"

const SLASH = '/'
const COLON = ':'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JListener = (...args: any[]/*JSONValue[]*/) => void
//// eslint-disable-next-line @typescript-eslint/no-explicit-any
//type AsyncJListener = (...args: any[]/*JSONValue[]*/) => void | Promise<void>

export class View implements IView {
    private id: number
    private path: string
    constructor(id: number, path = '.'){
        this.id = id
        this.path = path
    }
    public get(path: string){
        return new View(this.id, this.path + SLASH + path)
    }
    public call(name: string, ...args: JSONValue[]){
        sendFollowupNotification('call', this.id, ...[this.path, name, ...args])
    }
}

export class DeferredView<T> extends Deferred<T> implements IView {
    private id: number
    private path: string
    constructor(id: number, path = '.'){
        super()
        this.id = id
        this.path = path
    }
    public get(path: string){
        return new View(this.id, this.path + SLASH + path)
    }
    public call(name: string, ...args: JSONValue[]){
        sendFollowupNotification('call', this.id, ...[this.path, name, ...args])
    }
}

function recursive(path: string, config: Control, cb: (path: string, control: Control) => void){
    cb(path, config)

    const children =
        ('items' in config) ? config.items :
        ('fields' in config) ? config.fields :
        undefined

    if(children)
        for(const [name, config] of Object.entries(children)){
            recursive(path + SLASH + name, config, cb)
        }
}

export function render<T>(name: string, config: Control, opts: Required<AbortOptions>){

    const id = sendCall('render', name, config as unknown as JSONDict)

    const deferred = new DeferredView<T>(id)

    let shouldSendAbortNotification = true
    deferred.addEventListener(opts.signal, 'abort', () => {
        deferred.reject(opts.signal?.reason as Error)
    })

    const listeners = new Map<string, JListener>()
    recursive('.', config, (path, config) => {
        if('$listeners' in config && config.$listeners)
        for(const [event, listener] of Object.entries(config.$listeners)){
            listeners.set(path + COLON + event, listener)
        }
    })

    const handler = {
        call: (...args: JSONValue[]) => {
            const path = args.shift() as string
            const event = args.shift() as string
            const listener = listeners.get(path + COLON + event)
            listener?.(...args)
        },
        resolve: (arg: JSONValue) => {
            shouldSendAbortNotification = false
            deferred.resolve(arg as T)
        },
        reject: (arg: JSONValue) => {
            let msg = 'No error message provided'
            let cause: number | undefined
            if(typeof arg === 'object' && arg !== null){
                if('message' in arg && typeof arg['message'] === 'string')
                    msg = arg['message']
                if('code' in arg && typeof arg['code'] === 'number')
                    cause = arg['code']
            }
            shouldSendAbortNotification = false
            deferred.reject(new Error(msg, { cause }))
        }
    }

    handlers.set(id, handler)
    deferred.addCleanupCallback(() => {
        if(shouldSendAbortNotification)
            sendFollowupNotification('abort', id)
        handlers.delete(id)
    })

    return deferred
}
