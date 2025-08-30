import path from 'node:path'
import { champions, maps, modes, spells } from './constants'
import { gsPkg, sdkPkg } from './data-packages'
import { logger } from './data-shared'
import { killSubprocess, registerShutdownHandler, spawn, startProcess, type ChildProcess } from './data-process'
import { downloads, fs_exists, fs_readFile, fs_writeFile } from './data-fs'
import type { GameInfo } from './game-info'
import type { AbortOptions } from '@libp2p/interface'

const LOG_PREFIX = 'SERVER'

let serverSubprocess: ChildProcess | undefined
registerShutdownHandler((force) => {
    serverSubprocess?.kill(force ? 'SIGKILL' : 'SIGTERM')
})

export async function launchServer(info: GameInfo, opts: Required<AbortOptions>, port = 0){
    info.gameInfo.CONTENT_PATH = path.relative(gsPkg.dllDir, gsPkg.gcDir)

    const gsInfo = path.join(gsPkg.infoDir, `GameInfo.${info.gameId}.json`)
    const gsInfoRel = path.relative(gsPkg.dllDir, gsInfo)

    await fs_writeFile(gsInfo, JSON.stringify(info, null, 4), { ...opts, encoding: 'utf8', rethrow: true })

    serverSubprocess = spawn(sdkPkg.exe, [
        gsPkg.dll, '--port', port.toString(), '--config', gsInfoRel,
    ], {
        cwd: gsPkg.dllDir,
        //detached: true,
    })
    
    serverSubprocess.stdout.setEncoding('utf8').on('data', (chunk: string) => onData('[STDOUT]', chunk))
    serverSubprocess.stderr.setEncoding('utf8').on('data', (chunk: string) => onData('[STDERR]', chunk))
    function onData(src: string, chunk: string){
        logger.log(LOG_PREFIX, src, chunk)
    }

    await startProcess(LOG_PREFIX, serverSubprocess, (stdout, /*stderr*/) => {
        //return /\b(?:Game)?Server (?:is )?ready\b/.test(stdout)
        const match = stdout.match(/GameServer ready for clients to connect on Port: (?<port>\d+)/)
        if(match){
            port = parseInt(match.groups!['port']!)
            return true
        }
        return false
    }, opts, 60_000)

    return Object.assign(serverSubprocess, { port })
}

export async function stopServer(opts: Required<AbortOptions>){
    const prevSubprocess = serverSubprocess!

    if(!serverSubprocess) return
    serverSubprocess = undefined

    await killSubprocess(LOG_PREFIX, prevSubprocess, opts)
}

const serverSettingsJson = path.join(downloads, 'server-settings.jsonc')
type ServerSettings = Record<'maps' | 'modes' | 'champions' | 'spells', number[]>
let serverSettings: ServerSettings | undefined
export async function repairServerSettingsJsonc(opts: Required<AbortOptions>){
    if(await fs_exists(serverSettingsJson, opts)) return
    const txt = getServerSettingsJsonc()
    await fs_writeFile(serverSettingsJson, txt, { ...opts, encoding: 'utf8' })
    return parseServerSettings(txt)
}
function getServerSettingsJsonc(){
    const line = (i: number, name: string, enabled: boolean) => '        ' + (enabled ? '' : '//') + `${i}, // ${name}`
    return `{
    "maps": [
${ maps.map(([i, name, enabled]) => line(i, name, enabled)).join('\n') }
    ],
    "modes": [
${ modes.map(([, name, enabled], i) => line(i, name, enabled)).join('\n') }
    ],
    "champions": [
${ champions.map(([, name, enabled], i) => line(i, name, enabled)).join('\n') }
    ],
    "spells": [
${ spells.map(([, name, enabled], i) => line(i, name, enabled)).join('\n') }
    ],
}`.trim()
}
function parseServerSettings(txt: string){
    txt = txt.replace(/\n? *\/\/.*/g, '').replace(/,(?=[\s\n]*[\]}])/g, '')
    return serverSettings = JSON.parse(txt) as ServerSettings
}
export async function getServerSettings(opts: Required<AbortOptions>){
    if(serverSettings) return serverSettings
    let txt = await fs_readFile(serverSettingsJson, { encoding : 'utf8', ...opts })
    txt ||= getServerSettingsJsonc()
    return parseServerSettings(txt)
}
