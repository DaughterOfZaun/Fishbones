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
    zipInfoHashV1 = '75aac63d69927c2c002976faeecfb9340f387054'
    zipInfoHashV2 = '5900c1270e079756983123842c541ec79f9e0096237d964dabf387b00e786571'
    zipSize = 292992638
    size = 1091387112
    
    release = '0.9.22.14'
    preferC = false
    dir = ''

    zip = path.join(downloads, this.zipName)
    zipTorrentEmbedded = embedded.gcCB3ZipTorrent
    zipTorrentName = `${this.zipName}.torrent`
    zipTorrent = `${this.zip}.torrent`
    zipMagnet = magnet(this.zipInfoHashV1, this.zipInfoHashV2, this.zipName, this.zipSize)
    zipMega = 'https://mega.nz/file/KqA3jA7Q#Z1oxvJovNEXvG-s5hp9Y5xoAxNoMx0Otgk4JcQNC430'
    zipWebSeeds = [
        gdrive(`1eKgAvuwW8NCzjoPAqns-9EQwa89EOTCw`),
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
        //3: {},
        //4: {},
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
        "Annie": {
            icon: "Info/Annie_Square.dds",
            skins: {
                0: { image: "AnnieLoadScreen.dds" },
            },
        },
        "Armordillo": {
            icon: "Info/Armordillo_Square.dds",
            skins: {
                0: { image: "ArmordilloLoadScreen.dds" },
            },
        },
        "Armsmaster": {
            icon: "info/Armsmaster_Square.dds",
            skins: {
                0: { image: "ArmsmasterLoadScreen.dds" },
            },
        },
        "Bowmaster": {
            icon: "Info/Bowmaster_Square.dds",
            skins: {
                0: { image: "BowmasterLoadScreen.dds" },
            },
        },
        "CardMaster": {
            icon: "Info/Cardmaster_Square.dds",
            skins: {
                0: { image: "cardmasterLoadScreen.dds" },
            },
        },
        "ChemicalMan": {
            icon: "Info/ChemicalMan_Square.dds",
            skins: {
                0: { image: "ChemicalManLoadScreen.dds" },
            },
        },
        "Chronokeeper": {
            icon: "Info/Chronokeeper_Square.dds",
            skins: {
                0: { image: "chronokeeperLoadScreen.dds" },
            },
        },
        "Cryophoenix": {
            icon: "Info/Cryophoenix_Square.dds",
            skins: {
                0: { image: "cryophoenixLoadScreen.dds" },
            },
        },
        "DarkChampion": {
            icon: "Info/DarkChampion_Square.dds",
            skins: {
                0: { image: "DarkChampionLoadScreen.dds" },
            },
        },
        "DrMundo": {
            icon: "Info/DrMundo_Square.dds",
            skins: {
                0: { image: "DrMundoLoadScreen.dds" },
            },
        },
        "Evelynn": {
            icon: "Info/Evelynn_Square.dds",
            skins: {
                0: { image: "evelynnLoadScreen.dds" },
            },
        },
        "FallenAngel": {
            icon: "Info/FallenAngel_Square.dds",
            skins: {
                0: { image: "fallenangelLoadScreen.dds" },
            },
        },
        "FiddleSticks": {
            icon: "info/Fiddlesticks_Square.dds",
            skins: {
                0: { image: "fiddlesticksLoadScreen.dds" },
            },
        },
        "GemKnight": {
            icon: "Info/GemKnight_Square.dds",
            skins: {
                0: { image: "GemKnightloadscreen.dds" },
            },
        },
        "GreenTerror": {
            icon: "Info/GreenTerror_Square.dds",
            skins: {
                0: { image: "GreenTerrorLoadScreen.dds" },
            },
        },
        "Janna": {
            icon: "info/Janna_Square.dds",
            skins: {
                0: { image: "JannaLoadScreen.dds" },
            },
        },
        "Jester": {
            icon: "Info/Jester_Square.dds",
            skins: {
                0: { image: "jesterLoadScreen.dds" },
            },
        },
        "Judicator": {
            icon: "Info/Judicator_Square.dds",
            skins: {
                0: { image: "JudicatorLoadScreen.dds" },
            },
        },
        "Lich": {
            icon: "Info/Lich_Square.dds",
            skins: {
                0: { image: "lichLoadScreen.dds" },
            },
        },
        "MasterYi": {
            icon: "Info/MasterYi_Square.dds",
            skins: {
                0: { image: "MasterYiLoadScreen.dds" },
            },
        },
        "Minotaur": {
            icon: "Info/Minotaur_Square.dds",
            skins: {
                0: { image: "minotaurLoadScreen.dds" },
            },
        },
        "Permission": {
            icon: "Info/Pirate_Square.dds",
            skins: {
                0: { image: "permissionLoadscreen.dds" },
            },
        },
        "Pirate": {
            icon: "Info/Pirate_Square.dds",
            skins: {
                0: { image: "PirateLoadScreen.dds" },
            },
        },
        "Ryze": {
            icon: "Info/Ryze_Square.dds",
            skins: {
                0: { image: "RyzeLoadScreen.dds" },
            },
        },
        "SadMummy": {
            icon: "Info/SadMummy_Square.dds",
            skins: {
                0: { image: "SadMummyLoadScreen.dds" },
            },
        },
        "Sion": {
            icon: "Info/Sion_Square.dds",
            skins: {
                0: { image: "sionLoadScreen.dds" },
            },
        },
        "Sivir": {
            icon: "Info/Sivir_Square.dds",
            skins: {
                0: { image: "SivirLoadScreen.dds" },
            },
        },
        "Soraka": {
            icon: "info/Soraka_Square.dds",
            skins: {
                0: { image: "sorakaLoadScreen.dds" },
            },
        },
        "Teemo": {
            icon: "Info/Teemo_Square.dds",
            skins: {
                0: { image: "teemoLoadScreen.dds" },
            },
        },
        "Tristana": {
            icon: "Info/Tristana_Square.dds",
            skins: {
                0: { image: "tristanaLoadScreen.dds" },
            },
        },
        "Twitch": {
            icon: "Info/twitch_square.dds",
            skins: {
                0: { image: "twitchLoadScreen.dds" },
            },
        },
        "Voidwalker": {
            icon: "Info/Voidwalker_Square.dds",
            skins: {
                0: { image: "kassadinLoadScreen.dds" },
            },
        },
        "Wolfman": {
            icon: "Info/Wolfman_Square.dds",
            skins: {
                0: { image: "WolfmanLoadScreen.dds" },
            },
        },
        "Yeti": {
            icon: "Info/Yeti_Square.dds",
            skins: {
                0: { image: "YetiLoadScreen.dds" },
            },
        },
    }
}
