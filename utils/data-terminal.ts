/*
import path from 'node:path'
import { downloads, fs_copyFile, fs_ensureDir } from "./data-fs"
import embedded from './embedded'

async function repairTerminal(){
    await fs_ensureDir(downloads)
    const minttyExe = path.join(downloads, 'mintty.exe')
    const msysDll = path.join(downloads, 'msys-2.0.dll')
    await Promise.all([
        fs_copyFile(embedded.minttyExe, minttyExe),
        fs_copyFile(embedded.msysDll, msysDll),
    ])
}
*/

import { spawn } from 'child_process'
import figures, { mainSymbols } from '@inquirer/figures'
const isUnicodeSupported = () => figures === mainSymbols

const NO_RELAUNCH_ARG = '--no-relaunch'

export function launchTerminal(){
    if(process.argv.includes(NO_RELAUNCH_ARG)) return false
    else if(isUnicodeSupported()) return false
    else if(process.env['TERM_PROGRAM'] === 'mintty'){
        Object.assign(figures, mainSymbols)
        return false
    }
    
    const exeAndArgs = [ process.execPath, NO_RELAUNCH_ARG, ...process.argv.slice(2) ]
    //spawn(minttyExe, [ '-h', 'always', '-e', exeAndArgs ], { detached: true })//.unref()
    //spawn('CMD.EXE', [ '/U'/*nicode*/, '/Q'/*uet*/, '/D'/*isable Autorun*/, '/K'/*eep*/, exeAndArgs ], { detached: true })
    spawn('START', [ '/MAX', 'CMD.EXE', '/K'/*eep*/, ...exeAndArgs ], { detached: true, shell: true })
    return true
}