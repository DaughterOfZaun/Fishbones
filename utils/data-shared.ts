import path from 'node:path'
import { promises as fs, createWriteStream as fs_createWriteStream } from "node:fs"
import type { SubProcess } from 'teen_process'
import { MultiBar, Presets } from 'cli-progress'

//export const cwd = process.cwd()
//export const cwd = path.dirname(process.execPath)
const isStandaloneBuild = globalThis.Deno?.build?.standalone //TODO: Bun
export const cwd = isStandaloneBuild ? path.dirname(process.execPath) : process.cwd()
const cwdWin = cwd.replaceAll('/', '\\') // For Logger
const cwdLin = cwd.replaceAll('\\', '/') // For Logger
export const downloads = path.join(cwd, 'Fishbones_Data')
await fs_ensure_dir(downloads) // For Logger

//export const importMetaDirname = path.dirname(import.meta.dirname)
//export const importMetaDirname = `/tmp/deno-compile-index`

export const rwx_rx_rx =
    fs.constants.S_IRUSR | fs.constants.S_IWUSR | fs.constants.S_IXUSR |
    fs.constants.S_IRGRP | fs.constants.S_IXGRP |
    fs.constants.S_IROTH | fs.constants.S_IXOTH

//TODO: Check type (dir/file).
export async function fs_exists(path: string, log = true): Promise<boolean> {
    try {
        await fs.access(path)
        return true
    } catch(err) {
        if(log)
            console_log_fs_err('Checking file existance', path, err)
        return false
    }
}

export async function fs_exists_and_size_eq(path: string, size: number, log = true): Promise<boolean> {
    try {
        const stat = await fs.stat(path)
        if(stat.size == size) return true
        else {
            if(log)
                console_log('File size mismatch:', stat.size, 'vs', size, path)
            return false
        }
    } catch (err) {
        if(log)
            console_log_fs_err('Checking file size', path, err)
        return false
    }
}

export async function fs_ensure_dir(path: string){
    try {
        await fs.mkdir(path)
    } catch(unk_err) {
        const err = unk_err as ErrnoException
        if(err.code != 'EEXIST')
            throw err
    }
}

export async function fs_copyFile(src: string, dest: string){
    await fs.writeFile(dest, await fs.readFile(src))
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function fs_readFile(path: string, encoding?: string, log = true): Promise<string | undefined> {
    try {
        return await fs.readFile(path, 'utf8')
    } catch(err) {
        if(log)
            console_log_fs_err('Opening file', path, err)
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function fs_writeFile(path: string, data: string, encoding?: string, log = true): Promise<boolean> {
    try {
        await fs.writeFile(path, data, 'utf8')
        return true
    } catch(err) {
        if(log)
            console_log_fs_err('Saving file', path, err)
        return false
    }
}

export async function fs_chmod(path: string, mode: number | string, log = true): Promise<boolean> {
    try {
        await fs.chmod(path, mode)
        return true
    } catch(err) {
        if(log)
            console_log_fs_err('Changing file mode', path, err)
        return false
    }
}

export async function fs_moveFile(src: string, dest: string, log = true){
    if(src === dest) return true
    try {
        await fs.rename(src, dest)
        return true
    } catch(err) {
        if(log)
            console_log_fs_err('Moving file', `${src} -> ${dest}`, err)
        return false
    }
}

export async function fs_rmdir(path: string, log = true){
    try {
        await fs.rmdir(path)
        return true
    } catch(err){
        if(log)
            console_log_fs_err('Removing folder', path, err)
        return false
    }
}

const FS_ERR_CODES: Record<string, string> = {
    ENOENT: 'File not found',
}
export async function console_log_fs_err(operation: string, path: string, unk_err: unknown){
    const err = unk_err as ErrnoException
    const desc = (err.code && FS_ERR_CODES[err.code]) ?? 'Unknown'
    console_log(operation, `failed. ${desc}:`, path)
}

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
    ...startArgs: Parameters<SubProcess['start']>
): Promise<SubProcess | null> {
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
        if(err instanceof TerminationError){
            return null
        }
        throw err
    }
    return sp
}

export async function killSubprocess(sp: SubProcess){
    try {
        await sp.stop('SIGTERM', 10 * 1000)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch(err){
        try {
            await sp.stop('SIGKILL', 5 * 1000)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (err) {
            //TODO: Handle errors
        }
    }
}

export const barOpts = {
    stopOnComplete: true,
    clearOnComplete: true,
    hideCursor: true,
    linewrap: true,
    autopadding: false,
    autopaddingChar: ' ',
}
export const multibar = new MultiBar({
    ...barOpts,
    format: '{operation} {filename} |{bar}| {percentage}% | {value}/{total} | {duration_formatted}/{eta_formatted}',
    formatBar(progress, options){
        const partials = [' ', '▏', '▎', '▍', '▌', '▋', '▊', '▉', '█']
        const size = options.barsize!
        const ticks = progress * size
        const filled = Math.floor(ticks)
        const open = size - filled - 1
        let bar = ''
        if(filled > 0) bar += partials.at(-1)!.repeat(filled)
        if(filled < size) bar += partials[Math.round((ticks - filled) * (partials.length - 1))]
        if(open > 0) bar += partials.at(0)!.repeat(open)
        return bar
    },
    formatValue(v, options, type){
        const space = options.autopaddingChar!
        
        if(typeof v != 'number') return v

        if(options.autopadding && type === 'percentage')
            return v.toFixed(0).padStart(3, space)
        
        let str = ''
        if(v >= 999_995_000) str = `${(v / 1_000_000_000).toFixed(2)}G`
        else if(v > 999_995) str = `${(v / 1_000_000).toFixed(2)}M`
        else if(v > 999) str = `${(v / 1_000).toFixed(2)}K`
        else str = v.toFixed(2) + space

        if(options.autopadding)
            str = str.padStart(3 + 1 + 2 + 1, space)
        return str
    }
}, Presets.legacy)

//import { makeTheme, type Theme } from '@inquirer/core'
//const defaultTheme = makeTheme<Theme>();
const defaultTheme = {
    spinner: {
        frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
        interval: 80,
    }
}
export function createInfiniteBar(operation: string, filename: string){
    const bar = multibar.create(1000, 1, { operation, filename }, {
        ...barOpts,
        stopOnComplete: false,
        format: '{bar} {operation} {filename}... {duration_formatted}',
        formatBar(progress){
            const { frames } = defaultTheme.spinner
            return frames[Math.floor(progress * 1000) % frames.length] || 'x'
        }
    })
    const barUpdateInterval = setInterval(() => bar.increment(1), defaultTheme.spinner.interval)
    return {
        stop: () => {
            clearInterval(barUpdateInterval)
            bar.update(bar.getTotal())
            bar.stop()
        }
    }
}

export function console_log(...args: (string | number)[]){
    if(multibar.isActive) multibar.log(args.join(' ') + '\n')
    else console.log(...args)
    logger.log(...args)
}

export const logger = new class Logger {
    stream = fs_createWriteStream(path.join(downloads, 'log.txt'), { flags: 'a', autoClose: true })
    log(...args: (string | number)[]){
        this.stream.write(`${Date.now()} ${
            args.join(' ').replace(cwdWin, '.').replaceAll(cwdLin, '.')
        }\n`)
    }
}()

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
