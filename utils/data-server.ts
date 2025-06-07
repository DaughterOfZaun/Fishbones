import { promises as fs } from "node:fs"
import path from 'node:path'
import { SubProcess } from 'teen_process'
import { champions, maps, modes, spells, /*sanitize_str*/ } from './constants'
import { gsPkg, sdkPkg } from './data-packages'
import { downloads, fs_exists, killSubprocess } from './data-shared'
import type { GameInfo } from './game-info'

//const sanitize_kv = (key: string, value: string) => {
//    if(typeof value === 'string')
//        return sanitize_str(value)
//}

let serverSubprocess: undefined | SubProcess
export async function launchServer(port: number, info: GameInfo){
    info.gameInfo.CONTENT_PATH = path.relative(gsPkg.dllDir, gsPkg.gcDir)

    const gsInfo = path.join(gsPkg.infoDir, `GameInfo.${info.gameId}.json`)
    await fs.writeFile(gsInfo, JSON.stringify(info, null, 4))
    const gsInfoRel = path.relative(gsPkg.dllDir, gsInfo)

    serverSubprocess = new SubProcess(sdkPkg.exe, [
        gsPkg.dll, '--port', port.toString(), '--config', gsInfoRel,
    ], {
        cwd: gsPkg.dllDir,
        //timeout: 15 * 1000
    })
    
    console.log(serverSubprocess.rep)

    await serverSubprocess.start((stdout: string, /*stderr: string*/) => stdout.includes('Server is ready'))
    return serverSubprocess
}

export async function stopServer(){
    const prevSubprocess = serverSubprocess!

    if(!serverSubprocess) return
    serverSubprocess = undefined

    await killSubprocess(prevSubprocess)
}

const serverSettingsJson = path.join(downloads, 'server-settings.jsonc')
let serverSettings: undefined | Record<'maps' | 'modes' | 'champions' | 'spells', number[]>
export async function repairServerSettingsJsonc(){
    if(await fs_exists(serverSettingsJson)) return
    const line = (i: number, name: string, enabled: boolean) => '        ' + (enabled ? '' : '//') + `${i}, // ${name}`
    const txt =`{
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
    await fs.writeFile(serverSettingsJson, txt, 'utf8')
    parseServerSettings(txt)
}
function parseServerSettings(txt: string){
    txt = txt.replace(/\n? *\/\/.*/g, '').replace(/,(?=[\s\n]*[\]}])/g, '')
    serverSettings = JSON.parse(txt)
}
export async function getServerSettings(){
    if(serverSettings) return serverSettings
    const txt = await fs.readFile(serverSettingsJson, 'utf8')
    parseServerSettings(txt)
    return serverSettings!
}
