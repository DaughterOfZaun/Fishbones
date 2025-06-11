import type { ChildProcess } from 'child_process'
import { promises as fs } from "node:fs"
import { spawn } from 'teen_process'
import { type PkgInfo } from './data-packages'
import { barOpts, downloads, fs_copyFile, fs_ensure_dir, fs_exists, logger, logTerminationMsg, multibar, rwx_rx_rx, TerminationError } from './data-shared'
import path from 'node:path'

/*
const s7zBinEmbded = path.join(importMetaDirname, 'node_modules', '7z-bin', 'bin')
let s7zExeEmbded: string
let s7zExe: string
let s7zDllEmbded: undefined | string
let s7zDll: undefined | string

if (process.platform === "win32") {
    if(!['arm64', 'ia32', 'x64'].includes(process.arch))
        throw new Error(`Unsupported arch: ${process.arch}`)
    const s7zExeName = '7z.exe'
    const s7zDllName = '7z.dll'
    const s7zBinWinArch = path.join(s7zBinEmbded, 'win', process.arch)
    s7zExeEmbded = path.join(s7zBinWinArch, s7zExeName)
    s7zDllEmbded = path.join(s7zBinWinArch, s7zDllName)
    s7zExe = path.join(downloads, s7zExeName)
    s7zDll = path.join(downloads, s7zDllName)
} else if (process.platform === "darwin") {
    const s7zExeName = '7zz'
    s7zExeEmbded = path.join(s7zBinEmbded, 'mac', s7zExeName)
    s7zExe = path.join(downloads, s7zExeName)
} else if (process.platform === "linux"){
    if(!['arm', 'arm64', 'ia32', 'x64'].includes(process.arch))
        throw new Error(`Unsupported arch: ${process.arch}`)
    const s7zExeName = '7zzs'
    s7zExeEmbded = path.join(s7zBinEmbded, 'linux', process.arch, s7zExeName)
    s7zExe = path.join(downloads, s7zExeName)
} else {
    throw new Error(`Unsupported platform: ${process.platform}`)
}
*/

//@ts-expect-error Cannot find module or its corresponding type declarations.
//import s7zExeEmbded from '../node_modules/7z-bin/bin/linux/x64/7zzs' with { type: 'file' }
import s7zExeEmbded from '../node_modules/7z-bin/bin/win/x64/7z.exe' with { type: 'file' }
const s7zExe = path.join(downloads, '7z.exe')

//@ts-expect-error Cannot find module or its corresponding type declarations.
import s7zDllEmbded from '../node_modules/7z-bin/bin/win/x64/7z.dll' with { type: 'file' }
const s7zDll = path.join(downloads, '7z.dll')
//const s7zDllEmbded = undefined
//const s7zDll = undefined

export async function repair7z(){
    try {
        await Promise.all([
            (async () => {
                //if(fs_exists(s7zExe)) return
                await fs_copyFile(s7zExeEmbded, s7zExe)
                await fs.chmod(s7zExe, rwx_rx_rx)
            })(),
            (async () => {
                //if(fs_exists(s7zDll)) return
                if(s7zDll && s7zDllEmbded)
                await fs_copyFile(s7zDllEmbded, s7zDll)
            })(),
        ])
    } catch(unk_err){
        const err = unk_err as ErrnoException
        if(err.errno == 32){ /*OK*/ } // The process cannot access the file because it is being used by another process.
        else throw err
    }
}

function successfulTermination(proc: ChildProcess & { id: number }){
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

const s7zDataErrorMsgs = [
    /\bHeaders Error\b/,
    /\bData Error\b/,
    /\bCRC Failed\b/,
    /\bIs not archive\b/,
    /\bCan(?: ?not|'?t) open (?:(?:the )?file )?as (?:\[\w+\] )?archive\b/,
    /\bUnexpected end of (?:data|archive|(?:input )?stream)\b/,
    //TODO: ...
]

const s7zProgressMsg = /(\d+)%/m

enum s7zExitCodes {
    Warning = 1,
    FatalError = 2,
    CommandLineError = 7,
    NotEnoughMemoryForOperation = 8,
    UserStoppedTheProcess = 255,
}

let pid = 0
export class DataError extends Error {}
export async function unpack(pkg: PkgInfo){
    //console.log(`Unpacking ${pkg.zipName}...`)
    const bar = multibar.create(100, 0, { operation: 'Unpacking', filename: pkg.zipName }, barOpts)
    
    await fs_ensure_dir(pkg.dir)
    
    const controller = new AbortController();
    const { signal } = controller;

    const opts = ['-aoa', `-o${pkg.dir}`, '-bsp1']
    if(!pkg.noDedup) opts.push('-spe')
    
    const s7zs: (ChildProcess & { id: number })[] = []

    if(pkg.zipExt == '.tar.gz'){
        s7zs[0] = Object.assign(spawn(s7zExe, ['x', '-so', '-tgzip', pkg.zip], {
            stdio: [ 'inherit', 'pipe', 'pipe' ], signal
        }), { id: pid })
        s7zs[1] = Object.assign(spawn(s7zExe, ['x', '-si', '-ttar', ...opts], {
            stdio: [ 'pipe', 'pipe', 'pipe' ], signal
        }), { id: pid })
        s7zs[0].stdout!.pipe(s7zs[1].stdin!)
        pid++
    } else {
        s7zs[0] = Object.assign(spawn(s7zExe, (['x', ...opts, pkg.zip])), { id: pid++ })
    }

    if(s7zs.length > 1)
    s7zs.at(+0)!.stderr!.setEncoding('utf8').addListener('data', (chunk) => onData(+0, '[STDERR]', chunk))
    s7zs.at(-1)!.stdout!.setEncoding('utf8').addListener('data', (chunk) => onData(-1, '[STDOUT]', chunk))
    s7zs.at(-1)!.stderr!.setEncoding('utf8').addListener('data', (chunk) => onData(-1, '[STDERR]', chunk))
    function onData(i: number, src: '[STDOUT]' | '[STDERR]', chunk: string){
        chunk = chunk.replace(/[\b]/g, '').trim()
        const args = [`7Z`, pid, i, src]
        logger.log(...args, chunk)
        if(!signal.aborted){
            if(src === '[STDOUT]'){
                const m = s7zProgressMsg.exec(chunk)
                if(m && m[1]) bar.update(parseInt(m[1]))
            } else if(src === '[STDERR]' && s7zDataErrorMsgs.some(msg => msg.test(chunk))){
                //s7zs.at(i)![src]!.removeAllListeners('data')
                controller.abort(new DataError())
                logger.log(...args, 'abort')
            }
        }
    }

    try {
        await /*Promise.race([*/
            Promise.all(s7zs.map(s7zi => successfulTermination(s7zi)))
                .then(() => bar.update(100))/*,
            new Promise((resolve, reject) => {
                signal.addEventListener('abort', () => {
                    reject(signal.reason)
                })
            }),
        ])*/
    } catch(err) {
        if(err instanceof DataError) throw err
        if(err instanceof Error && err.name === 'AbortError'){
            throw signal.reason
        } else if(err instanceof TerminationError){
            if(err.cause?.code === s7zExitCodes.Warning){ /*OK*/ }
            else throw err
        } else throw err
    } finally {
        bar.stop()
    }
    
    if(!await fs_exists(pkg.checkUnpackBy))
        throw new Error(`Unable to unpack ${pkg.zipName}`)
}
