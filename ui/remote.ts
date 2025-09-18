import { input as localInput, checkbox as localCheckbox } from '@inquirer/prompts'
import { AbortPromptError, ExitPromptError } from '@inquirer/core'
import type { Context } from '@inquirer/type'
import yoctocolor from 'yoctocolors-cjs'

import { createBar as localBar, console_log as localLog } from './progress'
import { default as localSelect, type Choice } from './dynamic-select'
import { default as localSpinner } from './spinner'

//import path from 'node:path'
//import { downloads, fs_chmod, fs_copyFile, fs_exists, rwx_rx_rx } from '../utils/data-fs'
import { Deferred, registerShutdownHandler } from '../utils/data-process'
//import type { AbortOptions } from '@libp2p/interface'

export { type Choice, AbortPromptError, ExitPromptError }

type JSONPrimitive = string | number | boolean | null | undefined
type JSONValue = JSONPrimitive | JSONValue[] | { [key: string]: JSONValue }

const JSONRPC_GUI_ARG = "--jsonrpc-gui"
const jsonRpcDisabled = !process.argv.includes(JSONRPC_GUI_ARG)
//const jsonRpcDisabled = false

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

type CheckboxConfig<Value> = Omit<Parameters<typeof localCheckbox<Value>>[0], 'choices'> & { choices: Choice<Value>[] }
export async function checkbox<Value>(config: CheckboxConfig<Value>, context?: Context): Promise<Value[]> {
    if(jsonRpcDisabled) return localCheckbox<Value>(config, context)

    const values = config.choices.map(choice => choice.value)
    const choices = config.choices.map((choice, i) => ({ ...choice, value: i }))
    const is: number[] = await remoteInput('checkbox', { ...config, choices }, context)

    return is.map(i => values[i]!)
}

type SelectConfig<Value> = Omit<Parameters<typeof localSelect<Value>>[0], 'choices'> & { choices: Choice<Value>[] }
export async function select<Value>(config: SelectConfig<Value>, context?: Context): Promise<Value> {
    if(jsonRpcDisabled) return localSelect<Value>(config, context)
    
    const values = config.choices.map(choice => choice.value)
    const choices = config.choices.map((choice, i) => ({ ...choice, value: i }))
    const i: number = await remoteInput('select', { ...config, choices }, context)
    
    return values[i]!
}

type SpinnerConfig = Parameters<typeof localSpinner>[0]
export async function spinner(config: SpinnerConfig, context?: Context): Promise<unknown> {
    if(jsonRpcDisabled) return localSpinner(config, context)
    return remoteInput('spinner', config, context)
}

type CancellablePromise<Value> = Promise<Value> //& { cancel: () => void }
type RemoteInputFuncName = 'spinner' | 'select' | 'checkbox' | 'input'
async function remoteInput<Value extends JSONValue, Config>(name: RemoteInputFuncName, config: Config, context?: Context): CancellablePromise<Value> {
    
    if(context?.signal?.aborted)
        return Promise.reject(new AbortPromptError({ cause: context.signal.reason }))

    const deferred = new Deferred<Value>()
    
    const id = sendCall(name, {
        ...config, clearPromptOnDone: context?.clearPromptOnDone,
    })

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
    name = name.replace('Bright', '') as ColorName
    return `[color=${name}]${text}[/color]`
}

interface SimpleBar {
    getTotal(): number
    update(v: number): void
    stop(): void
}
export const createBar = (operation: string, filename: string, size?: number): SimpleBar => {
    if(jsonRpcDisabled) return localBar(operation, filename, size)
    const id = sendCall('bar.create', operation, filename, size)
    return {
        getTotal(){ return size ?? 0 },
        update(v){ sendFollowupNotification('bar.update', id, v) },
        stop(){ sendFollowupNotification('bar.stop', id) },
    }
}

export const console_log: typeof localLog = (...args) => {
    if(jsonRpcDisabled) return localLog(...args)
    sendNotification('console.log', ...args)
}
/*
//@ts-expect-error Cannot find module or its corresponding type declarations.
import godotExeEmbded from '/home/user/.local/share/godot/export_templates/4.5.rc1/linux_release.x86_64' with { type: 'file' }
//@ts-expect-error Cannot find module or its corresponding type declarations.
import godotPckEmbded from '../dist/RemoteUI.zip' with { type: 'file' }

const godotExe = path.join(downloads, 'godot.exe')
const godotPck = path.join(downloads, 'RemoteUI.zip')
export async function repairUIRenderer(opts: Required<AbortOptions>){
    return Promise.all([
        (async () => {
            if(!await fs_exists(godotExe, opts)){
                await fs_copyFile(godotExeEmbded as string, godotExe, opts)
                await fs_chmod(godotExe, rwx_rx_rx, opts)
            }
        })(),
        (async () => {
            if(!await fs_exists(godotPck, opts)){
                await fs_copyFile(godotPckEmbded as string, godotPck, opts)
            }
        })(),
    ])
}
*/
const listeners = new Map<number, (err?: { code?: number, message?: string }, result?: JSONValue) => void>()
export function start(): boolean {
    if(jsonRpcDisabled){
        return false
        /*
        //TODO: Pass --exe ${current process path} and its args.
        spawn(godotExe, [ '--main-pack', godotPck ], {
            log: false, logPrefix: 'GODOT',
            detached: true,
            cwd: downloads,
        })
        return true
        */
    } else {
        process.stdin.addListener('data', onData)
        return false
    }
}

if(!jsonRpcDisabled)
registerShutdownHandler(() => {
    sendNotification('exit')
})

export function stop(){
    process.stdin.removeListener('data', onData)
}

type JRPCResponse =
    { id: number, error: { code: number, message: string }, result: undefined } |
    { id: number, error: undefined, result: JSONValue }
//type JRPCRequest = { id?: number, method: string, params: JSONValue[] }
//type JSONRPCMessage = JRPCResponse | JRPCRequest

function onData(data: Buffer){
    const lines = data.toString('utf8').split('\n')
    for(let line of lines){
        line = line.trim()
        if(line.startsWith('{') && line.endsWith('}')){
            const obj = JSON.parse(line) as JRPCResponse
            if(typeof obj.id === 'number'){
                const listener = listeners.get(obj.id)
                listener?.(obj.error, obj.result)
            }
        }
    }
}
