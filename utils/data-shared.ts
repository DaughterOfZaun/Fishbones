import path from 'node:path'
import { promises as fs, type PathLike } from "node:fs"
import type { SubProcess } from 'teen_process'
import { MultiBar, Presets } from 'cli-progress'

export const cwd = process.cwd()
export const downloads = path.join(cwd, 'downloads')

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

export const multibar = new MultiBar({
    format: '{filename} [{bar}] {percentage}% | {value}/{total} | {duration_formatted}/{eta_formatted}',
    //clearOnComplete: false,
    //hideCursor: true,
}, Presets.legacy);
