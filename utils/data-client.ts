import { SubProcess } from "teen_process"
import { gcPkg } from "./data-packages"
import { sanitize_bfkey } from "./constants"
import { killSubprocess, logger, registerShutdownHandler, startProcess } from "./data-shared"
import type { AbortOptions } from "@libp2p/interface"

let clientSubprocess: undefined | SubProcess
registerShutdownHandler(async (force) => {
    if(clientSubprocess?.isRunning)
        await clientSubprocess.stop(force ? 'SIGKILL' : 'SIGTERM')
})

let launchArgs: undefined | [ ip: string, port: number, key: string, clientId: number ]
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
        clientSubprocess = new SubProcess(gcPkg.exe, gcArgs, {
            cwd: gcPkg.exeDir,
        })
    else if(process.platform == 'linux')
        clientSubprocess = new SubProcess(
            'flatpak', [ 'run', '--command=bottles-cli', 'com.usebottles.bottles',
                'run', '-b', 'Default Gaming', '-e', gcPkg.exe, gcArgsStr ]) //TODO: cwd
        //clientSubprocess = new SubProcess('bottles-cli', ['run', '-b', 'Default Gaming', '-p', 'League of Legends', '--args-replace', gcArgs])
    else throw new Error(`Unsupported platform: ${process.platform}`)

    //console.log(clientSubprocess.rep)
    clientSubprocess.on('stream-line', line => logger.log('CLIENT', line))

    return await startProcess(clientSubprocess, ['CLIENT'], [undefined, 60_000], opts)
}

export async function stopClient(opts: Required<AbortOptions>){
    const prevSubprocess = clientSubprocess!

    if(!clientSubprocess) return
    clientSubprocess = undefined

    await killSubprocess(prevSubprocess, opts)
}