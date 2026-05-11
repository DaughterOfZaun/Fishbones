import { sanitize_bfkey } from "../constants"
import { killSubprocess, spawn, startProcess, type ChildProcess, type SpawnOptions } from "../process/process"
import { clients, type ClientVersion } from "../data/constants/client-server-combinations"
import { WINE_CMD_AUTO, WINE_CMD_AUTO_TEMPLATE } from "../data/packages/wine"
import type { AbortOptions } from "@libp2p/interface"
import { args } from "../args"
import path from 'node:path'

const LOG_PREFIX = 'CLIENT'

let clientSubprocess: ChildProcess | undefined

let launchArgs: { version: ClientVersion, ip: string, port: number, key: string, clientId: number } | undefined
export function getLastLaunchCmd(){
    const { version, ip, port, key, clientId } = launchArgs!
    const gcPkg = clients[version]!
    const gcPkg_exeName = path.basename(gcPkg.exe)
    return 'start ' + ['', gcPkg_exeName, '', '', '', [ip, port, key, clientId].map(arg => arg.toString()).join(' ')].map(arg => `"${arg}"`).join(' ')
}
export async function launchClient(version: ClientVersion, ip: string, port: number, key: string, clientId: number, opts: Required<AbortOptions>){
    launchArgs = { version, ip, port, key, clientId }
    return await relaunchClient(opts)
}
export async function relaunchClient(opts: Required<AbortOptions>){
    const { version, ip, port, key, clientId } = launchArgs!
    const gcPkg = clients[version]!

    const gcArgs = ['8394', 'LoLLauncher.exe', 'unknown', ([ip, port.toString(), sanitize_bfkey(key), clientId.toString()]).join(' ')]
    const gcArgsStr = gcArgs.map(a => `"${a}"`).join(' ')
    //console.log('%s %s', gcPkg.exe, gcArgsStr)
    //logger.log('%s %s', gcPkg.exe, gcArgsStr)

    await stopClient(opts)

    // eslint-disable-next-line prefer-const
    let exe = gcPkg.exe
    const spawnOpts: SpawnOptions = {
        logPrefix: LOG_PREFIX,
        //signal: opts.signal,
        cwd: gcPkg.exeDir,
        log: true,
    }
    if(process.platform == 'win32'){
        //spawnOpts.cwd = deployDir
        //exe = path.join(deployDir, gcPkg.exeName)
        clientSubprocess = spawn(exe, gcArgs, spawnOpts)
    } else if(process.platform == 'linux'){

        process.env['WINEDEBUG'] = '-all'
        
        const template = args.wineCommand.value == WINE_CMD_AUTO ? WINE_CMD_AUTO_TEMPLATE : args.wineCommand.value
        const tempArgs = [ ...template.matchAll(/(['"])(?:\\\1|.)*?\1|(?:\\ |[^ ])+/g).map(m => m[0]) ]
        const [ wineExe, ...wineArgs ] = tempArgs.flatMap(arg => {
            if(arg == '{exe}') return [ exe ]
            if(arg == '{args}') return gcArgs
            if(arg.startsWith("'") && arg.endsWith("'") ||
               arg.startsWith('"') && arg.endsWith('"'))
               arg = arg.slice(1, -1)
            arg = arg.replaceAll('{exe}', exe)
            arg = arg.replaceAll('{args}', gcArgsStr)
            arg = arg.replaceAll(/\\(.)/g, '$1')
            return arg
        })
        clientSubprocess = spawn(wineExe ?? 'wine', wineArgs, spawnOpts)
        
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
/*
const releaseDir = path.join(
    //'C:', 'Riot Games', 'League of Legends', 'RADS', 'solutions', 'lol_game_client_sln', 'releases', gcPkg.release,
    'C:', 'RADS', 'solutions', 'lol_game_client_sln', 'releases', gcPkg.release,
)
const deployDir = path.join(releaseDir, 'deploy')
export async function ensureSymlink(){
    try {
        await fs.mkdir(releaseDir, { recursive: true })
    } catch(unk_err){
        const err = unk_err as Error & { code: string }
        if(err.code !== 'EEXIST')
            throw err
    }
    try {
        await fs.symlink(gcPkg.exeDir, deployDir, 'junction')
    } catch(unk_err){
        const err = unk_err as Error & { code: string }
        if(err.code !== 'EEXIST')
            throw err
    }
    //exec(String.raw`powershell.exe Start-Process -verb runAs cmd.exe '/k "mklink /d \"${deployDir}\" \"${gcPkg.exeDir}\""'`)
}
*/
