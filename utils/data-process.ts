import type { SubProcess } from 'teen_process'
import type { ChildProcess } from 'child_process'
import type { AbortOptions } from '@libp2p/interface'
import { logger } from './data-shared'

type TerminationErrorCause = { code: null|number, signal: null|string }
type TerminationErrorOptions = { cause?: TerminationErrorCause }
export class TerminationError extends Error implements TerminationErrorOptions {
    cause?: TerminationErrorCause
    constructor(msg?: string, options?: TerminationErrorOptions){
        super(msg)
        this.cause = options?.cause
    }
}
export function logTerminationMsg(args: (string|number)[], action: string, code: null|number, signal: null|string){
    let msg = `Process ${action} with code ${code}`
    if(signal) msg += ` by signal ${signal}`
    logger.log(...args, msg)
    return msg
}

export async function startProcess(
    sp: SubProcess,
    loggerArgs: (string|number)[],
    startArgs: Parameters<SubProcess['start']>,
    opts: Required<AbortOptions>,
): Promise<SubProcess | null> {
    let lastError: Error | undefined
    try {
        await Promise.race([
            sp.start(...startArgs),
            new Promise((resolve, reject) => {
                sp.on('die', (code, signal) => {
                    const msg = logTerminationMsg(loggerArgs, 'died', code, signal)
                    reject(new TerminationError(msg, { cause: { code, signal } }))
                })
            })
        ])
    } catch(err) {
        lastError = err as Error
    }

    opts.signal.throwIfAborted()
    
    if(lastError){
        if(lastError instanceof TerminationError)
            return null
        throw lastError
    }
    return sp
}

export function successfulTermination(proc: ChildProcess & { id: number }){
    return new Promise<void>((resolve, reject) => {
        proc.once('error', (err) => reject(err))
        proc.once('close', (code, signal) => {
            logTerminationMsg(['7Z', proc.id], 'closed', code, signal)
        })
        proc.once('exit', (code, signal) => {
            const msg = logTerminationMsg(['7Z', proc.id], 'exited', code, signal)
            if(code === 0) resolve()
            else {
                reject(new TerminationError(msg, { cause: { code, signal } }))
            }
        })
    })
}

export async function killSubprocess(sp: SubProcess, opts: Required<AbortOptions>){
    try {
        await sp.stop('SIGTERM', 4.5 * 1000)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch(err){
        try {
            await sp.stop('SIGKILL', 1)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (err) {
            //TODO: Handle errors
        }
    }
    opts.signal.throwIfAborted()
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
