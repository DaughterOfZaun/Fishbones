import defer from 'p-defer'
import type { ChildProcessWithoutNullStreams } from 'child_process'
import type { AbortOptions } from '@libp2p/interface'
import { console_log, logger } from './data-shared'
import { ExitPromptError } from '@inquirer/core'
export { spawn } from 'child_process'

export const ABORT_STAGE_TIMEOUT = 3_000
export const TERMINATE_STAGE_TIMEOUT = 3_000

export const PROCESS_START_TIMEOUT = 10_000
export const PROCESS_EXIT_TIMEOUT = 3_000

//type ChildProcessWithStdoutAndStderr = ChildProcessByStdio<null, Readable, Readable>
//export type { ChildProcessWithStdoutAndStderr as ChildProcess }
export type ChildProcess = ChildProcessWithoutNullStreams

interface TerminationErrorCause { code: null|number, signal: null|string }
interface TerminationErrorOptions { cause?: TerminationErrorCause }
export class TerminationError extends Error implements TerminationErrorOptions {
    cause?: TerminationErrorCause
    constructor(msg?: string, options?: TerminationErrorOptions){
        super(msg)
        this.cause = options?.cause
    }
}
export function logTerminationMsg(prefix: string, action: string, code: null|number, signal: null|string){
    let msg = `Process ${action} with code ${code}`
    if(signal) msg += ` by signal ${signal}`
    logger.log(prefix, msg)
    return msg
}

type ProcessEventHandler = (code: number | null, signal: NodeJS.Signals | null) => void

type EventCallback = (...args: unknown[]) => void
interface Emitter {
    addListener: (event: string, callback: EventCallback) => void
    removeListener: (event: string, callback: EventCallback) => void
}

interface EventEmitter {
    addEventListener: (event: string, callback: EventCallback) => void
    removeEventListener: (event: string, callback: EventCallback) => void
}

class Deferred<T> {
    promise: Promise<T>
    resolve: (value: T) => void
    reject: (err?: Error) => void
    constructor(opts?: Required<AbortOptions>){
        const { promise, resolve, reject } = defer<T>()
        this.promise = promise
        this.resolve = (value) => { this.cleanup(); resolve(value) }
        this.reject = (err) => { this.cleanup(); reject(err) }
        if(opts && opts.signal){
            this.addEventListener(opts.signal, 'abort', () => {
                this.reject(opts.signal.reason as Error)
            })
        }
    }
    listeners: [ Emitter, string, EventCallback ][] = []
    public addListener(obj: Emitter, event: string, callback: EventCallback){
        this.listeners.push([ obj, event, callback ])
        obj.addListener(event, callback)
    }
    eventListeners: [ EventEmitter, string, EventCallback ][] = []
    public addEventListener(obj: EventEmitter, event: string, callback: EventCallback){
        this.eventListeners.push([ obj, event, callback ])
        obj.addEventListener(event, callback)
    }
    timeouts: ReturnType<typeof setTimeout>[] = []
    public setTimeout(callback: () => void, ms: number){
        const timeout = setTimeout(callback, ms)
        this.timeouts.push(timeout)
    }
    private cleanup(){
        for(const [ obj, event, callback ] of this.listeners)
            obj.removeListener(event, callback)
        for(const [ obj, event, callback ] of this.eventListeners)
            obj.removeEventListener(event, callback)
        for(const timeout of this.timeouts)
            clearTimeout(timeout)
    }
}

export async function startProcess(
    logPrefix: string,
    proc: ChildProcess,
    startDetector: (stdout: string) => boolean,
    opts: Required<AbortOptions>,
    timeoutMs: number = PROCESS_START_TIMEOUT,
): Promise<void> {

    const deferred = defer<void>()
    
    const ondata = (chunk: string) => {
        if(startDetector(chunk))
            deferred.resolve()
    }
    const onexit: ProcessEventHandler = (code, signal) => {
        const msg = logTerminationMsg(logPrefix, 'died', code, signal)
        deferred.reject(new TerminationError(msg, { cause: { code, signal } }))
    }
    const onabort = () => {
        deferred.reject(opts.signal.reason)
    }

    proc.addListener('exit', onexit)
    proc.stdout.setEncoding('utf8').addListener('data', ondata)
    opts.signal.addEventListener('abort', onabort)
    const timeout = setTimeout(() => {
        deferred.reject(new Error(`${logPrefix} did not start within ${timeoutMs}ms`))
    }, timeoutMs)
    
    return deferred.promise.finally(() => {
        proc.removeListener('exit', onexit)
        proc.stdout.removeListener('data', ondata)
        opts.signal.removeEventListener('abort', onabort)
        clearTimeout(timeout)
    })
}

export async function successfulTermination(loggerPrefix: string, proc: ChildProcess, opts: Required<AbortOptions>, allowedExitCodes = [ 0 ]){
    
    const deferred = defer<void>()

    const onerror = (err: Error) => deferred.reject(err)
    //const onclose: ProcessEventHandler = (code, signal) => {
    //    logTerminationMsg(loggerPrefix, 'closed', code, signal)
    //}
    const onexit: ProcessEventHandler = (code, signal) => {
        const msg = logTerminationMsg(loggerPrefix, 'exited', code, signal)
        if(!allowedExitCodes.includes(code!))
            deferred.reject(new TerminationError(msg, { cause: { code, signal } }))
        else deferred.resolve()
    }
    const onabort = () => {
        deferred.reject(opts.signal.reason)
    }

    opts.signal.addEventListener('aborted', onabort)
    proc.addListener('error', onerror)
    //proc.addListener('close', onclose)
    proc.addListener('exit', onexit)
    
    return deferred.promise.finally(() => {
        opts.signal.removeEventListener('aborted', onabort)
        proc.removeListener('error', onerror)
        //proc.removeListener('close', onclose)
        proc.removeListener('exit', onexit)
    })
}

export async function killSubprocess(loggerPrefix: string, proc: ChildProcess, opts: Required<AbortOptions>){
    const timeoutMs = PROCESS_EXIT_TIMEOUT

    const deferred = defer<void>()

    const onexit: ProcessEventHandler = (code, signal) => {
        logTerminationMsg(loggerPrefix, 'exited', code, signal)
        deferred.resolve()
    }
    const onabort = () => {
        deferred.reject(opts.signal.reason)
    }

    proc.addListener('exit', onexit)
    opts.signal.addEventListener('abort', onabort)
    const timeout = setTimeout(() => {
        proc.kill('SIGKILL')
        deferred.resolve()
    }, timeoutMs)

    proc.kill('SIGTERM')

    return deferred.promise.finally(() => {
        proc.removeListener('exit', onexit)
        opts.signal.removeEventListener('abort', onabort)
        clearTimeout(timeout)
    })
}

export const shutdownController = new AbortController()
export const shutdownOptions = { signal: shutdownController.signal }
export const safeOptions = { signal: (new AbortController()).signal }

// Kind of global event bus.
type ShutdownHandler = (force: boolean) => void | Promise<void>
const shutdownHandlers: ShutdownHandler[] = []
export function registerShutdownHandler(handler: ShutdownHandler){
    shutdownHandlers.push(handler)
}
export const callShutdownHandlers = (force: boolean) => {
    Promise.allSettled(shutdownHandlers.map(async (handler) => handler(force)?.catch(logError))).catch(logError)
    function logError(err: unknown){
        logger.log('An error occurred while calling the shutdown handler:', Bun.inspect(err))
    }
}

const ABORT_ERR = 20
const ERR_UNHANDLED_ERROR = 'ERR_UNHANDLED_ERROR'

process.on('uncaughtException', (err: Error & { code?: string, context?: Error & { code?: number } }) => {
    if(
        //err.message.startsWith('Unhandled error. (') &&
        //err.message.endsWith(')') &&
        err.code === ERR_UNHANDLED_ERROR &&
        err.context?.code === ABORT_ERR//&&
        //err.context?.name === 'AbortError' &&
        //err.context?.message === 'The operation was aborted.'
    ){ /* Ignore */ } else {
        console_log('An unexpected exception occurred:', Bun.inspect(err))
        shutdown('exception')
    }
})

//src: signal-exit/signals.js
const signals = [ 'SIGHUP', 'SIGINT', 'SIGTERM' ]
if (process.platform !== 'win32')
    signals.push('SIGALRM', 'SIGABRT', 'SIGVTALRM', 'SIGXCPU', 'SIGXFSZ', 'SIGUSR2', 'SIGTRAP', 'SIGSYS', 'SIGQUIT', 'SIGIOT')
if (process.platform === 'linux')
    signals.push('SIGIO', 'SIGPOLL', 'SIGPWR', 'SIGSTKFLT');
for(const signal of signals){
    process.on(signal, () => shutdown('signal'))
}

enum ShutdownStage {
    NONE = 0,
    ABORT = 1,
    TERMINATE = 2,
    KILL = 3,
}
let shutdownStage = ShutdownStage.NONE

let isInsideUI = false
export function setInsideUI(to: boolean){
    isInsideUI = to
}

export function shutdown(source: 'signal' | 'exception' | 'call' | 'timeout'){
    logger.log(`Shutting down (stage ${shutdownStage}) due to ${source}`)

    if(shutdownStage === ShutdownStage.NONE){
        if(isInsideUI){
            shutdownStage = ShutdownStage.ABORT
            setTimeout(() => shutdown('timeout'), ABORT_STAGE_TIMEOUT).unref()
            shutdownController.abort(new ExitPromptError())
        } else {
            shutdownStage = ShutdownStage.TERMINATE
            setTimeout(() => shutdown('timeout'), TERMINATE_STAGE_TIMEOUT).unref()
            callShutdownHandlers(false)
        }
    } else if(source === 'timeout' || source === 'signal'){
        if(shutdownStage === ShutdownStage.ABORT){
            shutdownStage = ShutdownStage.TERMINATE
            setTimeout(() => shutdown('timeout'), TERMINATE_STAGE_TIMEOUT).unref()
            callShutdownHandlers(false)
        } else if(shutdownStage === ShutdownStage.KILL){
            callShutdownHandlers(true)
            process.exit()
        }
    }
}

export function unwrapAbortError(err: unknown){
    //console.log('unwrapAbortError', err.code, err.cause)
    if (typeof err === 'object' && err !== null
    && 'code' in err && err.code === 'ABORT_ERR'
    && 'cause' in err) return err.cause
    else return err
}
