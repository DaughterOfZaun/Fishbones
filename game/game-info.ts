export interface GameInfo {
    gameId: number
    game: {
        map: number
        gameMode: string
        mutators: string[]
        dataPackage: string
    }
    gameInfo: {
        TICK_RATE: number
        CLIENT_VERSION: string
        FORCE_START_TIMER: number
        KEEP_ALIVE_WHEN_EMPTY: boolean
        MANACOSTS_ENABLED: boolean
        COOLDOWNS_ENABLED: boolean
        CHEATS_ENABLED: boolean
        MINION_SPAWNS_ENABLED: boolean
        CONTENT_PATH: string
        DEPLOY_FOLDER: string
        IS_DAMAGE_TEXT_GLOBAL: boolean
        ENDGAME_HTTP_POST_ADDRESS: string
        APIKEYDROPBOX: string
        USERNAMEOFREPLAYMAN: string
        PASSWORDOFREPLAYMAN: string
        ENABLE_LAUNCHER: boolean
        LAUNCHER_ADRESS_AND_PORT: string
        SUPRESS_SCRIPT_NOT_FOUND_LOGS: boolean
        AB_CLIENT: boolean
        ENABLE_LOG_AND_CONSOLEWRITELINE: boolean
        ENABLE_LOG_BehaviourTree: boolean
        ENABLE_LOG_PKT: boolean
        ENABLE_REPLAY: boolean
        ENABLE_ALLOCATION_TRACKER: boolean
        SCRIPT_ASSEMBLIES: string[]
    }
    players: {
        playerId: number
        AIDifficulty?: number
        blowfishKey: string
        rank: string
        name: string
        champion: string
        team: string
        skin: number
        summoner1: string
        summoner2: string
        ribbon: number
        useDoomSpells: boolean
        icon: number
        runes: Record<string, number>
        talents: Record<string, number>
    }[]
}

export interface GameInfo420 {
    gameId: number
    game: {
        map: number
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
        ribbon?: number // Unused
        icon: number
        runes: Record<number, number>
        talents: Record<number, number>
    }[]
}
