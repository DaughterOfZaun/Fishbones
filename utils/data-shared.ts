import path from 'node:path'
import { promises as fs, type PathLike, createWriteStream as fs_createWriteStream } from "node:fs"
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

export async function fs_exists(path: PathLike){
    try {
        await fs.access(path)
        return true
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch(err) {
        return false
    }
}

export async function fs_exists_and_size_eq(path: PathLike, size: number) {
    try {
        const stat = await fs.stat(path)
        //console.log('fs_exists_and_size_eq', path, size, stat.size)
        return stat.size == size
    } catch (unk_err) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const err = unk_err as ErrnoException
        //console.log('fs_exists_and_size_eq', path, size, err.code)
        return false
    }
}

export async function fs_ensure_dir(path: PathLike) {
    try {
        await fs.mkdir(path)
    } catch(unk_err) {
        const err = unk_err as ErrnoException
        if(err.code != 'EEXIST')
            throw err
    }
}

export async function fs_copyFile(src: PathLike, dest: PathLike){
    await fs.writeFile(dest, await fs.readFile(src))
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

export function console_log(...args: (string|number)[]){
    if(multibar.isActive) multibar.log(args.join(' ') + '\n')
    else console.log(...args)
}

export const logger = new class Logger {
    stream = fs_createWriteStream(path.join(downloads, 'log.txt'), { flags: 'a', autoClose: true })
    log(...args: (string | number)[]){
        this.stream.write(`${Date.now()} ${
            args.join(' ').replace(cwdWin, '.').replaceAll(cwdLin, '.')
        }\n`)
    }
}()