//import path from 'node:path'
import { promises as fs, Stats, type MakeDirectoryOptions, type RmDirOptions, type RmOptions } from "node:fs"
import type { AbortOptions } from '@libp2p/interface'
import { console_log } from '../../ui/remote/remote'
import { cwd, downloads } from '../log'
export { cwd, downloads }
import { tr } from "../translation"
import path from 'node:path'

export const rwx_rx_rx =
    fs.constants.S_IRUSR | fs.constants.S_IWUSR | fs.constants.S_IXUSR |
    fs.constants.S_IRGRP | fs.constants.S_IXGRP |
    fs.constants.S_IROTH | fs.constants.S_IXOTH

//TODO: function tryAndCatch<T>(initial: T, func: () => T, opts: Required<AbortOptions>, log = true, rethrow = false, allowed = [ 'EEXIST' ]): T {}

//TODO: Check type (dir/file).
export async function fs_exists(path: string, opts: Required<AbortOptions>, log = true): Promise<boolean> {
    let result = false
    try {
        await fs.access(path)
        result = true
    } catch(err) {
        if(log)
            console_log_fs_err(tr('Checking file existance failed', {}), path, err)
    }
    opts.signal.throwIfAborted()
    return result
}

export async function fs_exists_and_size_eq(path: string, size: number, opts: Required<AbortOptions>, log = true): Promise<boolean> {
    let result = false
    try {
        const stat = await fs.stat(path)
        result = stat.size == size
        if(!result && log){
            console_log(tr(`File size mismatch`, {}) + ` (${stat.size} vs ${size}):\n${path}`)
        }
    } catch (err) {
        if(log)
            console_log_fs_err(tr('Checking file size failed', {}), path, err)
    }
    opts.signal.throwIfAborted()
    return result
}

//type MakeDirectoryOptions = Parameters<(typeof fs)['mkdir']>[1]
export async function fs_ensureDir(path: string, opts: MakeDirectoryOptions & Required<AbortOptions>){
    if(opts.recursive !== false) opts.recursive = true
    try {
        await fs.mkdir(path, opts)
    } catch(unk_err) {
        const err = unk_err as ErrnoException
        if(err.code != 'EEXIST')
            throw err
    }
    opts.signal.throwIfAborted()
}

//TODO: { rethrow?: true } ?
//export async function fs_copyFile(src: string, dest: string, opts: Required<AbortOptions>){
//    //const bytes = await fs.readFile(src)
//    const srcName = path.basename(src)
//    const bytes = await Bun.embeddedFiles.find(
//        blob => 'name' in blob && blob.name === srcName
//    )!.bytes() //HACK: Walkaround
//    await fs.writeFile(dest, bytes)
//    opts.signal.throwIfAborted()
//}

export async function fs_copyFile(src: string, dest: string, opts: Required<AbortOptions>, log = true){
    let result = false
    try {
        await fs.copyFile(src, dest)
        result = true
    } catch(err) {
        if(log)
            console_log_fs_err(tr('Copying file failed', {}), `${src} -> ${dest}`, err)
    }
    opts.signal.throwIfAborted()
    return result
}

export type TextBufferEncoding = 'utf8' | 'base64'
export type ReadWriteFileOpts = /*TextBufferEncoding |*/ { encoding: TextBufferEncoding, rethrow?: boolean } & Required<AbortOptions>
export async function fs_readFile(path: string, opts: ReadWriteFileOpts, log = true): Promise<string | undefined> {
    let result = undefined
    try {
        result = await fs.readFile(path, opts.encoding)
    } catch(err) {
        if(log)
            console_log_fs_err(tr('Opening file failed', {}), path, err)
        if(opts.rethrow)
            throw err
    }
    opts.signal.throwIfAborted()
    return result
}

export async function fs_writeFile(path: string, data: string, opts: ReadWriteFileOpts, log = true): Promise<boolean> {
    let result = false
    try {
        await fs.writeFile(path, data, opts.encoding)
        result = true
    } catch(err) {
        if(log)
            console_log_fs_err(tr('Saving file failed', {}), path, err)
        if(opts.rethrow)
            throw err
    }
    opts.signal.throwIfAborted()
    return result
}

export async function fs_chmod(path: string, mode: number | string, opts: Required<AbortOptions>, log = true): Promise<boolean> {
    let result = false
    try {
        await fs.chmod(path, mode)
        result = true
    } catch(err) {
        if(log)
            console_log_fs_err(tr('Changing file mode failed', {}), path, err)
    }
    opts.signal.throwIfAborted()
    return result
}

export async function fs_moveFile(src: string, dest: string, opts: Required<AbortOptions>, log = true){
    if(src === dest) return true
    let result = false
    try {
        await fs.rename(src, dest)
        result = true
    } catch(err) {
        if(log)
            console_log_fs_err(tr('Moving file failed', {}), `${src} -> ${dest}`, err)
    }
    opts.signal.throwIfAborted()
    return result
}

export async function fs_rmdir(path: string, opts: RmDirOptions & Required<AbortOptions>, log = true){
    let result = false
    try {
        await fs.rmdir(path, opts)
        result = true
    } catch(err){
        if(log)
            console_log_fs_err(tr('Removing folder failed', {}), path, err)
    }
    opts.signal.throwIfAborted()
    return result
}

export async function fs_removeFile(path: string, opts: RmOptions & Required<AbortOptions>, log = true){
    let result = false
    try {
        await fs.rm(path)
        result = true
    } catch(err){
        if(log)
            console_log_fs_err(tr('Removing file failed', {}), path, err)
    }
    opts.signal.throwIfAborted()
    return result
}

export async function fs_truncate(path: string, len: number, opts: Required<AbortOptions>, log = true){
    let result = false
    try {
        await fs.truncate(path, len)
        result = true
    } catch(err){
        if(log)
            console_log_fs_err(tr('Resizing file failed', {}), path, err)
    }
    opts.signal.throwIfAborted()
    return result
}

const FS_ERR_CODES: Record<string, string> = {
    ENOENT: tr('File not found', {}),
}
export function console_log_fs_err(operationFailed: string, path: string, unk_err: unknown){
    const err = unk_err as ErrnoException
    const desc = err.code ? (FS_ERR_CODES[err.code] ?? tr('Code', {}) + `: ${err.code}`) : tr('Unknown', {})
    console_log(`${operationFailed}. ${desc}:\n${path}`)
}

export type ReadDirOpts = { withFileTypes?: true } & Required<AbortOptions>
export async function fs_readdir(path: string, opts: ReadDirOpts, log = true){
    let result: string[] = []
    try {
        result = await fs.readdir(path)
    } catch(err){
        if(log)
            console_log_fs_err(tr('Reading directory failed', {}), path, err)
    }
    opts.signal.throwIfAborted()
    return result
}

export async function fs_stat(path: string, opts: Required<AbortOptions>, log = true){
    let result: Stats | undefined
    try {
        result = await fs.stat(path)
    } catch(err){
        if(log)
            console_log_fs_err(tr('Reading file stats failed', {}), path, err)
    }
    opts.signal.throwIfAborted()
    return result
}

export async function fs_stat_if_exists(dest: string){
    let destStats: Stats | undefined = undefined
    try {
        destStats = await fs.stat(dest)
    } catch(unk_err) {
        const err = unk_err as ErrnoException
        if(err.code != 'ENOENT')
            throw err
    }
    return destStats
}

export async function fs_readdir_if_is_dir(src: string){
    let entries: string[] | undefined = undefined
    try {
       entries = await fs.readdir(src)
    } catch(unk_err) {
        const err = unk_err as ErrnoException
        if(err.code != 'ENOTDIR')
            throw err
    }
    return entries
}

//TODO: Optimize number of syscalls.
export async function fs_overwrite(src: string, dest: string, opts: Required<AbortOptions>){

    const destStats = await fs_stat_if_exists(dest)
    const srcEntries = await fs_readdir_if_is_dir(src)

    const srcIsDir = srcEntries !== undefined
    const destExists = destStats !== undefined
    const destIsDir = destStats?.isDirectory() ?? false

    if(!destExists || !srcIsDir && !destIsDir){
        await fs.rename(src, dest)
    } else if(srcIsDir && destIsDir){
        await Promise.all(srcEntries.map(async entry => {
            return fs_overwrite(path.join(src, entry), path.join(dest, entry), opts)
        }))
    } else {
        throw new Error('An attempt to overwrite a file with a dir or a dir with a file.')
    }
}
