import { input as localInput, checkbox as localCheckbox } from '@inquirer/prompts'
import { AbortPromptError, ExitPromptError } from '@inquirer/core'
import type { AbortOptions } from '@libp2p/interface'
import type { Context } from '@inquirer/type'
import yoctocolor from 'yoctocolors-cjs'

import { createBar as localBar, console_log as localLog } from '../progress'
import { default as localSelect, type Choice as SelectChoice } from '../inquirer/dynamic-select'
import { default as localSpinner } from '../inquirer/spinner'
import { logger } from '../../utils/log'
import { args } from '../../utils/args'

//import { fs_copyFile } from '../../utils/data/fs'
import { registerShutdownHandler, shutdown } from '../../utils/process/process'
import { Deferred } from '../../utils/promises'
import { listeners, sendCall, sendFollowupNotification, sendNotification, type JSONValue } from './jrpc'
import * as jrpc from './jrpc'

export { type SelectChoice as Choice, AbortPromptError, ExitPromptError }

export const jsonRpcDisabled = !args.jRPCUI.enabled
export const currentExe = args.jRPCUI.value

if(!jsonRpcDisabled){
    jrpc.start()
    let exitRequestedByRemote = false
    jrpc.methods['exit'] = () => {
        exitRequestedByRemote = true
        shutdown('call')
    }
    let shutdownHandlerExecuted = false
    registerShutdownHandler((force, source) => {
        if(!shutdownHandlerExecuted){
            shutdownHandlerExecuted = true
            if(source === 'call' && !exitRequestedByRemote)
                sendNotification('exit')
            jrpc.stop()
        }
    })
}

type InputConfig = Parameters<typeof localInput>[0]
export async function input(config: InputConfig, context?: Context): Promise<string> {
    if(jsonRpcDisabled) return localInput(config, context)
    return remoteInput('input', config, context)
}

export type CheckboxChoice<Value> = Extract<Parameters<typeof localCheckbox<Value>>[0]['choices'][number], { value: Value }>
export type CheckboxConfig<Value> = Omit<Parameters<typeof localCheckbox<Value>>[0], 'choices'> & { choices: CheckboxChoice<Value>[] }
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
    let i
    try {
        i = await promise
    } finally {
        cleanup?.()
    }
    return values[i]!
}

type SpinnerConfig = Parameters<typeof localSpinner>[0]
export async function spinner(config: SpinnerConfig, context?: Context): Promise<unknown> {
    if(jsonRpcDisabled) return localSpinner(config, context)
    return remoteInput('spinner', config, context)
}

export function createSpinner(message: string) {
    const ac = new AbortController()
    spinner({ message }, { signal: ac.signal })
        .catch(() => { /* Ignore */ })
    return {
        stop(){ ac.abort() }
    }
}

//const extractFile: typeof fs_copyFile = async (from, to, opts) => {
export async function extractFile(from: string, to: string, opts: Required<AbortOptions>){
    await remoteInput('copy', { from, to }, opts)
}

export type Notification = {
    title: string
    message: string
    sound: string
}
export function popup(obj: Notification){
    const { title, message, sound } = obj
    sendNotification('popup', title, message, sound)
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
        if(err) deferred.reject(new AbortPromptError({ cause: err }))
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
