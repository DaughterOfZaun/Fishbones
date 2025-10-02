import type { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from 'child_process'
import type { AbortOptions } from '@libp2p/interface'
import { logger } from './data-shared'
import { console_log } from '../ui/remote'
import { ExitPromptError } from '../ui/remote'
import { spawn as originalSpawn } from 'child_process'
import defer from 'p-defer'
//import { downloads } from './data-fs'

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventCallback = (...args: any[]) => void
interface Emitter {
    addListener: (event: string, callback: EventCallback) => void
    removeListener: (event: string, callback: EventCallback) => void
}

interface EventEmitter {
    addEventListener: (event: string, callback: EventCallback) => void
    removeEventListener: (event: string, callback: EventCallback) => void
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
    callbacks: (() => void)[] = []
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

export async function startProcess(
    logPrefix: string,
    proc: ChildProcess,
    startDetectorStream: 'stdout' | 'stderr',
    startDetector: (chunk: string) => boolean,
    opts: Required<AbortOptions>,
    timeoutMs: number = PROCESS_START_TIMEOUT,
): Promise<void> {
    const deferred = new Deferred<void>(opts)
    deferred.addListener(proc[startDetectorStream].setEncoding('utf8'), 'data', (chunk: string) => {
        if(startDetector(chunk))
            deferred.resolve()
    })
    deferred.addListener(proc, 'error', (err: Error) => deferred.reject(err))
    deferred.addListener(proc, 'exit', <ProcessEventHandler>((code, signal) => {
        const msg = logTerminationMsg(logPrefix, 'died', code, signal)
        deferred.reject(new TerminationError(msg, { cause: { code, signal } }))
    }))
    if(isFinite(timeoutMs))
    deferred.setTimeout(() => {
        deferred.reject(new Error(`${logPrefix} did not start within ${timeoutMs}ms`))
        void killSubprocess(logPrefix, proc, opts) //TODO: Find a better solution.
    }, timeoutMs)
    //TODO: killSubprocess on opts.signal.aborted
    return deferred.promise
}

export async function successfulTermination(loggerPrefix: string, proc: ChildProcess, opts: Required<AbortOptions>, allowedExitCodes = [ 0 ]){
    const deferred = new Deferred<void>(opts)
    deferred.addListener(proc, 'error', (err: Error) => deferred.reject(err))
    deferred.addListener(proc, 'exit', <ProcessEventHandler>((code, signal) => {
        const msg = logTerminationMsg(loggerPrefix, 'exited', code, signal)
        if(!allowedExitCodes.includes(code!))
            deferred.reject(new TerminationError(msg, { cause: { code, signal } }))
        else deferred.resolve()
    }))
    return deferred.promise
}

export async function killSubprocess(loggerPrefix: string, proc: ChildProcess, opts: Required<AbortOptions>){
    const timeoutMs = PROCESS_EXIT_TIMEOUT

    const deferred = new Deferred<void>(opts)
    deferred.addListener(proc, 'exit', <ProcessEventHandler>((code, signal) => {
        logTerminationMsg(loggerPrefix, 'exited', code, signal)
        deferred.resolve()
    }))
    deferred.setTimeout(() => {
        proc.kill('SIGKILL')
        deferred.resolve()
    }, timeoutMs)

    proc.kill('SIGTERM')

    return deferred.promise
}

export const shutdownController = new AbortController()
export const shutdownOptions = { signal: shutdownController.signal }
export const safeOptions = { signal: (new AbortController()).signal }

// Kind of global event bus.
type ShutdownHandler = (force: boolean, source: ShutdownSource) => void | Promise<void>
const shutdownHandlers: ShutdownHandler[] = []
export function registerShutdownHandler(handler: ShutdownHandler){
    shutdownHandlers.push(handler)
}
export const callShutdownHandlers = (force: boolean, source: ShutdownSource) => {
    Promise.allSettled(shutdownHandlers.map(async (handler) => handler(force, source)?.catch(logError))).catch(logError)
    function logError(err: unknown){
        logger.log('An error occurred while calling the shutdown handler:', Bun.inspect(err))
    }
}

const ABORT_ERR = 20
const ERR_UNHANDLED_ERROR = 'ERR_UNHANDLED_ERROR'

//process.on('exit', () => shutdown('event'))
process.on('uncaughtException', (err: Error & { code?: string, context?: Error & { code?: number } }) => {
    if(
        //err.message.startsWith('Unhandled error. (') &&
        //err.message.endsWith(')') &&
        err.code === ERR_UNHANDLED_ERROR &&
        err.context?.code === ABORT_ERR//&&
        //err.context?.name === 'AbortError' &&
        //err.context?.message === 'The operation was aborted.'
    ){ /* Ignore */ } else {
        //const unwrapped = unwrapAbortError(err)
        //if(unwrapped instanceof ExitPromptError){
            //TODO: Investigate.
        //    shutdown('exception')
        //} else {
            console_log('An unexpected exception occurred:', Bun.inspect(err))
            shutdown('exception')
        //}
    }
})

//src: signal-exit/signals.js
const signals = [ 'SIGHUP', 'SIGINT', 'SIGTERM' ]
if (process.platform !== 'win32')
    signals.push('SIGALRM', 'SIGABRT', 'SIGVTALRM', 'SIGXCPU', 'SIGXFSZ', 'SIGUSR2', 'SIGTRAP', 'SIGSYS', 'SIGQUIT', 'SIGIOT')
if (process.platform === 'linux')
    signals.push('SIGIO', 'SIGPOLL', 'SIGPWR', 'SIGSTKFLT');
for(const signal of signals)
    process.on(signal, () => shutdown('signal'))

for(const stream of ['stdin', 'stdout', 'stderr'] as const)
    process[stream].on('close', () => shutdown('call'))

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

type ShutdownSource = 'signal' | 'exception' | 'call' | 'timeout' | 'event'
export function shutdown(source: ShutdownSource){

    const setStage = (to: ShutdownStage) => {
        logger.log(`Shutting down (stage ${to}) due to ${source}`)
        shutdownStage = to
    }

    if(source === 'event'){
        setStage(ShutdownStage.KILL)
        callShutdownHandlers(true, source)
    } else if(shutdownStage === ShutdownStage.NONE){
        if(isInsideUI){
            setStage(ShutdownStage.ABORT)
            setTimeout(() => shutdown('timeout'), ABORT_STAGE_TIMEOUT).unref()
            shutdownController.abort(new ExitPromptError())
        } else {
            setStage(ShutdownStage.TERMINATE)
            setTimeout(() => shutdown('timeout'), TERMINATE_STAGE_TIMEOUT).unref()
            callShutdownHandlers(false, source)
        }
    } else if(source === 'timeout' || source === 'signal'){
        if(shutdownStage === ShutdownStage.ABORT){
            setStage(ShutdownStage.TERMINATE)
            setTimeout(() => shutdown('timeout'), TERMINATE_STAGE_TIMEOUT).unref()
            callShutdownHandlers(false, source)
        } else if(shutdownStage === ShutdownStage.TERMINATE){
            setStage(ShutdownStage.KILL)
            callShutdownHandlers(true, source)
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

export { originalSpawn }
const activeProcesses = new Set<ChildProcess>()
const detachedProcesses = new Set<ChildProcess>()
type SpawnOptions = SpawnOptionsWithoutStdio & { log: boolean, logPrefix: string }
export function spawn(cmd: string, args: readonly string[], opts: SpawnOptions){
    //opts = { cwd: downloads, ...opts }
    const proc = originalSpawn(cmd, args, opts)
    
    if(opts.detached)
    detachedProcesses.add(proc)
    activeProcesses.add(proc)
    proc.on('exit', (code, signal) => {
        logTerminationMsg(opts.logPrefix, 'exited', code, signal)
        detachedProcesses.delete(proc)
        activeProcesses.delete(proc)
    })

    if(opts.log){
        proc.stdout.setEncoding('utf8').on('data', (chunk: string) => onData('[STDOUT]', chunk))
        proc.stderr.setEncoding('utf8').on('data', (chunk: string) => onData('[STDERR]', chunk))
        function onData(src: string, chunk: string){
            chunk = chunk.trim()
            if(chunk) //TODO: [#e69e0c 0B/20MiB(0%) CN:1 SD:0 DL:0B]
                logger.log(opts.logPrefix, src, chunk)
        }
    }

    return Object.assign(proc, { logPrefix: opts.logPrefix })
}

export async function exec(cmd: string, args: string[], opts: SpawnOptions & Required<AbortOptions>){
    const proc = spawn(cmd, args, opts)
    let stdout = '', stderr = ''
    proc.stdout.setEncoding('utf8').on('data', (chunk) => stdout += chunk)
    proc.stderr.setEncoding('utf8').on('data', (chunk) => stderr += chunk)
    await successfulTermination(opts.logPrefix, proc, opts)
    return { stdout, stderr }
}

registerShutdownHandler((force) => {
    for(const proc of activeProcesses.difference(detachedProcesses))
        proc.kill(force ? 'SIGKILL' : 'SIGTERM')
    //detachedProcesses.clear()
    //activeProcesses.clear()
})

export function killIfActive(proc?: ChildProcess){
    if(proc && activeProcesses.has(proc))
        return proc.kill()
    return false
}
