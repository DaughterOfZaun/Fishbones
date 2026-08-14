import path from 'node:path'
import { downloads } from '../../log'
import type { ServerExeInfo, ServerDataInfo } from "../constants/client-server-combinations"

//import { ClientDataInfoVCB3 } from './game-client-cb3'
//const { maps, spells, champions } = new ClientDataInfoVCB3('')

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
