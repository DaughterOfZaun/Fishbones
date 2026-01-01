import type { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from 'child_process'
import type { AbortOptions } from '@libp2p/interface'
import { logger } from '../log'
import { console_log, ExitPromptError } from '../../ui/remote/remote'
import { spawn as originalSpawn } from 'child_process'
import { Deferred } from '../promises'
//import { downloads } from './data-fs'
import net from "net"

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
function getTerminationMsg(prefix: string, action: string, code: null|number, signal: null|string){
    let msg = `Process ${action} with code ${code}`
    if(signal) msg += ` by signal ${signal}`
    return msg
}
function logTerminationMsg(prefix: string, action: string, code: null|number, signal: null|string){
    const msg = getTerminationMsg(prefix, action, code, signal)
    logger.log(prefix, msg)
}

type ProcessEventHandler = (code: number | null, signal: NodeJS.Signals | null) => void

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
        const msg = getTerminationMsg(logPrefix, 'died', code, signal)
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
        const msg = getTerminationMsg(loggerPrefix, 'exited', code, signal)
        if(!allowedExitCodes.includes(code!))
            deferred.reject(new TerminationError(msg, { cause: { code, signal } }))
        else deferred.resolve()
    }))
    return deferred.promise
}

export async function killSubprocess(loggerPrefix: string, proc: ChildProcess, opts: Required<AbortOptions>){
    const timeoutMs = PROCESS_EXIT_TIMEOUT

    const deferred = new Deferred<void>(opts)
    deferred.addListener(proc, 'exit', <ProcessEventHandler>((/*code, signal*/) => {
        //logTerminationMsg(loggerPrefix, 'exited', code, signal)
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
type SpawnOptions = SpawnOptionsWithoutStdio & { log: boolean, logPrefix: string, logFilter?: (chunk: string) => string }
export function spawn(cmd: string, args: readonly string[], opts: SpawnOptions){
    logger.log('spawn', cmd, ...args)

    //opts = { cwd: downloads, ...opts }
    const proc = originalSpawn(cmd, args, opts)
    
    if(opts.detached)
    detachedProcesses.add(proc)
    activeProcesses.add(proc)
    proc.on('exit', on.bind(undefined, 'exited'))
    proc.on('error', on.bind(undefined, 'died'))
    function on(event: string, code: number, signal: string){
        logTerminationMsg(opts.logPrefix, event, code, signal)
        detachedProcesses.delete(proc)
        activeProcesses.delete(proc)
    }

    if(opts.log){
        proc.stdout.setEncoding('utf8').on('data', (chunk: string) => onData('[STDOUT]', chunk))
        proc.stderr.setEncoding('utf8').on('data', (chunk: string) => onData('[STDERR]', chunk))
        function onData(src: string, chunk: string){
            if(chunk.length > 0 && opts.logFilter) chunk = opts.logFilter(chunk)
            //if(chunk.length > 0) chunk = chunk.replace(/^\s*\n/gm, '')
            if(chunk.length > 0) chunk = chunk.split('\n').map(line => line.trim()).filter(line => line.length > 0).join('\n')
            if(chunk.length > 0) logger.log(opts.logPrefix, `[${proc.pid}]`, src, chunk)
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

//src: https://stackoverflow.com/a/71178451/30724074
export async function getFreePort(){
    return new Promise<number>((resolve, reject) => {
        const server = net.createServer()
        server.listen(0, () => {
            const { port } = server.address() as net.AddressInfo
            server.close((err) => err ? reject(err) : resolve(port))
        });
    })
}
