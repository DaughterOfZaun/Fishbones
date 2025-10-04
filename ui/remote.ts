import { input as localInput, checkbox as localCheckbox } from '@inquirer/prompts'
import { AbortPromptError, ExitPromptError } from '@inquirer/core'
import type { Context } from '@inquirer/type'
import yoctocolor from 'yoctocolors-cjs'

import { createBar as localBar, console_log as localLog } from './progress'
import { default as localSelect, type Choice as SelectChoice } from './dynamic-select'
import { default as localSpinner } from './spinner'
import { logger } from '../utils/data-shared'
import { args } from '../utils/args'
import embedded from '../utils/embedded'

import path from 'node:path'
import { downloads, fs_chmod, fs_copyFile, fs_exists, rwx_rx_rx } from '../utils/data-fs'
import { Deferred, originalSpawn, registerShutdownHandler } from '../utils/data-process'
import type { AbortOptions } from '@libp2p/interface'

export { type SelectChoice as Choice, AbortPromptError, ExitPromptError }

type JSONPrimitive = string | number | boolean | null | undefined
type JSONValue = JSONPrimitive | JSONValue[] | { [key: string]: JSONValue }

export const guiDisabled = !args.gui.enabled
export const jsonRpcDisabled = !args.jRPCUI.enabled

let gid = 0
function sendCall(method: string, ...params: JSONValue[]){
    const id = gid++
    process.stdout.write(JSON.stringify({ id, method, params }) + '\n', 'utf8')
    //console.log(JSON.stringify({ id, method, params }))
    return id
}
function sendNotification(method: string, ...params: JSONValue[]){
    process.stdout.write(JSON.stringify({ method, params }) + '\n', 'utf8')
    //console.log(JSON.stringify({ method, params }))
}
function sendFollowupNotification(method: string, id: number, ...params: JSONValue[]){
    process.stdout.write(JSON.stringify({ id, method, params }) + '\n', 'utf8')
    //console.log(JSON.stringify({ id, method, params }))
}

type InputConfig = Parameters<typeof localInput>[0]
export async function input(config: InputConfig, context?: Context): Promise<string> {
    if(jsonRpcDisabled) return localInput(config, context)
    return remoteInput('input', config, context)
}

type CheckboxChoice<Value> = Extract<Parameters<typeof localCheckbox<Value>>[0]['choices'][number], { value: Value }>
type CheckboxConfig<Value> = Omit<Parameters<typeof localCheckbox<Value>>[0], 'choices'> & { choices: CheckboxChoice<Value>[] }
export async function checkbox<Value>(config: CheckboxConfig<Value>, context?: Context): Promise<Value[]> {
    if(jsonRpcDisabled) return localCheckbox<Value>(config, context)

    const values = config.choices.map(choice => choice.value)
    const choices = config.choices.map((choice, i) => ({ ...choice, value: i }))
    const is: number[] = await remoteInput('checkbox', { ...config, choices }, context)

    return is.map(i => values[i]!)
}

type SelectConfig<Value> = Omit<Parameters<typeof localSelect<Value>>[0], 'choices' | 'cb'> & {
    choices: SelectChoice<Value>[], cb?: (setItems: (choices: SelectChoice<Value>[]) => void) => () => void
}
export async function select<Value>(config: SelectConfig<Value>, context?: Context): Promise<Value> {
    if(jsonRpcDisabled) return localSelect<Value>(config, context)
    
    let values: Value[] = []
    let choices: SelectChoice<number>[] = []
    update(config.choices)
    function update(config_choices: SelectChoice<Value>[]){
        values = config_choices.map(choice => choice.value)
        choices = config_choices.map((choice, i) => ({ ...choice, value: i }))
        return choices
    }
    
    const idRef = { id: 0 } //HACK:
    const promise: Promise<number> = remoteInput('select', { ...config, choices }, context, idRef)
    const cleanup = config.cb?.(updatedChoices => {
        sendFollowupNotification('select.update', idRef.id, update(updatedChoices))
    })
    const i: number = await promise
    cleanup?.()
    return values[i]!
}

type SpinnerConfig = Parameters<typeof localSpinner>[0]
export async function spinner(config: SpinnerConfig, context?: Context): Promise<unknown> {
    if(jsonRpcDisabled) return localSpinner(config, context)
    return remoteInput('spinner', config, context)
}

export { extractFile as fs_copyFile }
const extractFile: typeof fs_copyFile = async (from, to, opts) => {
    await remoteInput('copy', { from, to }, opts)
}

type CancellablePromise<Value> = Promise<Value> //& { cancel: () => void }
type RemoteInputFuncName = 'spinner' | 'select' | 'checkbox' | 'input' | 'copy'
async function remoteInput<Value extends JSONValue, Config>(name: RemoteInputFuncName, config: Config, context?: Context, ref?: { id: number }): CancellablePromise<Value> {
    
    if(context?.signal?.aborted)
        return Promise.reject(new AbortPromptError({ cause: context.signal.reason }))

    const deferred = new Deferred<Value>()
    
    const id = sendCall(name, config as JSONValue) //TODO: Fix types.
    if(ref) ref.id = id

    listeners.set(id, (err, result) => {
        //if(context?.signal?.aborted)
        //    deferred.reject(new AbortPromptError({ cause: context.signal!.reason }))
        if(err) deferred.reject(new Error('', { cause: err }))
        else deferred.resolve(result as Value)
    })
    deferred.addCleanupCallback(() => listeners.delete(id))

    if(context?.signal){
        deferred.addEventListener(context.signal, 'abort', () => {
            sendFollowupNotification(`abort`, id)
            deferred.reject(new AbortPromptError({ cause: context.signal!.reason }))
        })
    }

    return deferred.promise //as CancellablePromise<Value>
    //return Object.assign(deferred.promise, {
    //    cancel(){
    //        sendFollowupNotification(`${name}.stop`, id)
    //        deferred.reject(new CancelPromptError())
    //    }
    //})
}

type BrightColorName = 'blueBright'|'redBright'|'greenBright'|'yellowBright'|'magentaBright'|'cyanBright'
type RegularColorName = 'blue'|'red'|'green'|'yellow'|'magenta'|'cyan'
type ColorName = RegularColorName|BrightColorName|'white'|'gray'
export const color = (name: ColorName, text: string): string => {
    if(jsonRpcDisabled) return yoctocolor[name](text)
    const color = name
        .replace('Bright', '')
        .replace('red', '#dc77d3')
        .replace('blue', '#4594fb')
    return `[color=${color}]${text}[/color]`
}

export interface SimpleBar {
    getTotal(): number
    update(v: number): void
    stop(): void
}
export const createBar = (operation: string, filename: string, size: number = 0): SimpleBar => {
    if(jsonRpcDisabled) return localBar(operation, filename, size)
    const id = sendCall('bar.create', operation, filename, size)
    let value = 0
    return {
        getTotal(){ return size ?? 0 },
        update(v){
            if(v == value) return; value = v
            sendFollowupNotification('bar.update', id, v)
        },
        stop(){ sendFollowupNotification('bar.stop', id) },
    }
}

export const console_log: typeof localLog = (...args) => {
    if(jsonRpcDisabled) return localLog(...args)
    sendNotification('console.log', ...args)
    logger.log(...args)
}

type JListener = (...args: JSONValue[]) => void
//type ViewListener = (view: View, ...args: JSONValue[]) => void
type View = {
    id?: ListenerId
    subviews: Record<string | number, View>
    listeners: Record<string, JListener>
    handler: Record<string, JListener>
    obj: JSONValue
}
type ViewConfig = {
    path: string
    config?: JSONValue
    subviews?: Record<string | number, View>
    listeners?: Record<string, JListener>
}

export function createView(config: ViewConfig): View {
    let view: View = undefined!
    const handler = new Proxy({}, {
        get(target, p){
            if(typeof p === 'string'){
                return (...args: JSONValue[]) => {
                    sendFollowupNotification(p, view.id!, ...args)
                }
            }
        }
    })
    view = {
        id: undefined,
        subviews: config.subviews ?? {},
        listeners: config.listeners ?? {},
        handler,
        obj: {
            path: config.path,
            config: config.config ?? {},
            subviews: config.subviews ?
                Object.fromEntries(
                    Object.entries(config.subviews)
                        ?.map(([slot, view]) => [slot, view.obj])
                ) : {},
        },
    }
    return view
}

function recursive(view: View, cb: (view: View) => void){
    cb(view)
    for(const subview of Object.values(view.subviews)){
        recursive(subview, cb)
    }
}
export async function render(view: View, opts: Required<AbortOptions>): Promise<JSONValue> {
    //const view = createView(config)
    const deferred = new Deferred<JSONValue>()
    const firstId = sendCall('view', view.obj)
    deferred.addEventListener(opts.signal, 'abort', () => {
        sendFollowupNotification('abort', view.id!)
        deferred.reject(opts.signal?.reason as Error)
    })
    let id = firstId
    recursive(view, view => {
        handlers.set(id, view.listeners)
        view.id = id++
    })
    deferred.addCleanupCallback(() => {
        recursive(view, view => {
            handlers.delete(view.id!)
        })
    })
    view.listeners['resolve'] = (arg) => deferred.resolve(arg)
    view.listeners['reject'] = (arg) => {
        let msg = 'No error message provided'
        let cause: number | undefined
        if(typeof arg === 'object' && arg !== null){
            if('message' in arg && typeof arg['message'] === 'string')
                msg = arg['message']
            if('code' in arg && typeof arg['code'] === 'number')
                cause = arg['code']
        }
        deferred.reject(new Error(msg, { cause }))
    }
    return deferred.promise
}

const godotExe = path.join(downloads, 'Godot_v4.5-stable_win64.exe')
const godotPck = path.join(downloads, 'Godot_v4.5-stable_win64.pck')
export async function repairUIRenderer(opts: Required<AbortOptions>){
    return Promise.all([
        (async () => {
            if(!await fs_exists(godotExe, opts)){
                await fs_copyFile(embedded.godotExe, godotExe, opts)
                await fs_chmod(godotExe, rwx_rx_rx, opts)
            }
        })(),
        (async () => {
            if(!await fs_exists(godotPck, opts)){
                await fs_copyFile(embedded.godotPck, godotPck, opts)
            }
        })(),
    ])
}

type ListenerId = number
const listeners = new Map<ListenerId, (err?: { code?: number, message?: string }, result?: JSONValue) => void>()
const handlers = new Map<ListenerId, Record<string, (...args: JSONValue[]) => void>>()

export async function repairAndStart(opts: Required<AbortOptions>): Promise<boolean> {
    if(!jsonRpcDisabled){
        process.stdin.addListener('data', onData)
    } else if(!guiDisabled){
        if(args.repair.enabled){
            await repairUIRenderer(opts)
        }
        const exeArgs = [
            '--main-pack', godotPck,
            //'--exe', process.execPath,
            //'--exe-args', JSON.stringify(args.toArray()),
            '--log-file', 'godot.log.txt',
            '--', process.execPath, ...args.toArray(),
        ]
        const exeOpts = {
            //log: true, logPrefix: 'GODOT',
            detached: true,
            cwd: downloads,
            //shell: true,
        }
        console.log('Spawning detached process', 0)
        const proc = originalSpawn(godotExe, exeArgs, {
        //const proc = Bun.spawnSync([godotExe, ...exeArgs], {
            ...exeOpts, stdio: ['ignore', 'ignore', 'ignore'],
        })
        proc.unref()
        //await startProcess('GODOT', proc, 'stderr', (chunk) => chunk.includes('Godot Engine started'), opts)
        return true
    }
    return false
}

if(!jsonRpcDisabled)
registerShutdownHandler((force, source) => {
    if(source === 'call')
        sendNotification('exit')
})

export function stop(){
    process.stdin.removeListener('data', onData)
}

type JRPCMessage = JRPCResult | JRPCError | JRPCCall | JRPCNotification
type JRPCResult = { id: number, error: undefined, result: JSONValue }
type JRPCError = { id: number, error: { code: number, message: string }, result: undefined }
type JRPCNotification = { method: string, params?: JSONValue[] }
type JRPCCall = { id: number } & JRPCNotification

function onData(data: Buffer){
    const lines = data.toString('utf8').split('\n')
    for(let line of lines){
        line = line.trim()
        if(line.startsWith('{') && line.endsWith('}')){
            //logger.log(line)
            const obj = JSON.parse(line) as JRPCMessage

            if('id' in obj){
                const handler = handlers.get(obj.id)
                if(handler){
                    if('method' in obj){
                        handler[obj.method]?.(...(obj.params ?? []))
                    } else if(obj.error){
                        handler['reject']?.(obj.error)
                    } else {
                        handler['resolve']?.(obj.result)
                    }
                } else if('method' in obj){
                    //TODO: Global methods
                } else {
                    const listener = listeners.get(obj.id)
                    listener?.(obj.error, obj.result)
                }
            } else {
                //TODO: Notifications
            }
        }
    }
}
