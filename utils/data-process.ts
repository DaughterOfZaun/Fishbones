import defer from 'p-defer'
import type { ChildProcess, ChildProcessWithoutNullStreams } from 'child_process'
import type { AbortOptions } from '@libp2p/interface'
import { logger } from './data-shared'
//import type { Readable } from 'stream'
export { spawn } from 'child_process'

export const MAIN_PROCESS_EXIT_TIMEOUT = 10_000
export const PROCESS_START_TIMEOUT = 10_000
export const PROCESS_EXIT_TIMEOUT = 9_000

//type ChildProcessWithStdoutAndStderr = ChildProcessByStdio<null, Readable, Readable>
//export type { ChildProcessWithStdoutAndStderr as ChildProcess }
export type { ChildProcessWithoutNullStreams as ChildProcess }

type TerminationErrorCause = { code: null|number, signal: null|string }
type TerminationErrorOptions = { cause?: TerminationErrorCause }
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
    proc.stdout!.addListener('data', ondata)
    opts.signal!.addEventListener('abort', onabort)
    const timeout = setTimeout(() => {
        deferred.reject(new Error(`${logPrefix} did not start within ${timeoutMs}ms`))
    }, timeoutMs)
    
    return deferred.promise.finally(() => {
        proc.removeListener('exit', onexit)
        proc.stdout!.removeListener('data', ondata)
        opts.signal!.removeEventListener('abort', onabort)
        clearTimeout(timeout)
    })
}

export async function successfulTermination(loggerPrefix: string, proc: ChildProcess, opts: Required<AbortOptions>, allowedExitCodes = [ 0 ]){
    
    const deferred = defer<void>()

    const onerror = (err: Error) => deferred.reject(err)
    const onclose: ProcessEventHandler = (code, signal) => {
        logTerminationMsg(loggerPrefix, 'closed', code, signal)
    }
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
    proc.addListener('close', onclose)
    proc.addListener('exit', onexit)
    
    return deferred.promise.finally(() => {
        opts.signal.removeEventListener('aborted', onabort)
        proc.removeListener('error', onerror)
        proc.removeListener('close', onclose)
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
export const callShutdownHandlers: ShutdownHandler = (force) => {
    Promise.allSettled(shutdownHandlers.map(handler => handler(force)?.catch(err => {
        logger.log('An error occurred while calling the shutdown handler:', Bun.inspect(err))
    })))
}
