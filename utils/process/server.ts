import path from 'node:path'
import { sdkPkg } from '../data/packages'
import { getFreePort, killSubprocess, spawn, startProcess, type ChildProcess } from './process'
import { servers, type ServerVersion } from '../data/constants/client-server-combinations'
import { fs_writeFile } from '../data/fs'
import type { GameInfo } from '../../game/game-info'
import type { AbortOptions } from '@libp2p/interface'

const LOG_PREFIX = 'SERVER'

export type ChildProcessWithPort = { proc: ChildProcess, port: number }
export async function launchServer(serverVersion: ServerVersion, info: GameInfo, opts: Required<AbortOptions>, port = 0): Promise<ChildProcessWithPort> {
    const gsPkg = servers[serverVersion]!

    //info.gameInfo.CONTENT_PATH = path.relative(gsPkg.dllDir, gsPkg.gcDir)

    const gsInfo = path.join(gsPkg.infoDir, info.gameId ? `GameInfo.${info.gameId}.json` : `GameInfo.json`)
    const gsInfoRel = path.relative(gsPkg.dllDir, gsInfo)
    
    await fs_writeFile(gsInfo, JSON.stringify(info, null, 4), { ...opts, encoding: 'utf8', rethrow: true })
    
    if(port === 0) port = await getFreePort() //HACK:

    const serverSubprocess = spawn(sdkPkg.exe, [
        gsPkg.dll, '--port', port.toString(), '--config', gsInfoRel,
    ], {
        logPrefix: LOG_PREFIX,
        //signal: opts.signal,
        cwd: gsPkg.dllDir,
        //detached: true,
        log: true,
    })
    
    await startProcess(LOG_PREFIX, serverSubprocess, 'stdout', (chunk) => {
        return /\b(?:Game)?Server (?:is )?ready\b/.test(chunk)
        //return chunk.includes("Server is ready, clients can now connect")
        //    || chunk.includes("GameServer ready for clients to connect on Port")
        /*
        const match = chunk.match(/GameServer ready for clients to connect on Port: (?<port>\d+)/)
        if(match){
            port = parseInt(match.groups!['port']!)
            return true
        }
        return false
        */
    }, opts, Infinity/*60_000*/)

    return {
        proc: serverSubprocess,
        port,
    }
}

export async function stopServer(server: ChildProcessWithPort, opts: Required<AbortOptions>){
    await killSubprocess(LOG_PREFIX, server.proc, opts)
}
