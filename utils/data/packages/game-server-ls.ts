import path from 'node:path'
import { downloads } from '../../log'
import type { ServerExeInfo, ServerDataInfo } from "../constants/client-server-combinations"

export const lsPkg = new class implements ServerExeInfo {
    dll = path.join(downloads, 'lolsrv.exe')
    dllDir = downloads
    infoDir = ''
}


export class LoLSrverDataInfo implements ServerDataInfo {

    maps = {}
    spells = {}
    champions = {}
    bots = []
    
    constructor(
        public dir: string
    ){}
}
