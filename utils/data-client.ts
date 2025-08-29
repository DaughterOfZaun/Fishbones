import { gcPkg } from "./data-packages"
import { sanitize_bfkey } from "./constants"
import { logger } from "./data-shared"
import { killSubprocess, logTerminationMsg, registerShutdownHandler, spawn, startProcess, type ChildProcess } from "./data-process"
import type { AbortOptions } from "@libp2p/interface"

const LOG_PREFIX = 'CLIENT'

let clientSubprocess: ChildProcess | undefined
registerShutdownHandler((force) => {
    clientSubprocess?.kill(force ? 'SIGKILL' : 'SIGTERM')
})

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

    if(process.platform == 'win32')
        clientSubprocess = spawn(gcPkg.exe, gcArgs, {
            cwd: gcPkg.exeDir,
        })
    else if(process.platform == 'linux')
        clientSubprocess = spawn(
            'flatpak', [ 'run', '--command=bottles-cli', 'com.usebottles.bottles',
                'run', '-b', 'Default Gaming', '-e', gcPkg.exe, gcArgsStr ]) //TODO: cwd
        //clientSubprocess = spawn('bottles-cli', ['run', '-b', 'Default Gaming', '-p', 'League of Legends', '--args-replace', gcArgs])
    else throw new Error(`Unsupported platform: ${process.platform}`)

    clientSubprocess.addListener('exit', (code, signal) => logTerminationMsg(LOG_PREFIX, 'exited', code, signal))

    clientSubprocess.stdout.setEncoding('utf8').on('data', (chunk) => onData('[STDOUT]', chunk))
    clientSubprocess.stderr.setEncoding('utf8').on('data', (chunk) => onData('[STDERR]', chunk))
    function onData(src: string, chunk: string){
        logger.log(LOG_PREFIX, src, chunk)
    }

    await startProcess(LOG_PREFIX, clientSubprocess, (chunk) => chunk.trim().length > 0, opts, 30_000)

    return clientSubprocess
}

export async function stopClient(opts: Required<AbortOptions>){
    const prevSubprocess = clientSubprocess!

    if(!clientSubprocess) return
    clientSubprocess = undefined

    await killSubprocess(LOG_PREFIX, prevSubprocess, opts)
}