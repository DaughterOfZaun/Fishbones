import { spawn } from 'teen_process'
import { promises as fs } from "node:fs"
import { path7z } from '7z-bin'
import type { ChildProcess } from 'child_process'

import { fs_exists, rwx_rx_rx } from './data-shared'
import type { PkgInfo } from './data-packages'

type TerminationErrorCause = { code: null|number, signal: null|string }
type TerminationErrorOptions = { cause?: TerminationErrorCause }
class TerminationError extends Error implements TerminationErrorOptions {
    cause?: TerminationErrorCause
    constructor(msg: string, options?: TerminationErrorOptions){
        super(msg)
        this.cause = options?.cause
    }
}
function successfulTermination(proc: ChildProcess){
    return new Promise<void>((resolve, reject) => {
        proc.on('error', (err) => reject(err))
        proc.on('exit', (code: null|number, signal: null|string) => {

            let msg = `Process exited with code ${code}`
            if(signal) msg += ` by signal ${signal}`
            console.log(msg)

            if(code === 0) resolve()
            else {    
                reject(new TerminationError(msg, { cause: { code, signal } }))
            }
        })
    })
}

const s7zDataErrorMsgs = [
    /\bData Error\b/,
    /\bCRC Failed\b/,
    /\bIs not archive\b/,
    /\bCan(?: ?not|'?t) open (?:the )?file as archive\b/,
    /\bUnexpected end of (?:data|archive|(?:input )?stream)\b/,
    //TODO: ...
]

enum s7zExitCodes {
    Warning = 1,
    FatalError = 2,
    CommandLineError = 7,
    NotEnoughMemoryForOperation = 8,
    UserStoppedTheProcess = 255,
}

export class DataError extends Error {}
export async function unpack(pkg: PkgInfo){
    console.log(`Unpacking ${pkg.zipName}...`)

    try {
        await fs.mkdir(pkg.dir)
    } catch(unk_err) {
        const err = unk_err as ErrnoException
        if(err.code != 'EEXIST')
            throw err
    }
    
    const controller = new AbortController();
    const { signal } = controller;

    const opts = ['-aoa', `-o${pkg.dir}`, '-bsp2']
    if(!pkg.noDedup) opts.push('-spe')
    
    const s7zs: ChildProcess[] = []

    if(pkg.zipExt == '.tar.gz'){
        s7zs[0] = spawn(path7z, ['x', '-so', '-tgzip', pkg.zip], {
            stdio: [ 'inherit', 'pipe', 'pipe' ], signal
        })
        s7zs[1] = spawn(path7z, ['x', '-si', '-ttar', ...opts], {
            stdio: [ 'pipe', 'pipe', 'pipe' ], signal
        })
        s7zs[0].stdout!.pipe(s7zs[1].stdin!)
    } else {
        s7zs[0] = spawn(path7z, (['x', ...opts, pkg.zip]))
    }

    s7zs.at(-1)!.stdout!.setEncoding('utf8').addListener('data', (chunk) => onData(-1, 'stdout', chunk))
    s7zs.at(-1)!.stderr!.setEncoding('utf8').addListener('data', (chunk) => onData(-1, 'stderr', chunk))
    function onData(i: number, src: 'stdout' | 'stderr', chunk: string){
        console.log(`s7zs[${i}]`, src, chunk)
        if(s7zDataErrorMsgs.some(msg => msg.test(chunk))){
            s7zs.at(i)![src]!.removeAllListeners('data')
            controller.abort(new DataError())
            console.log('abort')
        }
    }

    try {
        await Promise.race([
            Promise.all(s7zs.map(s7zi => successfulTermination(s7zi))),
            new Promise((resolve, reject) => {
                signal.addEventListener('abort', () => {
                    reject(signal.reason)
                })
            }),
        ])
    } catch(err) {
        if(err instanceof DataError) throw err
        else if(err instanceof TerminationError){
            if(err.cause?.code === s7zExitCodes.Warning){ /*OK*/ }
            else throw err
        } else throw err
    }
    
    if(!await fs_exists(pkg.checkUnpackBy))
        throw new Error(`Unable to unpack ${pkg.zipName}`)
}

export async function repair7z(){
    await fs.chmod(path7z, rwx_rx_rx)
}
