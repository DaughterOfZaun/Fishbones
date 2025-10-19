import path from 'node:path'
import {
    WriteStream,
    createWriteStream as fs_createWriteStream,
    mkdirSync as fs_mkdirSync
} from "node:fs"

//export const cwd = process.cwd()
//export const cwd = path.dirname(process.execPath)
export const cwd = path.dirname(process.env.IS_COMPILED ? process.execPath : Bun.main)
export const cwdWin = cwd.replaceAll('/', '\\') // For logger.
export const cwdLin = cwd.replaceAll('\\', '/') // For logger.
export const downloadsDirName = 'Fishbones_Data'
export const downloads = path.join(cwd, downloadsDirName)
fs_ensureDirSync(downloads) //TODO: Fix. Just to be extra sure.

export function fs_ensureDirSync(path: string){
    try {
        fs_mkdirSync(path)
    } catch(unk_err) {
        const err = unk_err as ErrnoException
        if(err.code != 'EEXIST')
            throw err
    }
}

export const logger = new class Logger {
    private stream?: WriteStream
    log(...args: (string | number)[]){
        if(!this.stream){
            //fs_ensureDirSync(downloads)
            const logTxt = path.join(downloads, 'log.txt')
            this.stream = fs_createWriteStream(logTxt, { flags: 'a', autoClose: true })
        }
        this.stream.write(`${Date.now()} ${
            args.join(' ').replace(cwdWin, '.').replaceAll(cwdLin, '.')
        }\n`)
    }
}()
