import path from 'node:path'
import { SubProcess } from 'teen_process'
import { champions, maps, modes, spells } from './constants'
import { gsPkg, sdkPkg } from './data-packages'
import { killSubprocess, logger, registerShutdownHandler, startProcess } from './data-shared'
import { downloads, fs_exists, fs_readFile, fs_writeFile } from './data-fs'
import type { GameInfo } from './game-info'
import type { AbortOptions } from '@libp2p/interface'

let serverSubprocess: undefined | SubProcess
registerShutdownHandler(async (force) => {
    if(serverSubprocess?.isRunning)
        await serverSubprocess.stop(force ? 'SIGKILL' : 'SIGTERM')
})

export async function launchServer(info: GameInfo, opts: Required<AbortOptions>, port = 0){
    info.gameInfo.CONTENT_PATH = path.relative(gsPkg.dllDir, gsPkg.gcDir)

    const gsInfo = path.join(gsPkg.infoDir, `GameInfo.${info.gameId}.json`)
    const gsInfoRel = path.relative(gsPkg.dllDir, gsInfo)

    if(!await fs_writeFile(gsInfo, JSON.stringify(info, null, 4), { ...opts, encoding: 'utf8' })) return null

    serverSubprocess = new SubProcess(sdkPkg.exe, [
        gsPkg.dll, '--port', port.toString(), '--config', gsInfoRel,
    ], {
        cwd: gsPkg.dllDir,
        //timeout: 15 * 1000
        //detached: true,
    })
    
    //console.log(serverSubprocess.rep)
    serverSubprocess.on('stream-line', line => logger.log('SERVER', line))

    const proc = await startProcess(serverSubprocess, ['SERVER'], [(stdout, /*stderr*/) => {
        //return /\b(?:Game)?Server (?:is )?ready\b/.test(stdout)
        const match = stdout.match(/GameServer ready for clients to connect on Port: (?<port>\d+)/)
        if(match){
            port = parseInt(match.groups!['port']!)
            return true
        }
        return false
    }, 60_000], opts)
    return proc && Object.assign(proc, { port })
}

export async function stopServer(opts: Required<AbortOptions>){
    const prevSubprocess = serverSubprocess!

    if(!serverSubprocess) return
    serverSubprocess = undefined

    await killSubprocess(prevSubprocess, opts)
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
