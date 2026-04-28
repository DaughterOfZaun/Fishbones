import path from 'node:path'
import { downloads } from '../fs'
import embedded from '../embedded/embedded'
import { gdrive, magnet } from './shared'
import { tr } from '../../translation'
import { args } from '../../args'
import { ClientDataInfoCommon, GC_LOCATION_AUTO, GCPkgCommon } from './game-client'
import { HARDCODED_HTTP_SERVER_URL } from '../../constants-build'
import type { ClientDataInfo } from '../constants/client-server-combinations'

args.gc420Location.on('change', location => gc420Pkg.setDirLocation(location))

export const gc420Pkg = new class extends GCPkgCommon {

    name = tr('Game Client')
    dirName = 'playable_client_420'
    makeDir = false
    zipExt = '7z'
    zipHasSingleRootEntry = true
    zipRoot = [ 'League of Legends_UNPACKED', 'League-of-Legends-4-20', 'RADS', 'solutions', 'lol_game_client_sln', 'releases', '0.0.1.68', 'deploy' ]
    zipName = `${this.zipRoot[0]!}.${this.zipExt}`
    zipInfoHashV1 = '4bb197635194f4242d9f937f0f9225851786a0a8'
    zipInfoHashV2 = ''
    zipSize = 2171262108
    size = 5991712821
    
    release = '0.0.1.68'
    preferC = false
    dir = ''

    zip = path.join(downloads, this.zipName)
    zipTorrentEmbedded = embedded.gc420ZipTorrent
    zipTorrentName = `${this.zipName}.torrent`
    zipTorrent = `${this.zip}.torrent`
    zipMagnet = magnet(this.zipInfoHashV1, this.zipInfoHashV2, this.zipName, this.zipSize)
    zipMega = 'https://mega.nz/file/Hr5XEAqT#veo2lfRWK7RrLUdFBBqRdUvxwr_gd8UyUL0f6b4pHJ0'
    zipWebSeeds = [
        gdrive(`17MxGQEgO0y7OUgRU5AXb1Mr2WF0emDVI`),
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
        'riotlauncher.dll',
        'msvcr120.dll',
        'msvcp120.dll',
        'LogitechLed.dll',
        'LogitechGkey.dll',
        'League of Legends.exe',
        'launcher.maestro.dll',
        'dbghelp.dll',
        'cgGL.dll',
        'cgD3D9.dll',
        'cg.dll',
        'bugsplatrc.dll',
        'bugsplat.dll',
        'BsSndRpt.exe',
        'atimgpud.dll',
    ]
    topLevelEntriesOptional = [
        'Logs',
        'Localization_Errors.txt',
        '2018-07-08_01-48-41_League of Legends.log',
        '-000000000000001_crash.json',
        'Launch.bat',
        'oldFiles.json',
        'files.json',
        'run.bat',
    ]

    constructor(){
        super()
        this.setDirLocation(GC_LOCATION_AUTO)
    }
}

export class ClientDataInfoV420 extends ClientDataInfoCommon implements ClientDataInfo {

    constructor(dir: string){
        super()
        this.appyDir(dir)
    }

    maps = {
        1: {},
        8: {},
        10: {},
        11: {},
        12: {},
    }
    
    spells = {
        "SummonerBarrier": { icon: "SummonerBarrier.dds" },
        //"SummonerBattleCry": { icon: "" },
        "SummonerBoost": { icon: "Summoner_Boost.dds" },
        "SummonerClairvoyance": { icon: "Summoner_Clairvoyance.dds" },
        "SummonerDot": { icon: "SummonerIgnite.dds" },
        "SummonerExhaust": { icon: "Summoner_Exhaust.dds" },
        "SummonerFlash": { icon: "Summoner_flash.dds" },
        "SummonerHaste": { icon: "Summoner_haste.dds" },
        "SummonerHeal": { icon: "Summoner_heal.dds" },
        //"SummonerIgnite": { icon: "SummonerIgnite.dds" },
        "SummonerMana": { icon: "SummonerMana.dds" },
        //"SummonerOdinGarrison": { icon: "SummonerGarrison.dds" },
        //"SummonerOdinPromote": { icon: "" },
        //"SummonerOdinSabotage": { icon: "" },
        //"SummonerPromoteSR": { icon: "" },
        //"SummonerRally": { icon: "" },
        "SummonerRevive": { icon: "Summoner_revive.dds" },
        "SummonerSmite": { icon: "Summoner_smite.dds" },
        "SummonerTeleport": { icon: "Summoner_teleport.dds" },
    }

    embeddedChampionIcons = "res://images/champion-icons-120x120.png"

    champions = {
        "Aatrox": {
            //icon: "HUD/Aatrox_Square.dds",
            icon: `${this.embeddedChampionIcons}:0`,
            skins: {
                0: { image: "Skins/Base/AatroxLoadScreen.dds" },
                1: { image: "Skins/Skin01/AatroxLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/AatroxLoadScreen_2.dds" },
            },
        },
        "Ahri": {
            //icon: "HUD/Ahri_Square.dds",
            icon: `${this.embeddedChampionIcons}:1`,
            skins: {
                0: { image: "Skins/Base/AhriLoadScreen.dds" },
                1: { image: "Skins/Skin01/AhriLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/AhriLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/AhriLoadScreen_3.dds" },
                4: { image: "Skins/Skin04/AhriLoadScreen_4.dds" },
            },
        },
        "Akali": {
            //icon: "Info/Akali_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:2`,
            skins: {
                0: { image: "AkaliLoadScreen.dds" },
                1: { image: "AkaliLoadScreen_1.DDS" },
                2: { image: "AkaliLoadScreen_2.DDS" },
                3: { image: "AkaliLoadScreen_3.dds" },
                4: { image: "AkaliLoadScreen_4.dds" },
                5: { image: "AkaliLoadScreen_5.dds" },
                6: { image: "AkaliLoadScreen_6.dds" },
            },
        },
        "Alistar": {
            //icon: "HUD/Minotaur_Square.dds",
            icon: `${this.embeddedChampionIcons}:3`,
            skins: {
                0: { image: "Skins/Base/AlistarLoadScreen.dds" },
                1: { image: "Skins/Skin01/AlistarLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/AlistarLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/AlistarLoadScreen_3.dds" },
                4: { image: "Skins/Skin04/AlistarLoadScreen_4.dds" },
                5: { image: "Skins/Skin05/AlistarLoadScreen_5.dds" },
                6: { image: "Skins/Skin06/AlistarLoadScreen_6.dds" },
                7: { image: "Skins/Skin07/AlistarLoadScreen_7.dds" },
            },
        },
        "Amumu": {
            //icon: "Info/Amumu_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:4`,
            skins: {
                0: { image: "AmumuLoadScreen.dds" },
                1: { image: "AmumuLoadScreen_1.DDS" },
                2: { image: "AmumuLoadScreen_2.DDS" },
                3: { image: "AmumuLoadScreen_3.dds" },
                4: { image: "AmumuLoadScreen_4.dds" },
                5: { image: "AmumuLoadScreen_5.dds" },
                6: { image: "AmumuLoadScreen_6.dds" },
                7: { image: "AmumuLoadScreen_7.dds" },
            },
        },
        "Anivia": {
            //icon: "Info/Cryophoenix_Square.dds",
            icon: `${this.embeddedChampionIcons}:5`,
            skins: {
                0: { image: "AniviaLoadScreen.dds" },
                1: { image: "AniviaLoadScreen_1.DDS" },
                2: { image: "AniviaLoadScreen_2.DDS" },
                3: { image: "AniviaLoadScreen_3.dds" },
                4: { image: "AniviaLoadScreen_4.dds" },
                5: { image: "AniviaLoadScreen_5.dds" },
            },
        },
        "Annie": {
            //icon: "HUD/Annie_Square.dds",
            icon: `${this.embeddedChampionIcons}:6`,
            skins: {
                0: { image: "Skins/Base/AnnieLoadScreen.dds" },
                1: { image: "Skins/Skin01/AnnieLoadScreen_1.DDS" },
                2: { image: "Skins/Skin02/AnnieLoadScreen_2.DDS" },
                3: { image: "Skins/Skin03/AnnieLoadScreen_3.dds" },
                4: { image: "Skins/Skin04/AnnieLoadScreen_4.dds" },
                5: { image: "Skins/Skin05/AnnieLoadScreen_5.dds" },
                6: { image: "Skins/Skin06/AnnieLoadScreen_6.dds" },
                7: { image: "Skins/Skin07/AnnieLoadScreen_7.dds" },
                8: { image: "Skins/Skin08/AnnieLoadScreen_8.dds" },
            },
        },
        "Ashe": {
            //icon: "HUD/Ashe_Square.dds",
            icon: `${this.embeddedChampionIcons}:7`,
            skins: {
                0: { image: "Skins/Base/AsheLoadScreen.dds" },
                1: { image: "Skins/Skin01/AsheLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/AsheLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/AsheLoadScreen_3.dds" },
                4: { image: "Skins/Skin04/AsheLoadScreen_4.dds" },
                5: { image: "Skins/Skin05/AsheLoadScreen_5.dds" },
                6: { image: "Skins/Skin06/AsheLoadScreen_6.dds" },
            },
        },
        "Azir": {
            //icon: "HUD/Azir_Square.dds",
            icon: `${this.embeddedChampionIcons}:8`,
            skins: {
                0: { image: "Skins/Base/AzirLoadScreen.dds" },
                1: { image: "Skins/Skin01/AzirLoadScreen_1.dds" },
            },
        },
        "Blitzcrank": {
            //icon: "Info/Steamgolem_Square.dds",
            icon: `${this.embeddedChampionIcons}:9`,
            skins: {
                0: { image: "BlitzcrankLoadScreen.dds" },
                1: { image: "BlitzcrankLoadScreen_1.DDS" },
                2: { image: "BlitzcrankLoadScreen_2.dds" },
                3: { image: "BlitzcrankLoadScreen_3.dds" },
                4: { image: "BlitzcrankLoadScreen_4.dds" },
                5: { image: "BlitzcrankLoadScreen_5.dds" },
                6: { image: "BlitzcrankLoadScreen_6.dds" },
                7: { image: "BlitzcrankLoadScreen_7.dds" },
            },
        },
        "Brand": {
            //icon: "info/Brand_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:10`,
            skins: {
                0: { image: "BrandLoadScreen.dds" },
                1: { image: "BrandLoadScreen_1.dds" },
                2: { image: "BrandLoadScreen_2.dds" },
                3: { image: "BrandLoadScreen_3.dds" },
                4: { image: "BrandLoadScreen_4.dds" },
            },
        },
        "Braum": {
            //icon: "HUD/Braum_Square.dds",
            icon: `${this.embeddedChampionIcons}:11`,
            skins: {
                0: { image: "Skins/Base/BraumLoadScreen.dds" },
                1: { image: "Skins/Skin01/BraumLoadScreen_1.dds" },
            },
        },
        "Caitlyn": {
            //icon: "HUD/Caitlyn_Square.dds",
            icon: `${this.embeddedChampionIcons}:12`,
            skins: {
                0: { image: "Skins/Base/CaitlynLoadScreen.dds" },
                1: { image: "Skins/Skin01/CaitlynLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/CaitlynLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/CaitlynLoadScreen_3.dds" },
                4: { image: "Skins/Skin04/CaitlynLoadScreen_4.dds" },
                5: { image: "Skins/Skin05/CaitlynLoadScreen_5.dds" },
                6: { image: "Skins/Skin06/CaitlynLoadScreen_6.dds" },
            },
        },
        "Cassiopeia": {
            //icon: "HUD/Cassiopeia_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:13`,
            skins: {
                0: { image: "Skins/Base/CassiopeiaLoadScreen.dds" },
                1: { image: "Skins/Skin01/CassiopeiaLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/CassiopeiaLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/CassiopeiaLoadScreen_3.dds" },
                4: { image: "Skins/Skin04/CassiopeiaLoadScreen_4.dds" },
            },
        },
        "Chogath": {
            //icon: "Info/GreenTerror_Square.dds",
            icon: `${this.embeddedChampionIcons}:14`,
            skins: {
                0: { image: "ChogathLoadScreen.dds" },
                1: { image: "ChogathLoadScreen_1.DDS" },
                2: { image: "ChogathLoadScreen_2.dds" },
                3: { image: "ChogathLoadScreen_3.dds" },
                4: { image: "ChogathLoadScreen_4.dds" },
                5: { image: "ChogathLoadScreen_5.dds" },
            },
        },
        "Corki": {
            //icon: "Info/Corki_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:15`,
            skins: {
                0: { image: "CorkiLoadScreen.dds" },
                1: { image: "CorkiLoadScreen_1.DDS" },
                2: { image: "CorkiLoadScreen_2.DDS" },
                3: { image: "CorkiLoadScreen_3.DDS" },
                4: { image: "CorkiLoadScreen_4.dds" },
                5: { image: "CorkiLoadScreen_5.dds" },
                6: { image: "CorkiLoadScreen_6.dds" },
                7: { image: "CorkiLoadScreen_7.dds" },
            },
        },
        "Darius": {
            //icon: "HUD/Darius_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:16`,
            skins: {
                0: { image: "Skins/Base/DariusLoadScreen.dds" },
                1: { image: "Skins/Skin01/DariusLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/DariusLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/DariusLoadScreen_3.dds" },
                4: { image: "DariusLoadScreen_4.dds" },
            },
        },
        "Diana": {
            //icon: "HUD/Diana_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:17`,
            skins: {
                0: { image: "Skins/Base/DianaLoadScreen.dds" },
                1: { image: "Skins/Skin01/DianaLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/DianaLoadScreen_2.dds" },
            },
        },
        "Draven": {
            //icon: "HUD/Draven_Square.dds",
            icon: `${this.embeddedChampionIcons}:18`,
            skins: {
                0: { image: "Skins/Base/DravenLoadScreen.dds" },
                1: { image: "Skins/Skin01/DravenLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/DravenLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/DravenLoadScreen_3.dds" },
            },
        },
        "DrMundo": {
            //icon: "Info/DrMundo_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:19`,
            skins: {
                0: { image: "DrMundoLoadScreen.dds" },
                1: { image: "DrMundoLoadScreen_1.dds" },
                2: { image: "DrMundoLoadScreen_2.DDS" },
                3: { image: "DrMundoLoadScreen_3.dds" },
                4: { image: "DrMundoLoadScreen_4.dds" },
                5: { image: "DrMundoLoadScreen_5.dds" },
                6: { image: "DrMundoLoadScreen_6.dds" },
                7: { image: "DrMundoLoadScreen_7.dds" },
            },
        },
        "Elise": {
            //icon: "HUD/Elise_Square.dds",
            icon: `${this.embeddedChampionIcons}:20`,
            skins: {
                0: { image: "Skins/Base/EliseLoadScreen.dds" },
                1: { image: "EliseLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/EliseLoadScreen_2.dds" },
            },
        },
        "Evelynn": {
            //icon: "Info/Evelynn_Square.dds",
            icon: `${this.embeddedChampionIcons}:21`,
            skins: {
                0: { image: "evelynnLoadScreen.dds" },
                1: { image: "evelynnLoadScreen_1.DDS" },
                2: { image: "evelynnLoadScreen_2.DDS" },
                3: { image: "evelynnLoadScreen_3.dds" },
                4: { image: "EvelynnLoadScreen_4.dds" },
            },
        },
        "Ezreal": {
            //icon: "Info/Ezreal_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:22`,
            skins: {
                0: { image: "EzrealLoadScreen.dds" },
                1: { image: "EzrealLoadScreen_1.DDS" },
                2: { image: "EzrealLoadScreen_2.dds" },
                3: { image: "EzrealLoadScreen_3.dds" },
                4: { image: "EzrealLoadScreen_4.dds" },
                5: { image: "EzrealLoadScreen_5.dds" },
                6: { image: "EzrealLoadScreen_6.dds" },
                7: { image: "EzrealLoadScreen_7.dds" },
            },
        },
        "FiddleSticks": {
            //icon: "info/Fiddlesticks_Square.dds",
            icon: `${this.embeddedChampionIcons}:23`,
            skins: {
                0: { image: "fiddlesticksLoadScreen.dds" },
                1: { image: "fiddlesticksLoadScreen_1.DDS" },
                2: { image: "fiddlesticksLoadScreen_2.DDS" },
                3: { image: "fiddlesticksLoadScreen_3.dds" },
                4: { image: "fiddlesticksLoadScreen_4.dds" },
                5: { image: "fiddlesticksLoadScreen_5.dds" },
                6: { image: "fiddlesticksLoadScreen_6.dds" },
                7: { image: "FiddlesticksLoadScreen_7.dds" },
            },
        },
        "Fiora": {
            //icon: "Info/Fiora_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:24`,
            skins: {
                0: { image: "FioraLoadScreen.dds" },
                1: { image: "FioraLoadScreen_1.dds" },
                2: { image: "FioraLoadScreen_2.dds" },
                3: { image: "FioraLoadScreen_3.dds" },
            },
        },
        "Fizz": {
            //icon: "Info/Fizz_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:25`,
            skins: {
                0: { image: "FizzLoadScreen.dds" },
                1: { image: "FizzLoadScreen_1.dds" },
                2: { image: "FizzLoadScreen_2.dds" },
                3: { image: "FizzLoadScreen_3.dds" },
                4: { image: "FizzLoadScreen_4.dds" },
            },
        },
        "Galio": {
            //icon: "info/Galio_Square.dds",
            icon: `${this.embeddedChampionIcons}:26`,
            skins: {
                0: { image: "GalioLoadScreen.dds" },
                1: { image: "GalioLoadScreen_1.dds" },
                2: { image: "GalioLoadScreen_2.dds" },
                3: { image: "GalioLoadScreen_3.dds" },
                4: { image: "GalioLoadScreen_4.dds" },
            },
        },
        "Gangplank": {
            //icon: "HUD/Pirate_Square.dds",
            icon: `${this.embeddedChampionIcons}:27`,
            skins: {
                0: { image: "Skins/Base/GangplankLoadScreen.dds" },
                1: { image: "Skins/Skin01/GangplankLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/GangplankLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/GangplankLoadScreen_3.dds" },
                4: { image: "Skins/Skin04/GangplankLoadScreen_4.dds" },
                5: { image: "Skins/Skin05/GangplankLoadScreen_5.dds" },
                6: { image: "Skins/Skin06/GangplankLoadScreen_6.dds" },
            },
        },
        "Garen": {
            //icon: "HUD/Garen_Square.dds",
            icon: `${this.embeddedChampionIcons}:28`,
            skins: {
                0: { image: "Skins/Base/GarenLoadScreen.dds" },
                1: { image: "Skins/Skin01/GarenLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/GarenLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/GarenLoadScreen_3.dds" },
                4: { image: "Skins/Skin04/GarenLoadScreen_4.dds" },
                5: { image: "Skins/Skin05/GarenLoadScreen_5.dds" },
                6: { image: "Skins/Skin06/GarenLoadScreen_6.dds" },
            },
        },
        "Gnar": {
            //icon: "HUD/Gnar_Square.dds",
            icon: `${this.embeddedChampionIcons}:29`,
            skins: {
                0: { image: "Skins/Base/GnarLoadScreen.dds" },
                1: { image: "Skins/Skin01/GnarLoadScreen_1.dds" },
            },
        },
        "Gragas": {
            //icon: "HUD/Gragas_Square.dds",
            icon: `${this.embeddedChampionIcons}:30`,
            skins: {
                0: { image: "Skins/Base/GragasLoadScreen.dds" },
                1: { image: "Skins/Skin01/GragasLoadScreen_1.DDS" },
                2: { image: "Skins/Skin02/GragasLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/GragasLoadScreen_3.dds" },
                4: { image: "Skins/Skin04/GragasLoadScreen_4.dds" },
                5: { image: "Skins/Skin05/GragasLoadScreen_5.dds" },
                6: { image: "Skins/Skin06/GragasLoadScreen_6.dds" },
                7: { image: "Skins/Skin07/GragasLoadScreen_7.dds" },
                8: { image: "Skins/Skin08/GragasLoadScreen_8.dds" },
            },
        },
        "Graves": {
            //icon: "Info/Graves_Square.dds",
            icon: `${this.embeddedChampionIcons}:31`,
            skins: {
                0: { image: "GravesLoadScreen.dds" },
                1: { image: "GravesLoadScreen_1.dds" },
                2: { image: "GravesLoadScreen_2.dds" },
                3: { image: "GravesLoadScreen_3.dds" },
                4: { image: "GravesLoadScreen_4.dds" },
                5: { image: "GravesLoadScreen_5.dds" },
            },
        },
        "Hecarim": {
            //icon: "Info/Hecarim_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:32`,
            skins: {
                0: { image: "HecarimLoadScreen.dds" },
                1: { image: "HecarimLoadScreen_1.dds" },
                2: { image: "HecarimLoadScreen_2.dds" },
                3: { image: "HecarimLoadScreen_3.dds" },
                4: { image: "HecarimLoadScreen_4.dds" },
                5: { image: "HecarimLoadScreen_5.dds" },
            },
        },
        "Heimerdinger": {
            //icon: "HUD/Heimerdinger_Square.dds",
            icon: `${this.embeddedChampionIcons}:33`,
            skins: {
                0: { image: "Skins/Base/HeimerdingerLoadScreen.dds" },
                1: { image: "Skins/Skin01/HeimerdingerLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/HeimerdingerLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/HeimerdingerLoadScreen_3.dds" },
                4: { image: "Skins/Skin04/HeimerdingerLoadScreen_4.dds" },
                5: { image: "Skins/Skin05/HeimerdingerLoadScreen_5.dds" },
            },
        },
        "Irelia": {
            //icon: "Info/Irelia_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:34`,
            skins: {
                0: { image: "IreliaLoadScreen.dds" },
                1: { image: "IreliaLoadScreen_1.dds" },
                2: { image: "IreliaLoadScreen_2.dds" },
                3: { image: "IreliaLoadScreen_3.dds" },
                4: { image: "IreliaLoadScreen_4.dds" },
            },
        },
        "Janna": {
            //icon: "HUD/Janna_Square.dds",
            icon: `${this.embeddedChampionIcons}:35`,
            skins: {
                0: { image: "Skins/Base/JannaLoadScreen.dds" },
                1: { image: "Skins/Skin01/JannaLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/JannaLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/JannaLoadScreen_3.dds" },
                4: { image: "Skins/Skin04/JannaLoadScreen_4.dds" },
                5: { image: "Skins/Skin05/JannaLoadScreen_5.dds" },
                6: { image: "Skins/Skin06/JannaLoadScreen_6.dds" },
            },
        },
        "JarvanIV": {
            //icon: "Info/JarvanIV_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:36`,
            skins: {
                0: { image: "JarvanIVLoadScreen.dds" },
                1: { image: "JarvanIVLoadScreen_1.dds" },
                2: { image: "JarvanIVLoadScreen_2.dds" },
                3: { image: "JarvanIVLoadScreen_3.dds" },
                4: { image: "JarvanIVLoadScreen_4.dds" },
                5: { image: "JarvanIVLoadScreen_5.dds" },
                6: { image: "JarvanIVLoadScreen_6.dds" },
            },
        },
        "Jax": {
            //icon: "info/Jax_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:37`,
            skins: {
                0: { image: "JaxLoadScreen.dds" },
                1: { image: "JaxLoadScreen_1.DDS" },
                2: { image: "JaxLoadScreen_2.DDS" },
                3: { image: "JaxLoadScreen_3.dds" },
                4: { image: "JaxLoadScreen_4.dds" },
                5: { image: "JaxLoadScreen_5.dds" },
                6: { image: "JaxLoadScreen_6.dds" },
                7: { image: "JaxLoadScreen_7.dds" },
                8: { image: "JaxLoadScreen_8.dds" },
            },
        },
        "Jayce": {
            //icon: "HUD/Jayce_Square.dds",
            icon: `${this.embeddedChampionIcons}:38`,
            skins: {
                0: { image: "Skins/Base/JayceLoadScreen.dds" },
                1: { image: "Skins/Skin01/JayceLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/JayceLoadScreen_2.dds" },
            },
        },
        "Jinx": {
            //icon: "HUD/Jinx_Square.dds",
            icon: `${this.embeddedChampionIcons}:39`,
            skins: {
                0: { image: "Skins/Base/JinxLoadScreen.dds" },
                1: { image: "Skins/Skin01/JinxLoadScreen_1.dds" },
            },
        },
        "Kalista": {
            //icon: "HUD/Kalista_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:40`,
            skins: {
                0: { image: "Skins/Base/KalistaLoadScreen.dds" },
                1: { image: "Skins/Skin01/KalistaLoadScreen_1.dds" },
            },
        },
        "Karma": {
            //icon: "HUD/Karma_Square.dds",
            icon: `${this.embeddedChampionIcons}:41`,
            skins: {
                0: { image: "Skins/Base/KarmaLoadScreen.dds" },
                1: { image: "Skins/Skin01/KarmaLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/KarmaLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/KarmaLoadScreen_3.dds" },
                4: { image: "Skins/Skin04/KarmaLoadScreen_4.dds" },
            },
        },
        "Karthus": {
            //icon: "HUD/Karthus_Square.dds",
            icon: `${this.embeddedChampionIcons}:42`,
            skins: {
                0: { image: "KarthusLoadScreen.dds" },
                1: { image: "Skins/Skin01/KarthusLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/KarthusLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/KarthusLoadScreen_3.dds" },
                4: { image: "Skins/Skin04/KarthusLoadScreen_4.dds" },
                5: { image: "Skins/Skin05/KarthusLoadScreen_5.dds" },
            },
        },
        "Kassadin": {
            //icon: "Info/Kassadin_Square.dds",
            icon: `${this.embeddedChampionIcons}:43`,
            skins: {
                0: { image: "KassadinLoadScreen.dds" },
                1: { image: "KassadinLoadScreen_1.DDS" },
                2: { image: "KassadinLoadScreen_2.dds" },
                3: { image: "KassadinLoadScreen_3.dds" },
                4: { image: "KassadinLoadScreen_4.dds" },
            },
        },
        "Katarina": {
            //icon: "Info/Katarina_Square.dds",
            icon: `${this.embeddedChampionIcons}:44`,
            skins: {
                0: { image: "KatarinaLoadScreen.dds" },
                1: { image: "KatarinaLoadScreen_1.DDS" },
                2: { image: "KatarinaLoadScreen_2.dds" },
                3: { image: "KatarinaLoadScreen_3.dds" },
                4: { image: "KatarinaLoadScreen_4.dds" },
                5: { image: "KatarinaLoadScreen_5.dds" },
                6: { image: "KatarinaLoadScreen_6.dds" },
                7: { image: "KatarinaLoadScreen_7.dds" },
            },
        },
        "Kayle": {
            //icon: "HUD/Kayle_Square.dds",
            icon: `${this.embeddedChampionIcons}:45`,
            skins: {
                0: { image: "KayleLoadScreen.dds" },
                1: { image: "KayleLoadScreen_1.DDS" },
                2: { image: "KayleLoadScreen_2.dds" },
                3: { image: "KayleLoadScreen_3.dds" },
                4: { image: "KayleLoadScreen_4.dds" },
                5: { image: "KayleLoadScreen_5.dds" },
                6: { image: "KayleLoadScreen_6.dds" },
                7: { image: "KayleLoadScreen_7.dds" },
            },
        },
        "Kennen": {
            //icon: "Info/Kennen_Square.dds",
            icon: `${this.embeddedChampionIcons}:46`,
            skins: {
                0: { image: "KennenLoadScreen.dds" },
                1: { image: "KennenLoadScreen_1.DDS" },
                2: { image: "KennenLoadScreen_2.DDS" },
                3: { image: "KennenLoadScreen_3.dds" },
                4: { image: "KennenLoadScreen_4.dds" },
                5: { image: "KennenLoadScreen_5.dds" },
            },
        },
        "Khazix": {
            //icon: "HUD/Khazix_Square.dds",
            icon: `${this.embeddedChampionIcons}:47`,
            skins: {
                0: { image: "Skins/Base/KhazixLoadScreen.dds" },
                1: { image: "Skins/Skin01/KhazixLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/KhazixLoadScreen_2.dds" },
            },
        },
        "KogMaw": {
            //icon: "HUD/Kog'Maw_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:48`,
            skins: {
                0: { image: "Skins/Base/KogmawLoadScreen.dds" },
                1: { image: "Skins/Skin01/KogmawLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/KogmawLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/KogmawLoadScreen_3.dds" },
                4: { image: "Skins/Skin04/KogmawLoadScreen_4.dds" },
                5: { image: "Skins/Skin05/KogmawLoadScreen_5.dds" },
                6: { image: "Skins/Skin06/KogmawLoadScreen_6.dds" },
                7: { image: "Skins/Skin07/KogmawLoadScreen_7.dds" },
                8: { image: "Skins/Skin08/KogMawLoadScreen_8.dds" },
            },
        },
        "Leblanc": {
            //icon: "HUD/Leblanc_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:49`,
            skins: {
                0: { image: "Skins/Base/LeblancLoadScreen.dds" },
                1: { image: "Skins/Skin01/LeblancLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/LeblancLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/LeblancLoadScreen_3.dds" },
                4: { image: "Skins/Skin04/LeblancLoadScreen_4.dds" },
            },
        },
        "LeeSin": {
            //icon: "HUD/LeeSin_Square.dds",
            icon: `${this.embeddedChampionIcons}:50`,
            skins: {
                0: { image: "Skins/Base/LeeSinLoadScreen.dds" },
                1: { image: "Skins/Skin01/LeeSinLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/LeeSinLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/LeeSinLoadScreen_3.dds" },
                4: { image: "Skins/Skin04/LeeSinLoadScreen_4.dds" },
                5: { image: "Skins/Skin05/LeeSinLoadScreen_5.dds" },
                6: { image: "Skins/Skin06/LeeSinLoadScreen_6.dds" },
            },
        },
        "Leona": {
            //icon: "Info/Leona_Square.dds",
            icon: `${this.embeddedChampionIcons}:51`,
            skins: {
                0: { image: "LeonaLoadScreen.dds" },
                1: { image: "LeonaLoadScreen_1.dds" },
                2: { image: "LeonaLoadScreen_2.dds" },
                3: { image: "LeonaLoadScreen_3.dds" },
                4: { image: "LeonaLoadScreen_4.dds" },
            },
        },
        "Lissandra": {
            //icon: "HUD/Lissandra_Square.dds",
            icon: `${this.embeddedChampionIcons}:52`,
            skins: {
                0: { image: "Skins/Base/LissandraLoadScreen.dds" },
                1: { image: "Skins/skin01/LissandraLoadScreen_1.dds" },
                2: { image: "Skins/skin02/LissandraLoadScreen_2.dds" },
            },
        },
        "Lucian": {
            //icon: "HUD/Lucian_Square.dds",
            icon: `${this.embeddedChampionIcons}:53`,
            skins: {
                0: { image: "Skins/Base/LucianLoadScreen.dds" },
                1: { image: "Skins/Skin01/LucianLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/LucianLoadScreen_2.dds" },
            },
        },
        "Lulu": {
            //icon: "Info/Lulu_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:54`,
            skins: {
                0: { image: "LuluLoadScreen.dds" },
                1: { image: "LuluLoadScreen_1.dds" },
                2: { image: "LuluLoadScreen_2.dds" },
                3: { image: "LuluLoadScreen_3.dds" },
                4: { image: "LuluLoadScreen_4.dds" },
            },
        },
        "Lux": {
            //icon: "Info/Lux_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:55`,
            skins: {
                0: { image: "LuxLoadScreen.dds" },
                1: { image: "LuxLoadScreen_1.dds" },
                2: { image: "LuxLoadScreen_2.dds" },
                3: { image: "LuxLoadScreen_3.dds" },
                4: { image: "LuxLoadScreen_4.dds" },
                5: { image: "LuxLoadScreen_5.dds" },
            },
        },
        "Malphite": {
            //icon: "info/Malphite_Square.dds",
            icon: `${this.embeddedChampionIcons}:56`,
            skins: {
                0: { image: "MalphiteLoadScreen.dds" },
                1: { image: "MalphiteLoadScreen_1.DDS" },
                2: { image: "MalphiteLoadScreen_2.dds" },
                3: { image: "MalphiteLoadScreen_3.dds" },
                4: { image: "MalphiteLoadScreen_4.dds" },
                5: { image: "MalphiteLoadScreen_5.dds" },
                6: { image: "MalphiteLoadScreen_6.dds" },
            },
        },
        "Malzahar": {
            //icon: "info/Malzahar_Square.dds",
            icon: `${this.embeddedChampionIcons}:57`,
            skins: {
                1: { image: "MalzaharLoadScreen_1.dds" },
                2: { image: "MalzaharLoadScreen_2.dds" },
                3: { image: "MalzaharLoadScreen_3.dds" },
                4: { image: "MalzaharLoadScreen_4.dds" },
            },
        },
        "Maokai": {
            //icon: "HUD/Maokai_Square.dds",
            icon: `${this.embeddedChampionIcons}:58`,
            skins: {
                0: { image: "Skins/Base/MaokaiLoadScreen.dds" },
                1: { image: "Skins/Skin01/MaokaiLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/MaokaiLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/MaokaiLoadScreen_3.dds" },
                4: { image: "Skins/Skin04/MaokaiLoadScreen_4.dds" },
                5: { image: "Skins/Skin05/MaokaiLoadScreen_5.dds" },
            },
        },
        "MasterYi": {
            //icon: "HUD/MasterYi_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:59`,
            skins: {
                0: { image: "Skins/Base/MasterYiLoadScreen.dds" },
                1: { image: "Skins/Skin01/MasterYiLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/MasterYiLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/MasterYiLoadScreen_3.dds" },
                4: { image: "Skins/Skin04/MasterYiLoadScreen_4.dds" },
                5: { image: "Skins/Skin05/MasterYiLoadScreen_5.dds" },
            },
        },
        "MissFortune": {
            //icon: "HUD/MissFortune_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:60`,
            skins: {
                0: { image: "Skins/Base/MissFortuneLoadScreen.dds" },
                1: { image: "Skins/Skin01/MissFortuneLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/MissFortuneLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/MissFortuneLoadScreen_3.dds" },
                4: { image: "Skins/Skin04/MissFortuneLoadScreen_4.dds" },
                5: { image: "Skins/Skin05/MissFortuneLoadScreen_5.dds" },
                6: { image: "Skins/Skin06/MissFortuneLoadScreen_6.dds" },
                7: { image: "Skins/Skin07/MissFortuneLoadScreen_7.dds" },
            },
        },
        "MonkeyKing": {
            //icon: "Info/MonkeyKing_Square.dds",
            icon: `${this.embeddedChampionIcons}:61`,
            skins: {
                0: { image: "MonkeyKingLoadScreen.dds" },
                1: { image: "MonkeyKingLoadScreen_1.dds" },
                2: { image: "MonkeyKingLoadScreen_2.dds" },
                3: { image: "MonkeyKingLoadScreen_3.dds" },
                4: { image: "MonkeyKingLoadScreen_4.dds" },
            },
        },
        "Mordekaiser": {
            //icon: "Info/Mordekaiser_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:62`,
            skins: {
                0: { image: "MordekaiserLoadScreen.dds" },
                1: { image: "MordekaiserLoadScreen_1.DDS" },
                2: { image: "MordekaiserLoadScreen_2.DDS" },
                3: { image: "MordekaiserLoadScreen_3.dds" },
                4: { image: "MordekaiserLoadScreen_4.dds" },
                5: { image: "MordekaiserLoadScreen_5.dds" },
            },
        },
        "Morgana": {
            //icon: "Info/Morgana_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:63`,
            skins: {
                0: { image: "MorganaLoadScreen.dds" },
                1: { image: "MorganaLoadScreen_1.dds" },
                2: { image: "MorganaLoadScreen_2.dds" },
                3: { image: "MorganaLoadScreen_3.dds" },
                4: { image: "MorganaLoadScreen_4.dds" },
                5: { image: "MorganaLoadScreen_5.dds" },
                6: { image: "MorganaLoadScreen_6.dds" },
            },
        },
        "Nami": {
            //icon: "HUD/Nami_Square.dds",
            icon: `${this.embeddedChampionIcons}:64`,
            skins: {
                0: { image: "skins/base/NamiLoadScreen.dds" },
                1: { image: "skins/skin01/NamiLoadScreen_1.dds" },
                2: { image: "skins/skin02/NamiLoadScreen_2.dds" },
            },
        },
        "Nasus": {
            //icon: "HUD/Nasus_Square.dds",
            icon: `${this.embeddedChampionIcons}:65`,
            skins: {
                0: { image: "Skins/Base/NasusLoadScreen.dds" },
                1: { image: "Skins/Skin01/NasusLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/NasusLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/NasusLoadScreen_3.dds" },
                4: { image: "Skins/Skin04/NasusLoadScreen_4.dds" },
                5: { image: "Skins/Skin05/NasusLoadScreen_5.dds" },
            },
        },
        "Nautilus": {
            //icon: "info/Nautilus_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:66`,
            skins: {
                0: { image: "NautilusLoadScreen.dds" },
                1: { image: "NautilusLoadScreen_1.dds" },
                2: { image: "NautilusLoadScreen_2.dds" },
                3: { image: "NautilusLoadScreen_3.dds" },
            },
        },
        "Nidalee": {
            //icon: "HUD/Nidalee_Square.dds",
            icon: `${this.embeddedChampionIcons}:67`,
            skins: {
                0: { image: "Skins/Base/nidaleeLoadScreen.dds" },
                1: { image: "Skins/Skin01/nidaleeLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/nidaleeLoadScreen_2.DDS" },
                3: { image: "Skins/Skin03/nidaleeLoadScreen_3.DDS" },
                4: { image: "Skins/Skin04/nidaleeLoadScreen_4.dds" },
                5: { image: "Skins/Skin05/nidaleeLoadScreen_5.dds" },
                6: { image: "Skins/Skin06/NidaleeLoadScreen_6.dds" },
            },
        },
        "Nocturne": {
            //icon: "Info/Nocturne_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:68`,
            skins: {
                0: { image: "NocturneLoadScreen.dds" },
                1: { image: "NocturneLoadScreen_1.dds" },
                2: { image: "NocturneLoadScreen_2.dds" },
                3: { image: "NocturneLoadScreen_3.dds" },
                4: { image: "NocturneLoadScreen_4.dds" },
                5: { image: "NocturneLoadScreen_5.dds" },
            },
        },
        "Nunu": {
            //icon: "Info/Yeti_Square.dds",
            icon: `${this.embeddedChampionIcons}:69`,
            skins: {
                0: { image: "NunuLoadScreen.dds" },
                1: { image: "NunuLoadScreen_1.DDS" },
                2: { image: "NunuLoadScreen_2.dds" },
                3: { image: "NunuLoadScreen_3.dds" },
                4: { image: "NunuLoadScreen_4.dds" },
                5: { image: "NunuLoadScreen_5.dds" },
                6: { image: "NunuLoadScreen_6.dds" },
            },
        },
        "Olaf": {
            //icon: "HUD/Olaf_Square.dds",
            icon: `${this.embeddedChampionIcons}:70`,
            skins: {
                0: { image: "Skins/Base/OlafLoadScreen.dds" },
                1: { image: "Skins/Skin01/OlafLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/OlafLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/OlafLoadScreen_3.dds" },
                4: { image: "Skins/Skin04/OlafLoadScreen_4.dds" },
            },
        },
        "Orianna": {
            //icon: "Info/Oriana_Square.dds",
            icon: `${this.embeddedChampionIcons}:71`,
            skins: {
                3: { image: "OriannaLoadScreen_3.dds" },
                4: { image: "OriannaLoadScreen_4.dds" },
            },
        },
        "Pantheon": {
            //icon: "Info/Pantheon_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:72`,
            skins: {
                0: { image: "PantheonLoadScreen.dds" },
                1: { image: "PantheonLoadScreen_1.DDS" },
                2: { image: "PantheonLoadScreen_2.DDS" },
                3: { image: "PantheonLoadScreen_3.dds" },
                4: { image: "PantheonLoadScreen_4.dds" },
                5: { image: "PantheonLoadScreen_5.dds" },
                6: { image: "PantheonLoadScreen_6.dds" },
            },
        },
        "Poppy": {
            //icon: "HUD/Poppy_Square.dds",
            icon: `${this.embeddedChampionIcons}:73`,
            skins: {
                0: { image: "Skins/Base/PoppyLoadScreen.dds" },
                1: { image: "Skins/Skin01/PoppyLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/PoppyLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/PoppyLoadScreen_3.dds" },
                4: { image: "Skins/Skin04/PoppyLoadScreen_4.dds" },
                5: { image: "Skins/Skin05/PoppyLoadScreen_5.dds" },
                6: { image: "Skins/Skin06/PoppyLoadScreen_6.dds" },
            },
        },
        "Quinn": {
            //icon: "HUD/Quinn_Square.dds",
            icon: `${this.embeddedChampionIcons}:74`,
            skins: {
                0: { image: "Skins/Base/QuinnLoadScreen.dds" },
                1: { image: "Skins/Skin01/QuinnLoadScreen_1.dds" },
                2: { image: "Skins/skin02/QuinnLoadScreen_2.dds" },
            },
        },
        "Rammus": {
            //icon: "Info/Armordillo_Square.dds",
            icon: `${this.embeddedChampionIcons}:75`,
            skins: {
                0: { image: "RammusLoadScreen.dds" },
                1: { image: "RammusLoadScreen_1.DDS" },
                2: { image: "RammusLoadScreen_2.dds" },
                3: { image: "RammusLoadScreen_3.dds" },
                4: { image: "RammusLoadScreen_4.dds" },
                5: { image: "RammusLoadScreen_5.dds" },
                6: { image: "RammusLoadScreen_6.dds" },
            },
        },
        "Renekton": {
            //icon: "HUD/Renekton_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:76`,
            skins: {
                0: { image: "Skins/Base/RenektonLoadScreen.dds" },
                1: { image: "Skins/Skin01/RenektonLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/RenektonLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/RenektonLoadScreen_3.dds" },
                4: { image: "Skins/Skin04/RenektonLoadScreen_4.dds" },
                5: { image: "Skins/Skin05/RenektonLoadScreen_5.dds" },
                6: { image: "Skins/Skin06/RenektonLoadScreen_6.dds" },
            },
        },
        "Rengar": {
            //icon: "HUD/Rengar_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:77`,
            skins: {
                0: { image: "Skins/Base/RengarLoadScreen.dds" },
                1: { image: "Skins/Skin01/RengarLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/RengarLoadScreen_2.dds" },
            },
        },
        "Riven": {
            //icon: "HUD/Riven_Square.dds",
            icon: `${this.embeddedChampionIcons}:78`,
            skins: {
                0: { image: "Skins/Base/RivenLoadScreen.dds" },
                1: { image: "Skins/skin01/RivenLoadScreen_1.dds" },
                2: { image: "Skins/skin02/RivenLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/RivenLoadScreen_3.dds" },
                4: { image: "Skins/Skin04/RivenLoadScreen_4.dds" },
                5: { image: "Skins/Skin05/RivenLoadScreen_5.dds" },
            },
        },
        "Rumble": {
            //icon: "HUD/Rumble_Square.dds",
            icon: `${this.embeddedChampionIcons}:79`,
            skins: {
                0: { image: "Skins/Base/RumbleLoadScreen.dds" },
                1: { image: "Skins/Skin01/RumbleLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/RumbleLoadScreen_2.dds" },
                3: { image: "Skins/skin03/RumbleLoadScreen_3.dds" },
            },
        },
        "Ryze": {
            //icon: "HUD/Ryze_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:80`,
            skins: {
                0: { image: "Skins/Base/RyzeLoadScreen.dds" },
                1: { image: "Skins/Skin01/RyzeLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/RyzeLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/RyzeLoadScreen_3.dds" },
                4: { image: "Skins/Skin04/RyzeLoadScreen_4.dds" },
                5: { image: "Skins/Skin05/RyzeLoadScreen_5.dds" },
                6: { image: "Skins/Skin06/RyzeLoadScreen_6.dds" },
                7: { image: "Skins/Skin07/RyzeLoadScreen_7.dds" },
                8: { image: "Skins/Skin08/RyzeLoadScreen_8.dds" },
            },
        },
        "Sejuani": {
            //icon: "HUD/Sejuani_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:81`,
            skins: {
                0: { image: "Skins/Base/SejuaniLoadScreen.dds" },
                1: { image: "Skins/Skin01/SejuaniLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/SejuaniLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/SejuaniLoadScreen_3.dds" },
                4: { image: "Skins/Skin04/SejuaniLoadScreen_4.dds" },
            },
        },
        "Shaco": {
            //icon: "HUD/Shaco_Square.dds",
            icon: `${this.embeddedChampionIcons}:82`,
            skins: {
                0: { image: "Skins/Base/ShacoLoadScreen.dds" },
                1: { image: "Skins/Skin01/ShacoLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/ShacoLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/ShacoLoadScreen_3.dds" },
                4: { image: "Skins/Skin04/ShacoLoadScreen_4.dds" },
                5: { image: "Skins/Skin05/ShacoLoadScreen_5.dds" },
                6: { image: "Skins/Skin06/ShacoLoadScreen_6.dds" },
            },
        },
        "Shen": {
            //icon: "info/Shen_Square.dds",
            icon: `${this.embeddedChampionIcons}:83`,
            skins: {
                0: { image: "ShenLoadScreen.dds" },
                1: { image: "ShenLoadScreen_1.DDS" },
                2: { image: "ShenLoadScreen_2.DDS" },
                3: { image: "ShenLoadScreen_3.dds" },
                4: { image: "ShenLoadScreen_4.dds" },
                5: { image: "ShenLoadScreen_5.dds" },
                6: { image: "ShenLoadScreen_6.dds" },
            },
        },
        "Shyvana": {
            //icon: "Info/Shyvana_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:84`,
            skins: {
                0: { image: "ShyvanaLoadScreen.dds" },
                3: { image: "ShyvanaLoadScreen_3.dds" },
                4: { image: "ShyvanaLoadScreen_4.dds" },
                5: { image: "ShyvanaLoadScreen_5.dds" },
            },
        },
        "Singed": {
            //icon: "Info/Singed_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:85`,
            skins: {
                0: { image: "SingedLoadScreen.dds" },
                1: { image: "SingedLoadScreen_1.dds" },
                2: { image: "SingedLoadScreen_2.dds" },
                3: { image: "SingedLoadScreen_3.dds" },
                4: { image: "SingedLoadScreen_4.dds" },
                5: { image: "SingedLoadScreen_5.dds" },
                6: { image: "SingedLoadScreen_6.dds" },
            },
        },
        "Sion": {
            //icon: "HUD/Sion_Square.dds",
            icon: `${this.embeddedChampionIcons}:86`,
            skins: {
                0: { image: "Skins/Base/SionLoadScreen.dds" },
                1: { image: "Skins/Skin01/SionLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/SionLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/SionLoadScreen_3.dds" },
                4: { image: "Skins/Skin04/SionLoadScreen_4.dds" },
            },
        },
        "Sivir": {
            //icon: "HUD/Sivir_Square.dds",
            icon: `${this.embeddedChampionIcons}:87`,
            skins: {
                0: { image: "Skins/Base/SivirLoadScreen.dds" },
                1: { image: "Skins/Skin01/SivirLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/SivirLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/SivirLoadScreen_3.dds" },
                4: { image: "Skins/Skin04/SivirLoadScreen_4.dds" },
                5: { image: "Skins/Skin05/SivirLoadScreen_5.dds" },
                6: { image: "Skins/Skin06/SivirLoadScreen_6.dds" },
            },
        },
        "Skarner": {
            //icon: "HUD/Skarner_Square.dds",
            icon: `${this.embeddedChampionIcons}:88`,
            skins: {
                0: { image: "Skins/Base/SkarnerLoadScreen.dds" },
                1: { image: "Skins/Skin01/SkarnerLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/SkarnerLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/SkarnerLoadScreen_3.dds" },
            },
        },
        "Sona": {
            //icon: "HUD/Sona_Square.dds",
            icon: `${this.embeddedChampionIcons}:89`,
            skins: {
                0: { image: "Skins/Base/SonaLoadScreen.dds" },
                1: { image: "Skins/Skin01/SonaLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/SonaLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/SonaLoadScreen_3.dds" },
                4: { image: "Skins/Skin04/SonaLoadScreen_4.dds" },
                5: { image: "Skins/Skin05/SonaLoadScreen_5.dds" },
            },
        },
        "Soraka": {
            //icon: "HUD/Soraka_Square.dds",
            icon: `${this.embeddedChampionIcons}:90`,
            skins: {
                0: { image: "Skins/Base/SorakaLoadScreen.dds" },
                1: { image: "Skins/Skin01/SorakaLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/SorakaLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/SorakaLoadScreen_3.dds" },
                4: { image: "Skins/Skin04/SorakaLoadScreen_4.dds" },
            },
        },
        "Swain": {
            //icon: "Info/Swain_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:91`,
            skins: {
                0: { image: "SwainLoadScreen.dds" },
                1: { image: "SwainLoadScreen_1.DDS" },
                2: { image: "SwainLoadScreen_2.dds" },
                3: { image: "SwainLoadScreen_3.dds" },
            },
        },
        "Syndra": {
            //icon: "info/Syndra_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:92`,
            skins: {
                0: { image: "SyndraLoadScreen.dds" },
                1: { image: "SyndraLoadScreen_1.dds" },
                2: { image: "SyndraLoadScreen_2.dds" },
            },
        },
        "Talon": {
            //icon: "Info/Talon_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:93`,
            skins: {
                0: { image: "TalonLoadScreen.dds" },
                1: { image: "TalonLoadScreen_1.dds" },
                2: { image: "TalonLoadScreen_2.dds" },
                3: { image: "TalonLoadScreen_3.dds" },
            },
        },
        "Taric": {
            //icon: "Info/GemKnight_Square.dds",
            icon: `${this.embeddedChampionIcons}:94`,
            skins: {
                0: { image: "TaricLoadScreen.dds" },
                1: { image: "TaricLoadScreen_1.DDS" },
                2: { image: "TaricLoadScreen_2.DDS" },
                3: { image: "TaricLoadScreen_3.dds" },
            },
        },
        "Teemo": {
            //icon: "Info/Teemo_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:95`,
            skins: {
                0: { image: "teemoLoadScreen.dds" },
                1: { image: "teemoLoadScreen_1.DDS" },
                2: { image: "teemoLoadScreen_2.dds" },
                3: { image: "teemoLoadScreen_3.DDS" },
                4: { image: "teemoLoadScreen_4.dds" },
                5: { image: "teemoLoadScreen_5.dds" },
                6: { image: "TeemoLoadScreen_6.dds" },
                7: { image: "TeemoLoadScreen_7.dds" },
            },
        },
        "Thresh": {
            //icon: "HUD/Thresh_Square.dds",
            icon: `${this.embeddedChampionIcons}:96`,
            skins: {
                0: { image: "Skins/Base/ThreshLoadScreen.dds" },
                1: { image: "Skins/Skin01/ThreshLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/ThreshLoadScreen_2.dds" },
            },
        },
        "Tristana": {
            //icon: "HUD/Tristana_Square.dds",
            icon: `${this.embeddedChampionIcons}:97`,
            skins: {
                0: { image: "Skins/Base/TristanaLoadScreen.dds" },
                1: { image: "Skins/Skin01/TristanaLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/TristanaLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/TristanaLoadScreen_3.dds" },
                4: { image: "Skins/Skin04/TristanaLoadScreen_4.dds" },
                5: { image: "Skins/Skin05/TristanaLoadScreen_5.dds" },
                6: { image: "Skins/Skin06/TristanaLoadScreen_6.dds" },
            },
        },
        "Trundle": {
            //icon: "HUD/Trundle_Square.dds",
            icon: `${this.embeddedChampionIcons}:98`,
            skins: {
                0: { image: "Skins/Base/TrundleLoadScreen.dds" },
                1: { image: "Skins/Skin01/TrundleLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/TrundleLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/TrundleLoadScreen_3.dds" },
                4: { image: "Skins/Skin04/TrundleLoadScreen_4.dds" },
            },
        },
        "Tryndamere": {
            //icon: "HUD/Tryndamere_Square.dds",
            icon: `${this.embeddedChampionIcons}:99`,
            skins: {
                0: { image: "Skins/Base/TryndamereLoadScreen.dds" },
                1: { image: "Skins/Skin01/TryndamereLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/TryndamereLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/TryndamereLoadScreen_3.dds" },
                4: { image: "Skins/Skin04/TryndamereLoadScreen_4.dds" },
                5: { image: "Skins/Skin05/TryndamereLoadScreen_5.dds" },
                6: { image: "Skins/Skin06/TryndamereLoadScreen_6.dds" },
            },
        },
        "TwistedFate": {
            //icon: "Info/TwistedFate_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:100`,
            skins: {
                0: { image: "TwistedFateLoadScreen.dds" },
                1: { image: "TwistedFateLoadScreen_1.DDS" },
                2: { image: "TwistedFateLoadScreen_2.DDS" },
                3: { image: "TwistedFateLoadScreen_3.dds" },
                4: { image: "TwistedFateLoadScreen_4.dds" },
                5: { image: "TwistedFateLoadScreen_5.dds" },
                6: { image: "TwistedFateLoadScreen_6.dds" },
                7: { image: "TwistedFateLoadScreen_7.dds" },
                8: { image: "TwistedFateLoadScreen_8.dds" },
            },
        },
        "Twitch": {
            //icon: "HUD/Twitch_Square.dds",
            icon: `${this.embeddedChampionIcons}:101`,
            skins: {
                0: { image: "Skins/Base/TwitchLoadScreen.dds" },
                1: { image: "Skins/Skin01/TwitchLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/TwitchLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/TwitchLoadScreen_3.dds" },
                4: { image: "Skins/Skin04/TwitchLoadScreen_4.dds" },
                5: { image: "Skins/Skin05/TwitchLoadScreen_5.dds" },
                6: { image: "Skins/Skin06/TwitchLoadScreen_6.dds" },
            },
        },
        "Udyr": {
            //icon: "HUD/Udyr_Square.dds",
            icon: `${this.embeddedChampionIcons}:102`,
            skins: {
                0: { image: "Skins/Base/UdyrLoadScreen.dds" },
                1: { image: "Skins/skin01/UdyrLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/UdyrLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/UdyrLoadScreen_3.dds" },
            },
        },
        "Urgot": {
            //icon: "HUD/Urgot_Square.dds",
            icon: `${this.embeddedChampionIcons}:103`,
            skins: {
                0: { image: "Skins/Base/UrgotLoadScreen.dds" },
                1: { image: "Skins/Skin01/UrgotLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/UrgotLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/UrgotLoadScreen_3.dds" },
            },
        },
        "Varus": {
            //icon: "Info/Varus_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:104`,
            skins: {
                0: { image: "VarusLoadScreen.dds" },
                1: { image: "VarusLoadScreen_1.dds" },
                2: { image: "VarusLoadScreen_2.dds" },
                3: { image: "VarusLoadScreen_3.dds" },
            },
        },
        "Vayne": {
            //icon: "Info/Vayne_Square.dds",
            icon: `${this.embeddedChampionIcons}:105`,
            skins: {
                0: { image: "VayneLoadScreen.dds" },
                1: { image: "VayneLoadScreen_1.dds" },
                2: { image: "VayneLoadScreen_2.dds" },
                3: { image: "VayneLoadScreen_3.dds" },
                4: { image: "VayneLoadScreen_4.dds" },
                5: { image: "VayneLoadScreen_5.dds" },
            },
        },
        "Veigar": {
            //icon: "HUD/Veigar_Square.dds",
            icon: `${this.embeddedChampionIcons}:106`,
            skins: {
                0: { image: "Skins/Base/VeigarLoadScreen.dds" },
                1: { image: "Skins/Skin01/VeigarLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/VeigarLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/VeigarLoadScreen_3.dds" },
                4: { image: "Skins/Skin04/VeigarLoadScreen_4.dds" },
                5: { image: "Skins/Skin05/VeigarLoadScreen_5.dds" },
                6: { image: "Skins/Skin06/VeigarLoadScreen_6.dds" },
                7: { image: "Skins/Skin07/VeigarLoadScreen_7.dds" },
                8: { image: "Skins/Skin08/VeigarLoadScreen_8.dds" },
            },
        },
        "Velkoz": {
            //icon: "HUD/Velkoz_Square.dds",
            icon: `${this.embeddedChampionIcons}:107`,
            skins: {
                0: { image: "Skins/Base/VelkozLoadScreen.dds" },
                1: { image: "Skins/Skin01/VelkozLoadScreen_1.dds" },
            },
        },
        "Vi": {
            //icon: "HUD/Vi_Square.dds",
            icon: `${this.embeddedChampionIcons}:108`,
            skins: {
                0: { image: "Skins/Base/ViLoadScreen.dds" },
                1: { image: "Skins/Skin01/ViLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/ViLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/ViLoadScreen_3.dds" },
            },
        },
        "Viktor": {
            //icon: "HUD/Viktor_Square.dds",
            icon: `${this.embeddedChampionIcons}:109`,
            skins: {
                0: { image: "Skins/Base/ViktorLoadScreen.dds" },
                1: { image: "Skins/Skin01/ViktorLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/ViktorLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/ViktorLoadScreen_3.dds" },
            },
        },
        "Vladimir": {
            //icon: "Info/Vladimir_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:110`,
            skins: {
                0: { image: "VladimirLoadScreen.dds" },
                1: { image: "VladimirLoadScreen_1.dds" },
                2: { image: "VladimirLoadScreen_2.dds" },
                3: { image: "VladimirLoadScreen_3.dds" },
                4: { image: "VladimirLoadScreen_4.dds" },
                5: { image: "VladimirLoadScreen_5.dds" },
                6: { image: "VladimirLoadScreen_6.dds" },
            },
        },
        "Volibear": {
            //icon: "Info/Volibear_Square.dds",
            icon: `${this.embeddedChampionIcons}:111`,
            skins: {
                0: { image: "VolibearLoadScreen.dds" },
                1: { image: "VolibearLoadScreen_1.dds" },
                2: { image: "VolibearLoadScreen_2.dds" },
                3: { image: "VolibearLoadScreen_3.dds" },
                4: { image: "VolibearLoadScreen_4.dds" },
            },
        },
        "Warwick": {
            //icon: "Info/Warwick_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:112`,
            skins: {
                0: { image: "WarwickLoadScreen.dds" },
                1: { image: "WarwickLoadScreen_1.DDS" },
                2: { image: "WarwickLoadScreen_2.dds" },
                3: { image: "WarwickLoadScreen_3.DDS" },
                4: { image: "WarwickLoadScreen_4.dds" },
                5: { image: "WarwickLoadScreen_5.dds" },
                6: { image: "WarwickLoadScreen_6.dds" },
                7: { image: "WarwickLoadScreen_7.dds" },
            },
        },
        "Xerath": {
            //icon: "HUD/Xerath_Square.dds",
            icon: `${this.embeddedChampionIcons}:113`,
            skins: {
                0: { image: "Skins/Base/XerathLoadScreen.dds" },
                1: { image: "Skins/Skin01/XerathLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/XerathLoadScreen_2.dds" },
                3: { image: "Skins/Skin03/XerathLoadScreen_3.dds" },
            },
        },
        "XinZhao": {
            //icon: "Info/XinZhao_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:114`,
            skins: {
                0: { image: "XinZhaoLoadScreen.dds" },
                1: { image: "XinZhaoLoadScreen_1.dds" },
                2: { image: "XinZhaoLoadScreen_2.dds" },
                3: { image: "XinZhaoLoadScreen_3.dds" },
                4: { image: "XinZhaoLoadScreen_4.dds" },
                5: { image: "XinZhaoLoadScreen_5.dds" },
            },
        },
        "Yasuo": {
            //icon: "HUD/Yasuo_Square.dds",
            icon: `${this.embeddedChampionIcons}:115`,
            skins: {
                0: { image: "Skins/Base/YasuoLoadScreen.dds" },
                1: { image: "Skins/Skin01/YasuoLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/YasuoLoadScreen_2.dds" },
            },
        },
        "Yorick": {
            //icon: "Info/Yorick_Square.dds",
            icon: `${this.embeddedChampionIcons}:116`,
            skins: {
                0: { image: "YorickLoadScreen.dds" },
                1: { image: "YorickLoadScreen_1.dds" },
                2: { image: "YorickLoadScreen_2.dds" },
            },
        },
        "Zac": {
            //icon: "HUD/Zac_Square.dds",
            icon: `${this.embeddedChampionIcons}:117`,
            skins: {
                0: { image: "Skins/Base/ZacLoadScreen.dds" },
                1: { image: "Skins/Skin01/ZacLoadScreen_1.dds" },
            },
        },
        "Zed": {
            //icon: "HUD/Zed_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:118`,
            skins: {
                0: { image: "ZedLoadScreen.dds" },
                1: { image: "ZedLoadScreen_1.dds" },
                2: { image: "Skins/Skin02/ZedLoadScreen_2.dds" },
            },
        },
        "Ziggs": {
            //icon: "Info/Ziggs_Square.dds",
            icon: `${this.embeddedChampionIcons}:119`,
            skins: {
                0: { image: "ZiggsLoadScreen.dds" },
                1: { image: "ZiggsLoadScreen_1.dds" },
                2: { image: "ZiggsLoadScreen_2.dds" },
                3: { image: "ZiggsLoadScreen_3.dds" },
                4: { image: "ZiggsLoadScreen_4.dds" },
            },
        },
        "Zilean": {
            //icon: "Info/Chronokeeper_Square.dds",
            icon: `${this.embeddedChampionIcons}:120`,
            skins: {
                0: { image: "ZileanLoadScreen.dds" },
                1: { image: "ZileanLoadScreen_1.dds" },
                2: { image: "ZileanLoadScreen_2.dds" },
                3: { image: "ZileanLoadScreen_3.dds" },
                4: { image: "ZileanLoadScreen_4.dds" },
            },
        },
        "Zyra": {
            //icon: "Info/Zyra_Square_0.dds",
            icon: `${this.embeddedChampionIcons}:121`,
            skins: {
                0: { image: "ZyraLoadScreen.dds" },
                1: { image: "ZyraLoadScreen_1.dds" },
                2: { image: "ZyraLoadScreen_2.dds" },
                3: { image: "ZyraLoadScreen_3.dds" },
            },
        },
    }
}
