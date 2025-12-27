import path from 'node:path'
import { gsPkg, sdkPkg } from '../data/packages'
import { getFreePort, killSubprocess, spawn, startProcess, type ChildProcess } from './process'
import { fs_writeFile } from '../data/fs'
import type { GameInfo } from '../../game/game-info'
import type { AbortOptions } from '@libp2p/interface'

const LOG_PREFIX = 'SERVER'

let serverSubprocess: ChildProcess | undefined

export async function launchServer(info: GameInfo, opts: Required<AbortOptions>, port = 0){
    //info.gameInfo.CONTENT_PATH = path.relative(gsPkg.dllDir, gsPkg.gcDir)

    const gsInfo = path.join(gsPkg.infoDir, info.gameId ? `GameInfo.${info.gameId}.json` : `GameInfo.json`)
    const gsInfoRel = path.relative(gsPkg.dllDir, gsInfo)
    
    await fs_writeFile(gsInfo, JSON.stringify(info, null, 4), { ...opts, encoding: 'utf8', rethrow: true })
    
    if(port === 0) port = await getFreePort() //HACK:

    serverSubprocess = spawn(sdkPkg.exe, [
        gsPkg.dll, '--port', port.toString(), '--config', gsInfoRel,
    ], {
        logPrefix: LOG_PREFIX,
        //signal: opts.signal,
        cwd: gsPkg.dllDir,
        //detached: true,
        log: true,
    })
    
    await startProcess(LOG_PREFIX, serverSubprocess, 'stdout', (chunk) => {
        return chunk.includes("Server is ready, clients can now connect")
        //return /\b(?:Game)?Server (?:is )?ready\b/.test(chunk)
        /*
        const match = chunk.match(/GameServer ready for clients to connect on Port: (?<port>\d+)/)
        if(match){
            port = parseInt(match.groups!['port']!)
            return true
        }
        return false
        */
    }, opts, Infinity/*60_000*/)

    return Object.assign(serverSubprocess, { port })
}

export async function stopServer(opts: Required<AbortOptions>){
    const prevSubprocess = serverSubprocess!

    if(!serverSubprocess) return
    serverSubprocess = undefined

    await killSubprocess(LOG_PREFIX, prevSubprocess, opts)
}
