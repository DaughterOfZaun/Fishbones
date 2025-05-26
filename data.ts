import { exec } from 'teen_process'
import { promises as fs } from "fs"
import s7z from '7z-bin'

const downloads = `./downloads`

const gcExe = `${downloads}/League of Legends_UNPACKED/League-of-Legends-4-20/RADS/solutions/lol_game_client_sln/releases/0.0.1.68/deploy/League of Legends.exe`
const gcZip = `${downloads}/League of Legends_UNPACKED.7z`
const gcZipTorrent = `${gcZip}.torrent`
const gcZipMagnet = ``

const sdkVer = `9.0.300`
const sdkPlatform = `linux`
const sdkArch = `x64`
const sdkName = `dotnet-sdk-${sdkVer}-${sdkPlatform}-${sdkArch}`
const sdkExeExt = ``
const sdkExe = `${downloads}/${sdkName}/dotnet${sdkExeExt}`
const sdkZipExt = `.tar.gz`
const sdkZip = `${downloads}/${sdkName}${sdkZipExt}`
const sdkZipTorrent = `${sdkZip}.torrent`
const sdkZipMagnet = ``

const gsProjName = `GameServerConsole`
const gsDir = `${downloads}/GameServer/${gsProjName}`
const gsTarget = `Debug`
const netVer = `net9.0`
const gsExeExt = ``
const gsExe = `${gsDir}/bin/${gsTarget}/${netVer}/${gsProjName}${gsExeExt}`
const gsCSProj = `${gsDir}/${gsProjName}.csproj`
const gsZip = `${downloads}/Chronobreak.GameServer.7z`
const gsZipTorrent = `${gsZip}.torrent`
const gsZipMagnet = ``

export class Data {
    public static readonly instance = new Data()

    public async launchClient(ip: string, port: number, key: string, clientId: number){
        console.log(`"${gcExe}" "" "" "" "${ip} ${port} ${key} ${clientId}"`)
    }
    public async launchServer(port: number, info: GameInfo){
        console.log(`"${gsExe}" --port='${port}' --config-json='${JSON.stringify(info)}'`)
    }

    public async repair(){
        Promise.all([
            Promise.all([
                this.repairArchived(sdkExe, sdkZip, sdkZipTorrent, sdkZipMagnet),
                this.repairArchived(gsExe, gsZip, gsZipTorrent, gsZipMagnet)
            ]).then(() =>
                this.repairServerBuild()
            ),
            this.repairArchived(gcExe, gcZip, gcZipTorrent, gcZipMagnet),
        ])
    }
    private async repairArchived(exe: string, zip: string, torrent: string, magnet: string){
        if(await fs.exists(exe)){
            // OK
        } else if(await fs.exists(zip)){
            await this.unpack(zip)
        } else if(await fs.exists(torrent)){
            await this.downloadTorrent(torrent)
            await this.unpack(zip)
        } else {
            await this.downloadMagnet(magnet)
            await this.unpack(zip)
        }
    }
    private async repairServerBuild(){
        if(await fs.exists(gsExe)){
            // OK
        } else {
            await this.build(sdkExe, gsCSProj)
        }
    }
    private async unpack(filepath: string){
        await exec(s7z.path7z, ['x', filepath], { shell: true })
    }
    private async downloadTorrent(filepath: string){
        
    }
    private async downloadMagnet(url: string){

    }
    private async build(exe: string, csproj: string){
        await exec(exe, ['build', csproj])
    }
}

export type GameInfo = {
    gameId: number
    game: {
        map: string
        gameMode: string
        mutators: string[]
    }
    gameInfo: {
        TICK_RATE: number
        FORCE_START_TIMER: number
        USE_CACHE: boolean
        IS_DAMAGE_TEXT_GLOBAL: boolean
        ENABLE_CONTENT_LOADING_LOGS: boolean
        SUPRESS_SCRIPT_NOT_FOUND_LOGS: boolean
        CHEATS_ENABLED: boolean
        MANACOSTS_ENABLED: boolean
        COOLDOWNS_ENABLED: boolean
        MINION_SPAWNS_ENABLED: boolean
        LOG_IN_PACKETS: boolean
        LOG_OUT_PACKETS: boolean
        CONTENT_PATH: string
        ENDGAME_HTTP_POST_ADDRESS: string
        scriptAssemblies: string[]
    }
    players: {
        playerId: number
        blowfishKey: string
        rank: string
        name: string
        champion: string
        team: string
        skin: number
        summoner1: string
        summoner2: string
        ribbon?: number, // Unused
        icon: number
        runes: Record<number, number>
        talents: Record<number, number>
    }[]
}