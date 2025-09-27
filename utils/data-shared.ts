import path from 'node:path'
import { createWriteStream as fs_createWriteStream, WriteStream } from "node:fs"
import { cwd, downloads } from './data-fs'

const cwdWin = cwd.replaceAll('/', '\\')
const cwdLin = cwd.replaceAll('\\', '/')

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
