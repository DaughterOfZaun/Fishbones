import path from 'node:path'
import { downloads } from '../fs'
import embedded from '../embedded/embedded'
import { gdrive, magnet, PkgInfoExe } from './shared'
import { HARDCODED_HTTP_SERVER_URL } from '../../constants-build'
import { args } from '../../args'
import { tr } from '../../translation'
import type { ClientExeInfo, ClientDataInfo } from '../constants/client-server-combinations'

export const GC_LOCATION_AUTO = 'auto'
export const GC_LOCATION_C_DRIVE = 'C'
export const GC_LOCATION_DOWNLOADS = 'Fishbones_Data'
export const GC_LOCATION_CUSTOM = '...'

args.gcLocation.on('change', location => gcPkg.setDirLocation(location))

export const gcLocationFromIndexToString = [
    GC_LOCATION_AUTO,
    GC_LOCATION_C_DRIVE,
    GC_LOCATION_DOWNLOADS,
    GC_LOCATION_CUSTOM,
]
export const gcLocationFromStringToIndex = Object.fromEntries(
    gcLocationFromIndexToString.map((v, i) => [ v, i ])
)

export abstract class GCPkgCommon extends PkgInfoExe implements ClientExeInfo {

    abstract dirName: string
    abstract release: string
    abstract exeName: string
    abstract preferC: boolean

    setDirLocation(location: string){
        
        if(location == GC_LOCATION_AUTO)
            location = (process.platform == 'win32' && this.preferC) ? GC_LOCATION_C_DRIVE : GC_LOCATION_DOWNLOADS
        
        if(location == GC_LOCATION_C_DRIVE)
            this.dir = path.join('C:', 'Riot Games', 'League of Legends', 'RADS', 'solutions', 'lol_game_client_sln', 'releases', this.release)
        else if(location == GC_LOCATION_DOWNLOADS)
            this.dir = path.join(downloads, this.dirName)
        else
            this.dir = location

        this.exeDir = this.dir
        this.exe = path.join(this.exeDir, this.exeName)

        this.onDirSet?.(this.dir)
    }

    onDirSet?: (gcPkg_dir: string) => void
}

export const gcPkg = new class extends GCPkgCommon {

    name = tr('Game Client')
    dirName = 'playable_client_126'
    makeDir = false
    zipExt = '7z'
    zipName = `${this.dirName}.${this.zipExt}`
    zipInfoHashV1 = '875201f4a9920ffd7c9bff6c9a2ad59e28f041ae'
    zipInfoHashV2 = '6ccbb2911b07b2c084beb666d22018159845b3eae180b989d75b354af39c8af3'
    zipSize = 898175547
    size = 2472089243

    release = '0.0.0.51' //TODO: Are you sure about that?
    preferC = true
    dir = ''
    
    zip = path.join(downloads, this.zipName)
    zipTorrentEmbedded = embedded.gcZipTorrent
    zipTorrentName = `${this.zipName}.torrent`
    zipTorrent = `${this.zip}.torrent`
    zipMagnet = magnet(this.zipInfoHashV1, this.zipInfoHashV2, this.zipName, this.zipSize)
    zipMega = 'https://mega.nz/file/uqRmkCKC#nJFZ2hAYqTq5q-T1PExXPpu0aX4ALjjZj2SZ4q9yCpk'
    zipWebSeeds = [
        gdrive(`1tSoj5PIOWg1Wl7Y-SbjEAEypskvxJ6mx`),
        `${HARDCODED_HTTP_SERVER_URL}/${this.zipName}`,
    ]

    exeName = 'League of Legends.exe'
    exeDir = ''
    exe = ''

    topLevelEntries = [
        'LEVELS',
        'DATA',
        'util.dll',
        'tbb.dll',
        'rads.dll',
        'League of Legends.exe',
        'launcher.maestro.dll',
        'fmodex.dll',
        'fmod_event.dll',
        'dbghelp.dll',
        'client.ver',
        'bugsplatrc.dll',
        'bugsplat.dll',
        'BsSndRpt.exe',
    ]
    topLevelEntriesOptional = [
        'launch_client.bat',
        'd3dx9_39.dll',
    ]

    constructor(){
        super()
        this.setDirLocation(GC_LOCATION_AUTO)
    }
}

export class ClientDataInfoCommon {
    protected appyDir(this_dir: string){
        const info = this as unknown as ClientDataInfo
        for(const spell of Object.values(info.spells)){
            const spell_dir = path.join(this_dir, 'DATA', 'Spells', 'Icons2D')
            if(!spell.icon.startsWith('res://'))
                spell.icon = path.join(spell_dir, ...spell.icon.split('/'))
        }
        for(const [short, champion] of Object.entries(info.champions)){
            const champion_dir = path.join(this_dir, 'DATA', 'Characters', short)
            if(!champion.icon.startsWith('res://'))
                champion.icon = path.join(champion_dir, ...champion.icon.split('/'))
            for(const skin of Object.values(champion.skins)){
                if(!skin.image.startsWith('res://'))
                    skin.image = path.join(champion_dir, ...skin.image.split('/'))
            }
        }
    }
}

export class ClientDataInfoV126 extends ClientDataInfoCommon implements ClientDataInfo {

    constructor(dir: string){
        super()
        this.appyDir(dir)
    }

    maps = {
        1: {},
        2: {},
        4: {},
        8: {},
    }

    spells = {
        "SummonerHeal": { icon: "Summoner_heal.dds" },
        "SummonerExhaust": { icon: "Summoner_Exhaust.dds" },
        "SummonerFlash": { icon: "Summoner_flash.dds" },
        "SummonerTeleport": { icon: "Summoner_teleport.dds" },
        "SummonerSmite": { icon: "Summoner_smite.dds" },
        //"SummonerCleanse": { icon: "SummonerCleanse.dds" },
        //"SummonerIgnite": { icon: "SummonerIgnite.dds" },
        "SummonerDot": { icon: "SummonerIgnite.dds" },
        "SummonerBoost": { icon: "Summoner_Boost.dds" },
        "SummonerClairvoyance": { icon: "Summoner_Clairvoyance.dds" },
        "SummonerFortify": { icon: "Summoner_fortify.dds" },
        "SummonerHaste": { icon: "Summoner_haste.dds" },
        "SummonerMana": { icon: "SummonerMana.dds" },
        //"SummonerOdinGarrison": {},
        //"SummonerOdinPromote": {},
        "SummonerRally": { icon: "Summoner_rally.dds" },
        "SummonerRevive": { icon: "Summoner_revive.dds" },
        //"SummonerPromote": { icon: "Summoner_promote.dds" },
        //"SummonerObserver": { icon: "SummonerObserver.dds" },
    }

    champions = {
        "Alistar": {
            icon: "Info/Minotaur_Square.dds",
            skins: {
                0: { image: "AlistarLoadScreen.dds" },
                1: { image: "AlistarLoadScreen_1.DDS" },
                2: { image: "AlistarLoadScreen_2.DDS" },
                3: { image: "AlistarLoadScreen_3.dds" },
                4: { image: "AlistarLoadScreen_4.dds" },
                5: { image: "AlistarLoadScreen_5.dds" },
            }
        },
        "Annie": {
            icon: "Info/Annie_Square.dds",
            skins: {
                6: { image: "AnnieLoadScreen_6.dds" },
                2: { image: "AnnieLoadScreen_2.DDS" },
                1: { image: "AnnieLoadScreen_1.DDS" },
                4: { image: "AnnieLoadScreen_4.dds" },
                5: { image: "AnnieLoadScreen_5.dds" },
                0: { image: "AnnieLoadScreen.dds" },
                3: { image: "AnnieLoadScreen_3.dds" },
            }
        },
        "Ashe": {
            icon: "Info/Bowmaster_Square.dds",
            skins: {
                0: { image: "AsheLoadScreen.dds" },
                2: { image: "AsheLoadScreen_2.DDS" },
                3: { image: "AsheLoadScreen_3.dds" },
                4: { image: "AsheLoadScreen_4.dds" },
                1: { image: "AsheLoadScreen_1.DDS" },
            }
        },
        "FiddleSticks": {
            icon: "info/Fiddlesticks_Square.dds",
            skins: {
                5: { image: "fiddlesticksLoadScreen_5.dds" },
                4: { image: "fiddlesticksLoadScreen_4.dds" },
                3: { image: "fiddlesticksLoadScreen_3.dds" },
                0: { image: "fiddlesticksLoadScreen.dds" },
                2: { image: "fiddlesticksLoadScreen_2.DDS" },
                1: { image: "fiddlesticksLoadScreen_1.DDS" },
            }
        },
        "Jax": {
            icon: "info/Armsmaster_Square.dds",
            skins: {
                5: { image: "JaxLoadScreen_5.dds" },
                1: { image: "JaxLoadScreen_1.DDS" },
                4: { image: "JaxLoadScreen_4.dds" },
                0: { image: "JaxLoadScreen.dds" },
                2: { image: "JaxLoadScreen_2.DDS" },
                3: { image: "JaxLoadScreen_3.dds" },
            }
        },
        "Kayle": {
            icon: "Info/Judicator_Square.dds",
            skins: {
                2: { image: "KayleLoadScreen_2.dds" },
                1: { image: "KayleLoadScreen_1.DDS" },
                4: { image: "KayleLoadScreen_4.dds" },
                5: { image: "KayleLoadScreen_5.dds" },
                0: { image: "KayleLoadScreen.dds" },
                3: { image: "KayleLoadScreen_3.dds" },
            }
        },
        "MasterYi": {
            icon: "Info/MasterYi_Square.dds",
            skins: {
                2: { image: "MasterYiLoadScreen_2.dds" },
                1: { image: "MasterYiLoadScreen_1.DDS" },
                3: { image: "MasterYiLoadScreen_3.dds" },
                4: { image: "MasterYiLoadScreen_4.dds" },
                0: { image: "MasterYiLoadScreen.dds" },
            }
        },
        "Morgana": {
            icon: "Info/FallenAngel_Square.dds",
            skins: {
                2: { image: "MorganaLoadScreen_2.dds" },
                3: { image: "MorganaLoadScreen_3.dds" },
                1: { image: "MorganaLoadScreen_1.dds" },
                0: { image: "MorganaLoadScreen.dds" },
            }
        },
        "Nunu": {
            icon: "Info/Yeti_Square.dds",
            skins: {
                3: { image: "NunuLoadScreen_3.dds" },
                4: { image: "NunuLoadScreen_4.dds" },
                0: { image: "NunuLoadScreen.dds" },
                5: { image: "NunuLoadScreen_5.dds" },
                1: { image: "NunuLoadScreen_1.DDS" },
                2: { image: "NunuLoadScreen_2.dds" },
            }
        },
        "Ryze": {
            icon: "Info/Ryze_Square.dds",
            skins: {
                2: { image: "RyzeLoadScreen_2.dds" },
                3: { image: "RyzeLoadScreen_3.dds" },
                4: { image: "RyzeLoadScreen_4.dds" },
                5: { image: "RyzeLoadScreen_5.dds" },
                1: { image: "RyzeLoadScreen_1.DDS" },
                0: { image: "RyzeLoadScreen.dds" },
                6: { image: "RyzeLoadScreen_6.dds" },
            }
        },
        "Sion": {
            icon: "Info/Sion_Square.dds",
            skins: {
                3: { image: "SionLoadScreen_3.dds" },
                0: { image: "sionLoadScreen.dds" },
                1: { image: "SionLoadScreen_1.dds" },
                4: { image: "SionLoadScreen_4.dds" },
                2: { image: "SionLoadScreen_2.dds" },
            }
        },
        "Sivir": {
            icon: "Info/Sivir_Square.dds",
            skins: {
                1: { image: "SivirLoadScreen_1.DDS" },
                4: { image: "SivirLoadScreen_4.dds" },
                5: { image: "SivirLoadScreen_5.dds" },
                0: { image: "SivirLoadScreen.dds" },
                3: { image: "SivirLoadScreen_3.dds" },
                2: { image: "SivirLoadScreen_2.dds" },
            }
        },
        "Soraka": {
            icon: "info/Soraka_Square.dds",
            skins: {
                0: { image: "sorakaLoadScreen.dds" },
                1: { image: "sorakaLoadScreen_1.dds" },
                2: { image: "sorakaLoadScreen_2.dds" },
            }
        },
        "Teemo": {
            icon: "Info/Teemo_Square.dds",
            skins: {
                0: { image: "teemoLoadScreen.dds" },
                6: { image: "TeemoLoadScreen_6.dds" },
                5: { image: "teemoLoadScreen_5.dds" },
                2: { image: "teemoLoadScreen_2.dds" },
                3: { image: "teemoLoadScreen_3.DDS" },
                1: { image: "teemoLoadScreen_1.DDS" },
                4: { image: "teemoLoadScreen_4.dds" },
            }
        },
        "Tristana": {
            icon: "Info/Tristana_Square.dds",
            skins: {
                0: { image: "tristanaLoadScreen.dds" },
                4: { image: "tristanaLoadScreen_4.dds" },
                3: { image: "tristanaLoadScreen_3.dds" },
                5: { image: "tristanaLoadScreen_5.dds" },
                2: { image: "tristanaLoadScreen_2.dds" },
                1: { image: "tristanaLoadScreen_1.DDS" },
            }
        },
        "TwistedFate": {
            icon: "Info/Cardmaster_Square.dds",
            skins: {
                0: { image: "TwistedFateLoadScreen.dds" },
                3: { image: "TwistedFateLoadScreen_3.dds" },
                1: { image: "TwistedFateLoadScreen_1.DDS" },
                5: { image: "TwistedFateLoadScreen_5.dds" },
                2: { image: "TwistedFateLoadScreen_2.DDS" },
                4: { image: "TwistedFateLoadScreen_4.dds" },
            }
        },
        "Warwick": {
            icon: "Info/Warwick_Square.dds",
            skins: {
                4: { image: "WarwickLoadScreen_4.dds" },
                1: { image: "WarwickLoadScreen_1.DDS" },
                3: { image: "WarwickLoadScreen_3.DDS" },
                2: { image: "WarwickLoadScreen_2.dds" },
                5: { image: "WarwickLoadScreen_5.dds" },
                0: { image: "WarwickLoadScreen.dds" },
                6: { image: "WarwickLoadScreen_6.dds" },
            }
        },
        "Singed": {
            icon: "Info/ChemicalMan_Square.dds",
            skins: {
                2: { image: "SingedLoadScreen_2.dds" },
                0: { image: "SingedLoadScreen.dds" },
                3: { image: "SingedLoadScreen_3.dds" },
                1: { image: "SingedLoadScreen_1.dds" },
                4: { image: "SingedLoadScreen_4.dds" },
            }
        },
        "Zilean": {
            icon: "Info/Chronokeeper_Square.dds",
            skins: {
                4: { image: "ZileanLoadScreen_4.dds" },
                3: { image: "ZileanLoadScreen_3.dds" },
                1: { image: "ZileanLoadScreen_1.dds" },
                2: { image: "ZileanLoadScreen_2.dds" },
                0: { image: "ZileanLoadScreen.dds" },
            }
        },
        "Evelynn": {
            icon: "Info/Evelynn_Square.dds",
            skins: {
                2: { image: "evelynnLoadScreen_2.DDS" },
                0: { image: "evelynnLoadScreen.dds" },
                1: { image: "evelynnLoadScreen_1.DDS" },
                3: { image: "evelynnLoadScreen_3.dds" },
            }
        },
        "Tryndamere": {
            icon: "Info/DarkChampion_Square.dds",
            skins: {
                2: { image: "TryndamereLoadScreen_2.dds" },
                4: { image: "TryndamereLoadScreen_4.dds" },
                3: { image: "TryndamereLoadScreen_3.dds" },
                1: { image: "TryndamereLoadScreen_1.DDS" },
                0: { image: "TryndamereLoadScreen.dds" },
            }
        },
        "Twitch": {
            icon: "Info/twitch_square.dds",
            skins: {
                0: { image: "twitchLoadScreen.dds" },
                5: { image: "twitchLoadScreen_5.dds" },
                3: { image: "twitchLoadScreen_3.dds" },
                2: { image: "twitchLoadScreen_2.DDS" },
                1: { image: "twitchLoadScreen_1.DDS" },
                4: { image: "twitchLoadScreen_4.dds" },
            }
        },
        "Karthus": {
            icon: "Info/Lich_Square.dds",
            skins: {
                0: { image: "KarthusLoadScreen.dds" },
                3: { image: "KarthusLoadScreen_3.dds" },
                2: { image: "KarthusLoadScreen_2.dds" },
                4: { image: "KarthusLoadScreen_4.dds" },
                1: { image: "KarthusLoadScreen_1.DDS" },
            }
        },
        "Amumu": {
            icon: "Info/SadMummy_Square.dds",
            skins: {
                5: { image: "AmumuLoadScreen_5.dds" },
                3: { image: "AmumuLoadScreen_3.dds" },
                1: { image: "AmumuLoadScreen_1.DDS" },
                0: { image: "AmumuLoadScreen.dds" },
                6: { image: "AmumuLoadScreen_6.dds" },
                4: { image: "AmumuLoadScreen_4.dds" },
                2: { image: "AmumuLoadScreen_2.DDS" },
            }
        },
        "Chogath": {
            icon: "Info/GreenTerror_Square.dds",
            skins: {
                0: { image: "ChogathLoadScreen.dds" },
                2: { image: "ChogathLoadScreen_2.dds" },
                3: { image: "ChogathLoadScreen_3.dds" },
                1: { image: "ChogathLoadScreen_1.DDS" },
            }
        },
        "Anivia": {
            icon: "Info/Cryophoenix_Square.dds",
            skins: {
                1: { image: "AniviaLoadScreen_1.DDS" },
                2: { image: "AniviaLoadScreen_2.DDS" },
                0: { image: "AniviaLoadScreen.dds" },
                3: { image: "AniviaLoadScreen_3.dds" },
                4: { image: "AniviaLoadScreen_4.dds" },
            }
        },
        "Rammus": {
            icon: "Info/Armordillo_Square.dds",
            skins: {
                4: { image: "RammusLoadScreen_4.dds" },
                1: { image: "RammusLoadScreen_1.DDS" },
                5: { image: "RammusLoadScreen_5.dds" },
                0: { image: "RammusLoadScreen.dds" },
                3: { image: "RammusLoadScreen_3.dds" },
                2: { image: "RammusLoadScreen_2.dds" },
            }
        },
        "Veigar": {
            icon: "Info/Veigar_Square.dds",
            skins: {
                2: { image: "VeigarLoadscreen_2.DDS" },
                1: { image: "VeigarLoadscreen_1.dds" },
                3: { image: "VeigarLoadscreen_3.dds" },
                4: { image: "VeigarLoadscreen_4.dds" },
                0: { image: "VeigarLoadscreen.dds" },
                5: { image: "VeigarLoadscreen_5.dds" },
            }
        },
        "Kassadin": {
            icon: "Info/Kassadin_Square.dds",
            skins: {
                2: { image: "KassadinLoadScreen_2.dds" },
                4: { image: "KassadinLoadScreen_4.dds" },
                3: { image: "KassadinLoadScreen_3.dds" },
                0: { image: "KassadinLoadScreen.dds" },
                1: { image: "KassadinLoadScreen_1.DDS" },
            }
        },
        "Gangplank": {
            icon: "Info/Pirate_Square.dds",
            skins: {
                3: { image: "GangplankLoadScreen_3.dds" },
                0: { image: "GangplankLoadScreen.dds" },
                1: { image: "GangplankLoadScreen_1.DDS" },
                2: { image: "GangplankLoadScreen_2.dds" },
            }
        },
        "Taric": {
            icon: "Info/GemKnight_Square.dds",
            skins: {
                1: { image: "TaricLoadScreen_1.DDS" },
                0: { image: "TaricLoadScreen.dds" },
                2: { image: "TaricLoadScreen_2.DDS" },
                3: { image: "TaricLoadScreen_3.dds" },
            }
        },
        "Blitzcrank": {
            icon: "Info/Steamgolem_Square.dds",
            skins: {
                2: { image: "BlitzcrankLoadScreen_2.dds" },
                1: { image: "BlitzcrankLoadScreen_1.DDS" },
                4: { image: "BlitzcrankLoadScreen_4.dds" },
                0: { image: "BlitzcrankLoadScreen.dds" },
                3: { image: "BlitzcrankLoadScreen_3.dds" },
            }
        },
        "DrMundo": {
            icon: "Info/DrMundo_Square.dds",
            skins: {
                5: { image: "DrMundoLoadScreen_5.dds" },
                0: { image: "DrMundoLoadScreen.dds" },
                2: { image: "DrMundoLoadScreen_2.DDS" },
                4: { image: "DrMundoLoadScreen_4.dds" },
                1: { image: "DrMundoLoadScreen_1.dds" },
                3: { image: "DrMundoLoadScreen_3.dds" },
            }
        },
        "Janna": {
            icon: "info/Janna_Square.dds",
            skins: {
                2: { image: "JannaLoadScreen_2.dds" },
                0: { image: "JannaLoadScreen.dds" },
                1: { image: "JannaLoadScreen_1.dds" },
            }
        },
        "Malphite": {
            icon: "info/Malphite_Square.dds",
            skins: {
                0: { image: "MalphiteLoadScreen.dds" },
                1: { image: "MalphiteLoadScreen_1.DDS" },
                3: { image: "MalphiteLoadScreen_3.dds" },
                4: { image: "MalphiteLoadScreen_4.dds" },
                2: { image: "MalphiteLoadScreen_2.dds" },
            }
        },
        "Corki": {
            icon: "Info/Corki_Square.dds",
            skins: {
                2: { image: "CorkiLoadScreen_2.DDS" },
                1: { image: "CorkiLoadScreen_1.DDS" },
                3: { image: "CorkiLoadScreen_3.DDS" },
                4: { image: "CorkiLoadScreen_4.dds" },
                0: { image: "CorkiLoadScreen.dds" },
                5: { image: "CorkiLoadScreen_5.dds" },
            }
        },
        "Katarina": {
            icon: "Info/Katarina_Square.dds",
            skins: {
                0: { image: "KatarinaLoadScreen.dds" },
                3: { image: "KatarinaLoadScreen_3.dds" },
                1: { image: "KatarinaLoadScreen_1.DDS" },
                4: { image: "KatarinaLoadScreen_4.dds" },
                5: { image: "KatarinaLoadScreen_5.dds" },
                2: { image: "KatarinaLoadScreen_2.dds" },
            }
        },
        "Nasus": {
            icon: "Info/Nasus_Square.dds",
            skins: {
                4: { image: "NasusLoadScreen_4.dds" },
                3: { image: "NasusLoadScreen_3.dds" },
                0: { image: "NasusLoadScreen.dds" },
                1: { image: "NasusLoadScreen_1.dds" },
                2: { image: "NasusLoadScreen_2.dds" },
            }
        },
        "Heimerdinger": {
            icon: "info/Heimerdinger_Square.dds",
            skins: {
                1: { image: "HeimerdingerLoadScreen_1.dds" },
                2: { image: "HeimerdingerLoadScreen_2.dds" },
                0: { image: "HeimerdingerLoadScreen.dds" },
                3: { image: "HeimerdingerLoadScreen_3.dds" },
            }
        },
        "Shaco": {
            icon: "Info/Jester_Square.dds",
            skins: {
                4: { image: "ShacoLoadScreen_4.dds" },
                2: { image: "ShacoLoadScreen_2.dds" },
                0: { image: "ShacoLoadScreen.dds" },
                1: { image: "ShacoLoadScreen_1.dds" },
                3: { image: "ShacoLoadScreen_3.dds" },
            }
        },
        "Udyr": {
            icon: "Info/Udyr_Square.dds",
            skins: {
                2: { image: "UdyrLoadScreen_2.dds" },
                0: { image: "UdyrLoadScreen.dds" },
                1: { image: "UdyrLoadScreen_1.dds" },
            }
        },
        "Nidalee": {
            icon: "Info/Nidalee_Square.dds",
            skins: {
                4: { image: "nidaleeLoadScreen_4.dds" },
                2: { image: "nidaleeLoadScreen_2.DDS" },
                3: { image: "nidaleeLoadScreen_3.DDS" },
                1: { image: "nidaleeLoadScreen_1.dds" },
                0: { image: "nidaleeLoadScreen.dds" },
            }
        },
        "Poppy": {
            icon: "info/Poppy_Square.dds",
            skins: {
                5: { image: "PoppyLoadScreen_5.dds" },
                0: { image: "PoppyLoadScreen.dds" },
                3: { image: "PoppyLoadScreen_3.dds" },
                4: { image: "PoppyLoadScreen_4.dds" },
                2: { image: "PoppyLoadScreen_2.dds" },
                1: { image: "PoppyLoadScreen_1.DDS" },
            }
        },
        "Gragas": {
            icon: "Info/Gragas_Square.dds",
            skins: {
                0: { image: "GragasLoadScreen.dds" },
                1: { image: "GragasLoadScreen_1.DDS" },
                3: { image: "GragasLoadScreen_3.dds" },
                2: { image: "GragasLoadScreen_2.dds" },
                4: { image: "GragasLoadScreen_4.dds" },
            }
        },
        "Pantheon": {
            icon: "Info/Pantheon_Square.dds",
            skins: {
                2: { image: "PantheonLoadScreen_2.DDS" },
                4: { image: "PantheonLoadScreen_4.dds" },
                3: { image: "PantheonLoadScreen_3.dds" },
                1: { image: "PantheonLoadScreen_1.DDS" },
                0: { image: "PantheonLoadScreen.dds" },
            }
        },
        "Mordekaiser": {
            icon: "Info/Mordekaiser_Square.dds",
            skins: {
                5: { image: "MordekaiserLoadScreen_5.dds" },
                2: { image: "MordekaiserLoadScreen_2.DDS" },
                1: { image: "MordekaiserLoadScreen_1.DDS" },
                3: { image: "MordekaiserLoadScreen_3.dds" },
                0: { image: "MordekaiserLoadScreen.dds" },
                4: { image: "MordekaiserLoadScreen_4.dds" },
            }
        },
        "Ezreal": {
            icon: "Info/Ezreal_Square.dds",
            skins: {
                4: { image: "EzrealLoadScreen_4.dds" },
                3: { image: "EzrealLoadScreen_3.dds" },
                0: { image: "EzrealLoadScreen.dds" },
                2: { image: "EzrealLoadScreen_2.dds" },
                1: { image: "EzrealLoadScreen_1.DDS" },
            }
        },
        "Shen": {
            icon: "info/Shen_Square.dds",
            skins: {
                3: { image: "ShenLoadScreen_3.dds" },
                4: { image: "ShenLoadScreen_4.dds" },
                2: { image: "ShenLoadScreen_2.DDS" },
                1: { image: "ShenLoadScreen_1.DDS" },
                0: { image: "ShenLoadScreen.dds" },
            }
        },
        "Kennen": {
            icon: "Info/Kennen_Square.dds",
            skins: {
                4: { image: "KennenLoadScreen_4.dds" },
                2: { image: "KennenLoadScreen_2.DDS" },
                1: { image: "KennenLoadScreen_1.DDS" },
                3: { image: "KennenLoadScreen_3.dds" },
                0: { image: "KennenLoadScreen.dds" },
            }
        },
        "Garen": {
            icon: "Info/Garen_Square.dds",
            skins: {
                4: { image: "GarenLoadScreen_4.dds" },
                3: { image: "GarenLoadScreen_3.dds" },
                5: { image: "GarenLoadScreen_5.dds" },
                0: { image: "GarenLoadScreen.dds" },
                1: { image: "GarenLoadScreen_1.DDS" },
                2: { image: "GarenLoadScreen_2.DDS" },
            }
        },
        "Akali": {
            icon: "Info/Akali_Square_0.dds",
            skins: {
                0: { image: "AkaliLoadScreen.dds" },
                3: { image: "AkaliLoadScreen_3.dds" },
                5: { image: "AkaliLoadScreen_5.dds" },
                4: { image: "AkaliLoadScreen_4.dds" },
                1: { image: "AkaliLoadScreen_1.DDS" },
                2: { image: "AkaliLoadScreen_2.DDS" },
            }
        },
        "Malzahar": {
            icon: "info/Malzahar_Square.dds",
            skins: {
                3: { image: "MalzaharLoadScreen_3.dds" },
                0: { image: "MalzaharLoadscreen.dds" },
                2: { image: "MalzaharLoadScreen_2.dds" },
                4: { image: "MalzaharLoadScreen_4.dds" },
                1: { image: "MalzaharLoadScreen_1.dds" },
            }
        },
        "Olaf": {
            icon: "Info/Olaf_Square.dds",
            skins: {
                3: { image: "OlafLoadScreen_3.dds" },
                2: { image: "OlafLoadScreen_2.dds" },
                1: { image: "OlafLoadScreen_1.dds" },
                0: { image: "OlafLoadScreen.dds" },
            }
        },
        "KogMaw": {
            icon: "Info/Kog'Maw_Square_0.dds",
            skins: {
                0: { image: "KogMawLoadScreen.dds" },
                3: { image: "KogMawLoadScreen_3.dds" },
                6: { image: "KogMawLoadScreen_6.dds" },
                2: { image: "KogMawLoadScreen_2.dds" },
                5: { image: "KogMawLoadScreen_5.dds" },
                1: { image: "KogMawLoadScreen_1.dds" },
                4: { image: "KogMawLoadScreen_4.dds" },
            }
        },
        "XinZhao": {
            icon: "Info/XenZhao_Square.dds",
            skins: {
                3: { image: "XinZhaoLoadScreen_3.dds" },
                1: { image: "XinZhaoLoadScreen_1.dds" },
                0: { image: "XinZhaoLoadScreen.dds" },
                2: { image: "XinZhaoLoadScreen_2.dds" },
                4: { image: "XinZhaoLoadScreen_4.dds" },
            }
        },
        "Vladimir": {
            icon: "Info/Vladimir_Square_0.dds",
            skins: {
                1: { image: "VladimirLoadScreen_1.dds" },
                4: { image: "VladimirLoadScreen_4.dds" },
                0: { image: "VladimirLoadScreen.dds" },
                3: { image: "VladimirLoadScreen_3.dds" },
                2: { image: "VladimirLoadScreen_2.dds" },
            }
        },
        "Galio": {
            icon: "info/Galio_Square.dds",
            skins: {
                3: { image: "GalioLoadScreen_3.dds" },
                0: { image: "GalioLoadScreen.dds" },
                1: { image: "GalioLoadScreen_1.dds" },
                2: { image: "GalioLoadScreen_2.dds" },
            }
        },
        "Urgot": {
            icon: "Info/Urgot_Square_0.dds",
            skins: {
                1: { image: "urgotLoadScreen_1.DDS" },
                2: { image: "urgotLoadScreen_2.dds" },
                0: { image: "urgotLoadScreen.dds" },
            }
        },
        "MissFortune": {
            icon: "Info/MissFortune_Square.dds",
            skins: {
                4: { image: "MissFortuneLoadScreen_4.dds" },
                1: { image: "MissFortuneLoadScreen_1.dds" },
                5: { image: "MissFortuneLoadScreen_5.dds" },
                0: { image: "MissFortuneLoadScreen.dds" },
                3: { image: "MissFortuneLoadScreen_3.dds" },
                2: { image: "MissFortuneLoadScreen_2.dds" },
            }
        },
        "Sona": {
            icon: "info/Sona_Square.dds",
            skins: {
                0: { image: "SonaLoadScreen.dds" },
                1: { image: "SonaLoadScreen_1.dds" },
                3: { image: "SonaLoadScreen_3.dds" },
                2: { image: "SonaLoadScreen_2.dds" },
            }
        },
        "Swain": {
            icon: "Info/Swain_Square_0.dds",
            skins: {
                1: { image: "SwainLoadScreen_1.DDS" },
                0: { image: "SwainLoadScreen.dds" },
                2: { image: "SwainLoadScreen_2.dds" },
            }
        },
        "Lux": {
            icon: "Info/Lux_Square.dds",
            skins: {
                1: { image: "LuxLoadScreen_1.dds" },
                0: { image: "LuxLoadScreen.dds" },
                3: { image: "LuxLoadScreen_3.dds" },
                2: { image: "LuxLoadScreen_2.dds" },
            }
        },
        "Leblanc": {
            icon: "Info/Leblanc_Square.dds",
            skins: {
                1: { image: "LeblancLoadScreen_1.dds" },
                0: { image: "LeblancLoadScreen.DDS" },
                2: { image: "LeblancLoadScreen_2.dds" },
            }
        },
        "Irelia": {
            icon: "Info/Irelia_Square_0.dds",
            skins: {
                3: { image: "IreliaLoadScreen_3.dds" },
                1: { image: "IreliaLoadScreen_1.dds" },
                2: { image: "IreliaLoadScreen_2.dds" },
                0: { image: "IreliaLoadScreen.dds" },
            }
        },
        "Trundle": {
            icon: "Info/Trundle_Square.dds",
            skins: {
                0: { image: "TrundleLoadScreen.dds" },
                1: { image: "TrundleLoadScreen_1.dds" },
                2: { image: "TrundleLoadScreen_2.dds" },
            }
        },
        "Cassiopeia": {
            icon: "Info/Cassiopeia_Square_0.dds",
            skins: {
                2: { image: "cassiopeiaLoadScreen_2.dds" },
                1: { image: "cassiopeiaLoadScreen_1.dds" },
                0: { image: "cassiopeiaLoadScreen.DDS" },
            }
        },
        "Caitlyn": {
            icon: "Info/Caitlyn_Square_0.dds",
            skins: {
                3: { image: "CaitlynLoadScreen_3.dds" },
                4: { image: "CaitlynLoadScreen_4.dds" },
                2: { image: "CaitlynLoadScreen_2.dds" },
                5: { image: "CaitlynLoadScreen_5.dds" },
                1: { image: "CaitlynLoadScreen_1.dds" },
                0: { image: "CaitlynLoadScreen.dds" },
            }
        },
        "Renekton": {
            icon: "Info/Renekton_Square_0.dds",
            skins: {
                3: { image: "RenektonLoadScreen_3.dds" },
                1: { image: "RenektonLoadScreen_1.dds" },
                0: { image: "RenektonLoadScreen.dds" },
                2: { image: "RenektonLoadScreen_2.dds" },
            }
        },
        "Karma": {
            icon: "Info/KarmaSquare.dds",
            skins: {
                0: { image: "KarmaLoadScreen.dds" },
                2: { image: "KarmaLoadScreen_2.dds" },
                1: { image: "KarmaLoadScreen_1.dds" },
            }
        },
        "Maokai": {
            icon: "Info/Maokai_Square.dds",
            skins: {
                0: { image: "MaokaiLoadScreen.DDS" },
                2: { image: "MaokaiLoadScreen_2.DDS" },
                1: { image: "MaokaiLoadScreen_1.dds" },
            }
        },
        "JarvanIV": {
            icon: "Info/JarvanIV_Square_0.dds",
            skins: {
                1: { image: "JarvanIVLoadScreen_1.dds" },
                4: { image: "JarvanIVLoadScreen_4.dds" },
                0: { image: "JarvanIVLoadScreen.dds" },
                3: { image: "JarvanIVLoadScreen_3.dds" },
                2: { image: "JarvanIVLoadScreen_2.dds" },
            }
        },
        "Nocturne": {
            icon: "Info/Nocturne_Square_0.dds",
            skins: {
                1: { image: "NocturneLoadScreen_1.dds" },
                3: { image: "NocturneLoadScreen_3.dds" },
                2: { image: "NocturneLoadScreen_2.dds" },
                0: { image: "NocturneLoadScreen.dds" },
            }
        },
        "LeeSin": {
            icon: "info/LeeSin_Square.dds",
            skins: {
                1: { image: "LeeSinLoadscreen_1.dds" },
                0: { image: "LeeSinLoadscreen.dds" },
                2: { image: "LeeSinLoadscreen_2.dds" },
            }
        },
        "Brand": {
            icon: "info/Brand_Square.dds",
            skins: {
                3: { image: "BrandLoadScreen_3.dds" },
                2: { image: "BrandLoadScreen_2.dds" },
                0: { image: "BrandLoadScreen.dds" },
                1: { image: "BrandLoadScreen_1.dds" },
            }
        },
        "Rumble": {
            icon: "Info/Rumble_Square.dds",
            skins: {
                1: { image: "RumbleLoadScreen_1.dds" },
                2: { image: "RumbleLoadScreen_2.dds" },
                0: { image: "RumbleLoadScreen.dds" },
            }
        },
        "Vayne": {
            icon: "Info/Vayne_Square.dds",
            skins: {
                0: { image: "VayneLoadScreen.dds" },
                1: { image: "VayneLoadScreen_1.dds" },
                2: { image: "VayneLoadScreen_2.dds" },
                3: { image: "VayneLoadScreen_3.dds" },
            }
        },
        "Orianna": {
            icon: "Info/Oriana_Square.dds",
            skins: {
                1: { image: "OriannaLoadscreen_1.dds" },
                0: { image: "OriannaLoadscreen.dds" },
                2: { image: "OriannaLoadscreen_2.dds" },
            }
        },
        "Yorick": {
            icon: "Info/Yorick_Square.dds",
            skins: {
                0: { image: "YorickLoadScreen.dds" },
                2: { image: "YorickLoadScreen_2.dds" },
                1: { image: "YorickLoadScreen_1.dds" },
            }
        },
        "Leona": {
            icon: "Info/Leona_Square.dds",
            skins: {
                2: { image: "LeonaLoadScreen_2.dds" },
                0: { image: "LeonaLoadScreen.dds" },
                1: { image: "LeonaLoadScreen_1.dds" },
            }
        },
        "MonkeyKing": {
            icon: "Info/MonkeyKing_Square.dds",
            skins: {
                0: { image: "MonkeyKingLoadScreen.dds" },
                1: { image: "MonkeyKingLoadScreen_1.dds" },
                2: { image: "MonkeyKingLoadScreen_2.dds" },
            }
        },
        "Skarner": {
            icon: "Info/Skarner_Square.dds",
            skins: {
                2: { image: "SkarnerLoadScreen_2.dds" },
                1: { image: "SkarnerLoadScreen_1.dds" },
                0: { image: "SkarnerLoadScreen.dds" },
            }
        },
        "Talon": {
            icon: "Info/Talon_Square_0.dds",
            skins: {
                0: { image: "TalonLoadScreen.dds" },
                1: { image: "TalonLoadScreen_1.dds" },
                2: { image: "TalonLoadScreen_2.dds" },
            }
        },
        "Riven": {
            icon: "Info/Riven_Square.dds",
            skins: {
                0: { image: "RivenLoadScreen.DDS" },
                1: { image: "RivenLoadScreen_1.dds" },
                2: { image: "RivenLoadScreen_2.dds" },
            }
        },
        "Xerath": {
            icon: "info/Xerath_Square_0.dds",
            skins: {
                0: { image: "XerathLoadscreen.dds" },
                1: { image: "XerathLoadScreen_1.dds" },
                2: { image: "XerathLoadScreen_2.dds" },
            }
        },
    }

    bots = [
        //'Alistar',
        'Annie',
        'Ashe',
        'Chogath',
        'Garen',
        'Malphite',
        'Maokai',
        'MasterYi',
        'MissFortune',
        'Nasus',
        'Nunu',
        //'Pantheon',
        'Renekton',
        'Ryze',
        'Shen',
        'Sivir',
        'Soraka',
        //'Swain',
        'Taric',
        'Trundle',
        'Warwick',
    ]
}
