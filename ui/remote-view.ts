import type { AbortOptions } from "@libp2p/interface"
import { Deferred } from "../utils/data-process"
import { handlers, sendCall, sendFollowupNotification, type JSONDict, type JSONValue } from "./remote-jrpc"
//import * as jrpc from "./remote-jrpc"
import type { Config, View as IView } from "./remote-types"

const SLASH = '/'
const COLON = ':'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JListener = (...args: any[]/*JSONValue[]*/) => void
//// eslint-disable-next-line @typescript-eslint/no-explicit-any
//type AsyncJListener = (...args: any[]/*JSONValue[]*/) => void | Promise<void>

export class View implements IView {
    private id: number
    private path: string
    constructor(id: number, path: string){
        this.id = id
        this.path = path
    }
    public get(path: string){
        return new View(this.id, this.path + SLASH + path)
    }
    private call(name: string, ...args: JSONValue[]){
        sendFollowupNotification('external_call', this.id, ...[this.path, name, ...args])
    }
    public update(config: Config){
        this.call('update', config as unknown as JSONValue)
    }
    public add(name: string, config: Config){
        this.call('add_item', name, config as unknown as JSONValue)
    }
    public remove(name: string){
        this.call('remove_item', name)
    }
    public setItems(configs: Record<string, Config>){
        this.call('set_items', configs as unknown as JSONValue)
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
    private call(name: string, ...args: JSONValue[]){
        sendFollowupNotification('external_call', this.id, ...[this.path, name, ...args])
    }
    public update(config: Partial<Config>){
        this.call('update', config as unknown as JSONValue)
    }
    public add(name: string, config: Config){
        this.call('add_item', name, config as unknown as JSONValue)
    }
    //public update_item(name: string, config: Config){
    //    this.call('update_item', name, config as unknown as JSONValue)
    //}
    public remove(name: string){
        this.call('remove_item', name)
    }
}

function recursive(path: string, config: Config, cb: (path: string, control: Config) => void){
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

type GListener = {
    regex: RegExp
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listener: (m: RegExpMatchArray, ...args: any[]) => void
}
export function render<T = void>(name: string, config: Config, opts: Required<AbortOptions>, gListeners: GListener[] = []){

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
            listeners.set(path + COLON + event, listener as JListener)
        }
    })

    const handler = {
        call: (...args: JSONValue[]) => {
            const path = args.shift() as string
            const event = args.shift() as string
            const pathAndEvent = path + COLON + event
            const listener = listeners.get(pathAndEvent)
            listener?.(...args)
            if(!listener){
                for(const { regex, listener } of gListeners){
                    const m = regex.exec(pathAndEvent)
                    if(m){
                        listener(m, ...args)
                        return
                    }
                }
            }
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
