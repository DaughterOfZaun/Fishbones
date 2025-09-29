import { gcPkg } from "./data-packages"
import { sanitize_bfkey } from "./constants"
import { killSubprocess, spawn, startProcess, type ChildProcess } from "./data-process"
import type { AbortOptions } from "@libp2p/interface"

const LOG_PREFIX = 'CLIENT'

let clientSubprocess: ChildProcess | undefined

let launchArgs: [ ip: string, port: number, key: string, clientId: number ] | undefined
export async function launchClient(ip: string, port: number, key: string, clientId: number, opts: Required<AbortOptions>){
    launchArgs = [ip, port, key, clientId]
    return await relaunchClient(opts)
}
export async function relaunchClient(opts: Required<AbortOptions>){
    const [ip, port, key, clientId] = launchArgs!

    const gcArgs = ['', '', '', ([ip, port.toString(), sanitize_bfkey(key), clientId.toString()]).join(' ')]
    const gcArgsStr = gcArgs.map(a => `"${a}"`).join(' ')
    //console.log('%s %s', gcPkg.exe, gcArgsStr)
    //logger.log('%s %s', gcPkg.exe, gcArgsStr)

    await stopClient(opts)

    const spawnOpts = {
        logPrefix: LOG_PREFIX,
        //signal: opts.signal,
        cwd: gcPkg.exeDir,
        log: true,
    }
    if(process.platform == 'win32'){
        clientSubprocess = spawn(gcPkg.exe, gcArgs, spawnOpts)
    } else if(process.platform == 'linux'){
        //console.log('flatpak', 'run', '--command=bottles-cli', 'com.usebottles.bottles', 'run', '-b', 'DeusEx', '-e', gcPkg.exe, gcArgsStr)
        clientSubprocess = spawn(
            'flatpak', [ 'run', '--command=bottles-cli', 'com.usebottles.bottles',
                'run', '-b', 'DeusEx', '-e', gcPkg.exe, gcArgsStr ], spawnOpts) //TODO: cwd
        //clientSubprocess = spawn('bottles-cli', ['run', '-b', 'DeusEx', '-p', 'League of Legends', '--args-replace', gcArgs], spawnOpts)
    } else throw new Error(`Unsupported platform: ${process.platform}`)

    await startProcess(LOG_PREFIX, clientSubprocess, 'stderr', (chunk) => {
        return !!chunk.trim().length
    }, opts, Infinity/*30_000*/)

    return clientSubprocess
}

export async function stopClient(opts: Required<AbortOptions>){
    const prevSubprocess = clientSubprocess!

    if(!clientSubprocess) return
    clientSubprocess = undefined

    await killSubprocess(LOG_PREFIX, prevSubprocess, opts)
}