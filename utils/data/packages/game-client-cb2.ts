import path from 'node:path'
import { downloads } from '../fs'
import embedded from '../embedded/embedded'
import { gdrive, magnet } from './shared'
import { tr } from '../../translation'
import { args } from '../../args'
import { ClientDataInfoCommon, GC_LOCATION_AUTO, GCPkgCommon } from './game-client-126'
import { HARDCODED_HTTP_SERVER_URL } from '../../constants-build'
import type { ClientDataInfo } from '../constants/client-server-combinations'

args.gcCB2Location.on('change', location => gcCB2Pkg.setDirLocation(location))

export const gcCB2Pkg = new class extends GCPkgCommon {

    name = tr('Game Client')
    dirName = 'playable_client_cb2'
    makeDir = false
    zipExt = '7z'
    zipHasSingleRootEntry = true
    zipRoot = [ 'playable_client_cb2' ]
    zipName = `${this.zipRoot[0]!}.${this.zipExt}`
    zipInfoHashV1 = 'd3418ba2338b4b16c78627064b4e128f8d6bdbe9'
    zipInfoHashV2 = '1eccb65abc958b4fc3832687bc8d898913aad97facb0d5022d5c83d96d440311'
    zipSize = 200080240
    size = 846368146
    
    release = '0.8.13.26'
    preferC = false
    dir = ''

    zip = path.join(downloads, this.zipName)
    zipTorrentEmbedded = embedded.gcCB2ZipTorrent
    zipTorrentName = `${this.zipName}.torrent`
    zipTorrent = `${this.zip}.torrent`
    zipMagnet = magnet(this.zipInfoHashV1, this.zipInfoHashV2, this.zipName, this.zipSize)
    zipMega = 'https://mega.nz/file/2uhEXDYb#mbJ_Q0qMWdKm-loC3jhLZROuwc1G-TNRhaVtlCO_wq8'
    zipWebSeeds = [
        gdrive(`153Z8BiNAfbBzK78-noQuUwq95_cP5clR`),
        `${HARDCODED_HTTP_SERVER_URL}/${this.zipName}`,
    ]

    exeName = 'League of Legends.exe'
    exeDir = ''
    exe = ''

    topLevelEntries = [
        'LEVELS',
        'DATA',
        'ClientLog.txt',
        'maestro-game_client.log',
        //'2026-08-15_09-49-17_r3dlog.txt',
        'VerboseEvent.log',
        'LiteEvent.log',
        'League of Legends.exe',
        'util.dll',
        'fmodexL.dll',
        'fmodex.dll',
        'fmod_eventL.dll',
        'fmod_event.dll',
        'dbghelp.dll',
        'launcher.maestro.dl',
    ]
    topLevelEntriesOptional = [
        'd3dx9_39.dll',
        'Logs',
    ]

    constructor(){
        super()
        this.setDirLocation(GC_LOCATION_AUTO)
    }
}

export class ClientDataInfoVCB2 extends ClientDataInfoCommon implements ClientDataInfo {

    constructor(dir: string){
        super()
        this.appyDir(dir)
    }

    maps = {
        1: {},
        3: {},
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

    champions = {
        "48thSlave": { icon: "Info/VoodooShaman_Square.dds", skins: {} },
        "Annie": { icon: "Info/Annie_Square.dds", skins: {} },
        "Armordillo": { icon: "Info/Armordillo_Square.dds", skins: {} },
        "Armsmaster": { icon: "info/Armsmaster_Square.dds", skins: {} },
        "Averdrian": { icon: "info/Averdrian_Square.dds", skins: {} },
        "BlindMonk": { icon: "Info/Blindmonk_Square.dds", skins: {} },
        "Bowmaster": { icon: "Info/Bowmaster_Square.dds", skins: {} },
        "CardMaster": { icon: "Info/Cardmaster_Square.dds", skins: {} },
        "ChemicalMan": { icon: "Info/ChemicalMan_Square.dds", skins: {} },
        "Chronokeeper": { icon: "Info/Chronokeeper_Square.dds", skins: {} },
        "Cryophoenix": { icon: "Info/Cryophoenix_Square.dds", skins: {} },
        "DarkChampion": { icon: "Info/DarkChampion_Square.dds", skins: {} },
        "DrMundo": { icon: "Info/DrMundo_Square.dds", skins: {} },
        "DrMundo_Old": { icon: "info/DrMundo_Square.dds", skins: {} },
        "Evelynn": { icon: "Info/Evelynn_Square.dds", skins: {} },
        "FallenAngel": { icon: "Info/FallenAngel_Square.dds", skins: {} },
        "FiddleSticks": { icon: "info/Fiddlesticks_Square.dds", skins: {} },
        "GreenTerror": { icon: "Info/GreenTerror_Square.dds", skins: {} },
        "Jester": { icon: "Info/Jester_Square.dds", skins: {} },
        "Judicator": { icon: "Info/Judicator_Square.dds", skins: {} },
        "Lich": { icon: "Info/Lich_Square.dds", skins: {} },
        "MasterYi": { icon: "Info/MasterYi_Square.dds", skins: {} },
        "Minotaur": { icon: "Info/Minotaur_Square.dds", skins: {} },
        "Pirate": { icon: "Info/Pirate_Square.dds", skins: {} },
        "Plantking": { icon: "Info/PlantKing_Square.dds", skins: {} },
        "RobBlackblade": { icon: "Info/RobBlackblade_Square.dds", skins: {} },
        "RobBlackblade_Old": { icon: "Info/RobBlackblade_Square.dds", skins: {} },
        "Ryze": { icon: "Info/Ryze_Square.dds", skins: {} },
        "SadMummy": { icon: "Info/SadMummy_Square.dds", skins: {} },
        "Sion": { icon: "Info/Sion_Square.dds", skins: {} },
        "Sivir": { icon: "Info/Sivir_Square.dds", skins: {} },
        "Soraka": { icon: "info/Soraka_Square.dds", skins: {} },
        "SpiderQueen": { icon: "info/SpiderQueen_Square.dds", skins: {} },
        "Teemo": { icon: "Info/Teemo_Square.dds", skins: {} },
        "Tristana": { icon: "Info/Tristana_Square.dds", skins: {} },
        "Twitch": { icon: "Info/twitch_square.dds", skins: {} },
        "Voidwalker": { icon: "Info/Voidwalker_Square.dds", skins: {} },
        "WaterWizard": { icon: "Info/WaterWizard_Square.dds", skins: {} },
        "Wolfman": { icon: "Info/Wolfman_Square.dds", skins: {} },
        "Yeti": { icon: "Info/Yeti_Square.dds", skins: {} },
    }
}
