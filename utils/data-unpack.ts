import { type PkgInfo } from './data-packages'
import { logger } from './data-shared'
import { createBar } from '../ui/remote'
import { killIfActive, spawn, successfulTermination, type ChildProcess } from './data-process'
import { rwx_rx_rx, downloads, fs_chmod, fs_copyFile, fs_ensureDir, fs_exists, fs_writeFile, fs_removeFile } from './data-fs'
import type { AbortOptions } from '@libp2p/interface'
import { args } from './args'
import path from 'node:path'

//@ts-expect-error Cannot find module or its corresponding type declarations.
//import s7zExeEmbedded from '../node_modules/7z-bin/bin/linux/x64/7zzs' with { type: 'file' }
import s7zExeEmbedded from '../node_modules/7z-bin/bin/win/x64/7z.exe' with { type: 'file' }
const s7zExe = path.join(downloads, '7z.exe')

//@ts-expect-error Cannot find module or its corresponding type declarations.
import s7zDllEmbedded from '../node_modules/7z-bin/bin/win/x64/7z.dll' with { type: 'file' }
const s7zDll = path.join(downloads, '7z.dll')

export async function repair7z(opts: Required<AbortOptions>){
    try {
        await Promise.all([
            (async () => {
                if(!await fs_exists(s7zExe, opts)){
                    await fs_copyFile(s7zExeEmbedded as string, s7zExe, opts)
                    await fs_chmod(s7zExe, rwx_rx_rx, opts)
                }
            })(),
            (async () => {
                if(s7zDll && s7zDllEmbedded && !await fs_exists(s7zDll, opts))
                    await fs_copyFile(s7zDllEmbedded as string, s7zDll, opts)
            })(),
        ])
    } catch(unk_err){
        const err = unk_err as ErrnoException
        if(err.errno == 32){ /*OK*/ } // The process cannot access the file because it is being used by another process.
        else throw err
    }
}

const s7zDataErrorMsgs = new RegExp(
    [
        /\bHeaders Error\b/,
        /\bData Error\b/,
        /\bCRC Failed\b/,
        /\bIs not archive\b/,
        /\bCan(?: ?not|'?t) open (?:(?:the )?file )?as (?:\[\w+\] )?archive\b/,
        /\bUnexpected end of (?:data|archive|(?:input )?stream)\b/,
        //TODO: ...
    ]
    .map(regex => regex.source).join('|')
)

const s7zProgressMsg = /(\d+)%/m

enum s7zExitCodes {
    Warning = 1,
    FatalError = 2,
    CommandLineError = 7,
    NotEnoughMemoryForOperation = 8,
    UserStoppedTheProcess = 255,
}

let pid = 0

export function appendPartialUnpackFileExt(path: string){
    return `${path}.being-unpacked`
}

export class DataError extends Error {}
export async function unpack(pkg: PkgInfo, opts: Required<AbortOptions>){
    
    if(!args.unpack){
        console.log(`Pretending to unpack ${pkg.zipName}...`)
        return
    }
    
    //console.log(`Unpacking ${pkg.zipName}...`)
    const bar = createBar('Unpacking', pkg.zipName, 100)
    
    const s7zs: (ChildProcess & { logPrefix: string })[] = []

    try {
    
        await fs_ensureDir(pkg.dir, opts)
    
        const lockfile = appendPartialUnpackFileExt(pkg.zip)
        await fs_writeFile(lockfile, '', { ...opts, encoding: 'utf8' })
        
        const controller = new AbortController()
        //const signal = AbortSignal.any([ controller.signal, opts.signal ])
        const { signal } = controller

        const args = ['-aoa', `-o${pkg.dir}`, '-bsp1']
        if(!pkg.noDedup) args.push('-spe')
        
        const spawnOpts = {
            cwd: downloads,
            log: false,
            signal,
        }
        if(pkg.zipExt == '.tar.gz'){
            s7zs[0] = spawn(s7zExe, ['x', '-so', '-tgzip', pkg.zip], {
                stdio: [ null, 'pipe', 'pipe' ],
                logPrefix: `7Z ${pid} ${0}`,
                ...spawnOpts,
            })
            s7zs[1] = spawn(s7zExe, ['x', '-si', '-ttar', ...args], {
                stdio: [ 'pipe', 'pipe', 'pipe' ],
                logPrefix: `7Z ${pid} ${1}`,
                ...spawnOpts,
            })
            s7zs[0].stdout.pipe(s7zs[1].stdin)
        } else {
            s7zs[0] = spawn(s7zExe, ['x', ...args, pkg.zip], {
                logPrefix: `7Z ${pid} ${0}`,
                ...spawnOpts,
            })
        }
        pid++
        
        connect(s7zs.length - 1, 'stdout')
        for(let i = 0; i < s7zs.length; i++)
            connect(i, 'stderr')

        function connect(i: number, src: 'stdout' | 'stderr'){
            const proc = s7zs[i]!
            const logPrefix = `${proc.logPrefix} [${src.toUpperCase()}]`
            proc[src].setEncoding('utf8').on('data', (chunk: string) => {
                onData(logPrefix, src, chunk)
            })
        }

        function onData(loggerPrefix: string, src: 'stdout' | 'stderr', chunk: string){
            chunk = chunk.replace(/[\b]/g, '').trim()
            let m
            if(src === 'stdout' && (m = s7zProgressMsg.exec(chunk)) && m && m[1]){
                bar.update(parseInt(m[1]))
            } else if(chunk){
                logger.log(loggerPrefix, chunk)
            }
            if(src === 'stderr' && !signal.aborted && s7zDataErrorMsgs.test(chunk)){
                //s7zs.at(i)![src]!.removeAllListeners('data')
                controller.abort(new DataError(`Unpacking of "${pkg.zipName}" failed.`))
                logger.log(loggerPrefix, 'ABORTED')
            }
        }

        await Promise.all(s7zs.map(async (proc) => successfulTermination(
            proc.logPrefix, proc, opts, [ 0, s7zExitCodes.Warning ]
        )))
        await fs_removeFile(lockfile, opts)
    
    } finally {
        for(const proc of s7zs) killIfActive(proc)
        bar.update(bar.getTotal())
        bar.stop()
    }
    
    if(!await fs_exists(pkg.checkUnpackBy, opts))
        throw new DataError(`Unable to unpack ${pkg.zipName}`)
}
