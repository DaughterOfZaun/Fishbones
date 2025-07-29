import path from 'node:path'
import { downloads, fs_copyFile, fs_ensure_dir } from "./data-shared"
import { spawn } from 'child_process'

//@ts-expect-error Cannot find module or its corresponding type declarations.
import minttyExeEmbded from '../thirdparty/mintty-msys2/mintty.exe' with { type: 'file' }
//@ts-expect-error Cannot find module or its corresponding type declarations.
import msysDllEmbded from '../thirdparty/mintty-msys2/msys-2.0.dll' with { type: 'file' }

export async function launchTerminal(){
    if(process.env['TERM_PROGRAM']) return false
    await fs_ensure_dir(downloads)
    const minttyExe = path.join(downloads, 'mintty.exe')
    const msysDll = path.join(downloads, 'msys-2.0.dll')
    await Promise.all([
        fs_copyFile(minttyExeEmbded, minttyExe),
        fs_copyFile(msysDllEmbded, msysDll),
    ])
    spawn(minttyExe, [
        //'-h', 'always',
        '-e', process.execPath, ...process.argv.slice(2),
    ], {
        detached: true,
    })
    return true
}