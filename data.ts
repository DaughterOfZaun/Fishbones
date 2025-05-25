//import { promises } from "fs"

export class Data {
    public static readonly instance = new Data()
    public async repair(){
        
    }
    public async launchClient(ip: string, port: number, key: string, clientId: number){
        const clientExePath = './downloads/League of Legends_UNPACKED/League-of-Legends-4-20/RADS/solutions/lol_game_client_sln/releases/0.0.1.68/deploy/League of Legends.exe'
        //console.log(`"${clientExePath}" "" "" "" "${ip} ${port} ${key} ${clientId}"`)
    }
    public async launchServer(port: number, info: GameInfo){
        const serverExePath = './downloads/GameServer/GameServerConsole/bin/Debug/net9.0/GameServerConsole'
        //console.log(`"${serverExePath}" --port='${port}' --config-json='${JSON.stringify(info)}'`)
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