import { logger } from '../log'
import { createBar, extractFile } from '../../ui/remote/remote'
import { killIfActive, spawn, successfulTermination, type ChildProcess, type ChildProcessWithLogPrefix } from '../process/process'
import { rwx_rx_rx, downloads, fs_chmod, fs_ensureDir, fs_exists, fs_writeFile, fs_removeFile, fs_moveFile } from './fs'
import type { AbortOptions } from '@libp2p/interface'
import type { ErrnoException } from '../helpers'
import { args } from '../args'
import path from 'node:path'
import embedded from './embedded/embedded'
import { createReadStream as fs_createReadStream } from "node:fs"
import { inspect } from 'node:util'
import { tr } from '../translation'

const s7zExe = path.join(downloads, path.basename(embedded.s7zExe))
//const s7zDll = path.join(downloads, embedded.s7zDll)

export async function repair7z(opts: Required<AbortOptions>){
    try {
        await Promise.all([
            (async () => {
                if(!await fs_exists(s7zExe, opts)){
                    await extractFile(embedded.s7zExe, s7zExe, opts)
                    await fs_chmod(s7zExe, rwx_rx_rx, opts)
                }
            })(),
            //(async () => {
            //    if(s7zDll && embedded.s7zDll && !await fs_exists(s7zDll, opts))
            //        await extractFile(embedded.s7zDll, s7zDll, opts)
            //})(),
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
        /\bCan(?: ?not|'?t) open (?:(?:the )?file )?as (?:\[\w+\] )?archive\b/, //'
        /\bUnexpected end of (?:data|archive|(?:input )?stream)\b/,
        //TODO: ...
    ]
    .map(regex => regex.source).join('|')
)
const s7zSystemErrorMsg = /\bSystem ERROR\b/
const s7zProgressMsg = /(\d+)%/

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
export class SystemError extends Error {}

interface UnpackablePkgInfo {
    zipName: string
    zipExt: string
    zip: string
    checkUnpackBy: string
    zipRoot?: string[]
    zipHasSingleRootEntry?: boolean
    makeDir?: boolean
    dirName?: string
    dir: string
}

export async function unpack(pkg: UnpackablePkgInfo, opts: Required<AbortOptions>){
    const opts_rf = { ...opts, recursive: true, force: true }
    
    if(!args.unpack.value){
        console.log(`Pretending to unpack ${pkg.zipName}...`)
        return
    }
    
    //console.log(`Unpacking ${pkg.zipName}...`)
    const bar = createBar(tr('Unpacking'), pkg.zipName, 100)
    
    const s7zs: ChildProcessWithLogPrefix[] = []

    try {
    
        const pkgDir = pkg.dir
        const zipHasSingleRootEntry = pkg.zipHasSingleRootEntry ?? !pkg.makeDir
        const zipRoot = pkg.zipRoot ?? ((pkg.dirName && !pkg.makeDir) ? [ pkg.dirName! ] : [])

        const TEMP_POSTFIX = '_temp'

        let dirToUnpackTo: string, dirToMove: string, dirToRemove: string | undefined
        if(zipRoot.length == 0){
            dirToUnpackTo = pkgDir
        } else if(zipHasSingleRootEntry && zipRoot.length == 1){
            dirToUnpackTo = path.dirname(pkgDir)
        } else if(zipHasSingleRootEntry && zipRoot.length >= 2 && zipRoot[0] != path.basename(pkgDir)){
            dirToUnpackTo = path.dirname(pkgDir)
            dirToRemove = path.join(dirToUnpackTo, zipRoot[0]!)
        } else {
            dirToUnpackTo = pkgDir + TEMP_POSTFIX
            dirToRemove = dirToUnpackTo
        }
        dirToMove = path.join(dirToUnpackTo, ...zipRoot)

        // logger.log(`
        //     EXTRACTION
        //         pkgDir: ${pkgDir}
        //         zipHasSingleRootEntry: ${zipHasSingleRootEntry}
        //         zipRoot: ${zipRoot}
        //         tmpDir: ${tmpDir}
        //         rootDir: ${rootDir}
        //         tmpDirShouldBeRemoved: ${tmpDirShouldBeRemoved}
        // `.trim())

        await fs_ensureDir(dirToUnpackTo, opts)
    
        const lockfile = appendPartialUnpackFileExt(pkg.zip)
        await fs_writeFile(lockfile, '', { ...opts, encoding: 'utf8' })
        
        const controller = new AbortController()
        //const signal = AbortSignal.any([ controller.signal, opts.signal ])
        const { signal } = controller

        const args = ['-aoa', `-o${dirToUnpackTo}`, '-bsp1']
        
        const spawnOpts = {
            cwd: downloads,
            log: false,
            signal,
        }
        if(pkg.zipExt == 'tar.gz'){
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

        function connect(i: number, streamName: 'stdout' | 'stderr'){
            const proc = s7zs[i]!
            const logPrefix = `${proc.logPrefix} [${streamName.toUpperCase()}]`
            proc[streamName].setEncoding('utf8').on('data', (chunk: string) => {
                onData(logPrefix, streamName, chunk)
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
            if(src === 'stderr' && !signal.aborted){
                const isSystemError = s7zSystemErrorMsg.test(chunk)
                const isDataError = s7zDataErrorMsgs.test(chunk)
                if(isSystemError || isDataError){
                    //s7zs.at(i)![src]!.removeAllListeners('data')
                    const UnpackingError = isDataError ? DataError : SystemError
                    controller.abort(new UnpackingError(`Unpacking of "${pkg.zipName}" failed.`))
                    logger.log(loggerPrefix, 'ABORTED')
                }
            }
        }

        await Promise.all(s7zs.map(async (proc) => successfulTermination(
            proc.logPrefix, proc, opts, [ 0, s7zExitCodes.Warning ]
        )))
        
        if(dirToMove != pkgDir){
            await fs_removeFile(pkgDir, opts_rf, false) //TODO: Be less destructive.
            await fs_moveFile(dirToMove, pkgDir, opts)
        }
        if(dirToRemove){
            await fs_removeFile(dirToRemove, opts_rf, false)
        }
        await fs_removeFile(lockfile, opts)
    
    } finally {
        for(const proc of s7zs) killIfActive(proc)
        bar.update(bar.getTotal())
        bar.stop()
    }
    
    if(!await fs_exists(pkg.checkUnpackBy, opts))
        throw new DataError(`Unable to unpack ${pkg.zipName}`)
}

export function appendPartialPackFileExt(path: string){
    return `${path}.being-packed`
}

//TODO: The file name in the archive must be Fishbones.exe
export async function pack(pkg: { exe: string, exeName: string, zip: string, zipName: string }, opts: Required<AbortOptions>){
    const bar = createBar(tr('Packing'), pkg.zipName, 100)
    const logPrefix = `7Z ${pid} ${0}`

    let archiveSize = 0
    let proc: ChildProcessWithLogPrefix | undefined
    try {

        const lockfile = appendPartialPackFileExt(pkg.zip)
        await fs_writeFile(lockfile, '', { ...opts, encoding: 'utf8' })

        proc = spawn(s7zExe, [ 'a', '-mtm-', '-mtc-', '-mta-', '-bsp1', /*`-si${pkg.exeName}`,*/ pkg.zip, pkg.exe ], {
            stdio: [ 'pipe', 'pipe', 'pipe' ],
            log: false, logPrefix,
            cwd: downloads,
        })
        pid++
        
        fs_createReadStream(pkg.exe).pipe(proc.stdin)

        proc.stdout.setEncoding('utf8').on('data', onData.bind(null, 'stdout'))
        proc.stderr.setEncoding('utf8').on('data', onData.bind(null, 'stderr'))

        await successfulTermination(proc.logPrefix, proc, opts)
        await fs_removeFile(lockfile, opts)

        return archiveSize

    } finally {
        killIfActive(proc)
        bar.stop()
    }

    function onData(src: 'stdout' | 'stderr', chunk: string){
        chunk = chunk.replace(/[\b]/g, '').trim()
        let m
        if((m = /Archive size: (\d+) bytes/.exec(chunk)) && m[1]){
            archiveSize = parseInt(m[1])
        }
        if(src === 'stdout' && (m = s7zProgressMsg.exec(chunk)) && m[1]){
            bar.update(parseInt(m[1]))
        } else if(chunk){
            logger.log(logPrefix, `[${src.toUpperCase()}]`, chunk)
        }
    }
}
