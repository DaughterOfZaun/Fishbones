import path from 'node:path'
import { downloads } from '../fs'
import embedded from '../embedded/embedded'
import { gdrive, magnet } from './shared'
import { tr } from '../../translation'
import { args } from '../../args'
import { ClientDataInfoCommon, GC_LOCATION_AUTO, GCPkgCommon } from './game-client-126'
import { HARDCODED_HTTP_SERVER_URL } from '../../constants-build'
import type { ClientDataInfo } from '../constants/client-server-combinations'

args.gcCB3Location.on('change', location => gcCB3Pkg.setDirLocation(location))

export const gcCB3Pkg = new class extends GCPkgCommon {

    name = tr('Game Client')
    dirName = 'playable_client_cb3'
    makeDir = false
    zipExt = '7z'
    zipHasSingleRootEntry = true
    zipRoot = [ 'playable_client_cb3' ]
    zipName = `${this.zipRoot[0]!}.${this.zipExt}`
    zipInfoHashV1 = '' //TODO: Complete.
    zipInfoHashV2 = '' //TODO: Complete.
    zipSize = 0 //TODO: Complete.
    size = 0 //TODO: Complete.
    
    release = '0.9.22.14'
    preferC = false
    dir = ''

    zip = path.join(downloads, this.zipName)
    zipTorrentEmbedded = embedded.gcCB3ZipTorrent
    zipTorrentName = `${this.zipName}.torrent`
    zipTorrent = `${this.zip}.torrent`
    zipMagnet = magnet(this.zipInfoHashV1, this.zipInfoHashV2, this.zipName, this.zipSize)
    zipMega = '' //TODO: Complete.
    zipWebSeeds = [
        gdrive(``), //TODO: Complete.
        `${HARDCODED_HTTP_SERVER_URL}/${this.zipName}`,
    ]

    exeName = 'League of Legends.exe'
    exeDir = ''
    exe = ''

    topLevelEntries = [
        'DATA',
        'dbghelp.dll',
        'fmod_event.dll',
        'fmodex.dll',
        'launcher.maestro.dll',
        'League of Legends.exe',
        'LEVELS',
        'tbb.dll',
        'util.dll',
    ]
    topLevelEntriesOptional = [
        'RiotLOL_Client_AB.exe',
        'RiotLOL_Client_AB.pdb',
        'd3dx9_39.dll',
        'Logs',
    ]

    constructor(){
        super()
        this.setDirLocation(GC_LOCATION_AUTO)
    }
}

export class ClientDataInfoVCB3 extends ClientDataInfoCommon implements ClientDataInfo {

    constructor(dir: string){
        super()
        this.appyDir(dir)
    }

    maps = {
        1: {},
        2: {},
        3: {},
        4: {},
    }
    
    spells = {
        "SummonerBoost": { icon: "Summoner_Boost.dds" },
        "SummonerClairvoyance": { icon: "Summoner_Clairvoyance.dds" },
        "SummonerExhaust": { icon: "Summoner_Exhaust.dds" },
        "SummonerFlash": { icon: "Summoner_flash.dds" },
        "SummonerFortify": { icon: "Summoner_fortify.dds" },
        "SummonerHaste": { icon: "Summoner_haste.dds" },
        "SummonerHeal": { icon: "Summoner_heal.dds" },
        //"SummonerPromote": { icon: "Summoner_promote.dds" },
        "SummonerRally": { icon: "Summoner_rally.dds" },
        "SummonerRevive": { icon: "Summoner_revive.dds" },
        "SummonerSmite": { icon: "Summoner_smite.dds" },
        //"SummonerSuppression": { icon: "Summoner_suppression.dds" },
        "SummonerTeleport": { icon: "Summoner_teleport.dds" },
    }

    champions = {} //TODO: Complete.
}
