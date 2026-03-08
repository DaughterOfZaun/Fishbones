import type { AbortOptions } from "@libp2p/interface"
import { gcPkg } from "../data/packages/game-client"
import type { GameInfo } from "../../game/game-info"
import type { ChildProcess } from "./process"
import {
    launchClient as originalLaunchClient,
    relaunchClient as originalRelaunchClient,
} from "./client"
import { Peer, type WrappedPacket } from "../proxy/peer"
import { Proxy, type SocketToProgram } from "../proxy/proxy"
import { firewall } from "../proxy/proxy-firewall"
import { ProxyClient } from "../proxy/proxy-client"
import { ENetChannels, type BasePacket } from "../proxy/pkt"
import { Wrapped } from "../../message/proxy"
import { decrypt, encrypt } from "../proxy/blowfish"
import * as PKT from '../proxy/pkt'
import { fs_readFile } from "../data/fs"
import { assign } from "../proxy/utils"
import { vec2, Vector3 } from "../proxy/math"

//import { LOCALHOST, blowfishKey } from "../constants"
const blowfishKey = "17BLOhi6KZsTtldTsizvHg=="
const LOCALHOST = '127.0.0.1'

type OnData = (data: Buffer<ArrayBufferLike>, programHostPort: string) => void

let launchArgs: [ ip: string, port: number, key: string, clientId: number, gameInfo: GameInfo ] | undefined
let clientSubprocess: ChildProcess | undefined
let socketToProgram: SocketToProgram | undefined
let socketToProgram_onData: OnData | undefined

function sendToServer<T extends BasePacket>(packet: T, fields: Partial<T>, channelID = ENetChannels.GENERIC_APP_TO_SERVER){
    
    let data = assign(packet, fields).write()
    if(channelID != ENetChannels.DEFAULT)
        data = encrypt(data)
    
    const packets = [{
        fragment: undefined,
        channelID,
        data,
    }]
    const wrapped = Buffer.from(Wrapped.encode({ packets }))
    const programHostPort = socketToProgram!.sourceHostPort
    socketToProgram_onData!(wrapped, programHostPort)
}

function sendToClient<T extends BasePacket>(packet: T, fields: Partial<T> = {}, channelID = ENetChannels.GENERIC_APP_BROADCAST){
    
    let data = assign(packet, fields).write()
    //if(channelID != ENetChannels.DEFAULT)
        data = encrypt(data)

    const packets = [{
        fragment: undefined,
        channelID,
        data,
    }]
    socketToProgram!.peer!.sendUnreliable(packets)
}

export function getLastLaunchCmd(){
    return 'start ' + ['', gcPkg.exeName, '', '', '', launchArgs!.map(arg => arg.toString()).join(' ')].map(arg => `"${arg}"`).join(' ')
}

export async function launchClient(ip: string, port: number, key: string, playerID: number, gameInfo: GameInfo, opts: Required<AbortOptions>){
    
    const [,,, lastPlayerID, lastGameInfo] = launchArgs ?? []
    
    launchArgs = [ip, port, key, playerID, gameInfo]
    const clientID = playerID - 1

    if(
        socketToProgram
        && clientSubprocess
        && clientSubprocess.exitCode == null
        && playerID == lastPlayerID
        && gameInfo.game.map == lastGameInfo?.game.map
        && gameInfo.game.gameMode == lastGameInfo?.game.gameMode
    ){
        resetClient()
        
        setTimeout(() => {
            sendToServer(new PKT.RegistryPacket(), {
                cid: clientID,
                playerID: BigInt(playerID),
                signiture: encrypt(Buffer.from([ playerID, 0, 0, 0, 0, 0, 0, 0 ])),
            }, ENetChannels.DEFAULT)
        }, 1000)

        return clientSubprocess
    } else {
        return originalLaunchClient(ip, port, key, playerID, opts)
    }
}

export async function stopClient(opts: Required<AbortOptions>){

}

export async function preloadClient(opts: Required<AbortOptions>){
    
    const node = null!
    const proxyClient = firewall(new ProxyClient(node), true, clientPreloaderCallbacks)
    socketToProgram = await proxyClient['createSocketToProgram'](LOCALHOST, 0, (data, programHostPort) => {
        socketToProgram_onData?.(data, programHostPort)
    }, opts)

    const playerID = 1
    //const gameInfo = { game: { map: 30, gameMode: 'CLASSIC' } } as GameInfo
    launchArgs = [ LOCALHOST, socketToProgram.port, blowfishKey, playerID, defaultGameInfo]
    clientSubprocess = await originalLaunchClient(LOCALHOST, socketToProgram.port, blowfishKey, playerID, opts)
}

const isOrder = (str: string) => str.toUpperCase() == 'BLUE'
const getTeamID = (str: string) => isOrder(str) ? 100 : 200
const isChaos = (str: string) => !isOrder(str)

const state = {
    handshakeDone: false,
}
function resetClient(){
    state.handshakeDone = false
}

export type ClientPreloaderCallbacks = typeof clientPreloaderCallbacks
export const clientPreloaderCallbacks = {

    getSocketToProgram(onData: OnData){
        if(!socketToProgram) return
        socketToProgram_onData = onData
        return socketToProgram
    },
    
    filterOutgoing(packets: WrappedPacket[]): WrappedPacket[] {
        packets = packets.filter(packet => {

            const [ ip, port, key, playerID, gameInfo ] = launchArgs!
            const clientID = playerID - 1

            const nonDecryptedData = packet.data
            if(packet.channelID == ENetChannels.DEFAULT){
                const packet = new PKT.RegistryPacket().read(nonDecryptedData)
                
                sendToClient(packet, {
                    cid: clientID,
                }, ENetChannels.DEFAULT)

                sendToClient(new PKT.SynchSimTimeS2C(), {
                    synchtime: 0, //TODO:
                })

                return false
            }

            const decryptedData = decrypt(packet.data)
            const packet_type = decryptedData[0] as (PKT.Type | PKT.PayloadType)

            if(packet_type == PKT.Type.C2S_Reconnect){
                return false
            }
            if(packet_type == PKT.Type.C2S_QueryStatusReq){
                sendToClient(new PKT.S2C_QueryStatusAns(), {
                    res: true,
                })
                return false
            }
            if(packet_type == PKT.Type.SynchVersionC2S){
                sendToClient(new PKT.SynchVersionS2C(), {
                    versionString: "1.0.0.126",
                    isVersionOk: true,
                    mapToLoad: gameInfo.game.map,
                    mapMode: gameInfo.game.gameMode,
                    playerInfo: gameInfo.players.map(playerInfo => {
                        return assign(new PKT.PlayerLiteInfo(), {
                            playerId: BigInt(playerInfo.playerId),
                            summonerLevel: 30, //TODO:
                            summonerSpell1: 0x03657421, //TODO:
                            summonerSpell2: 0x065E8695, //TODO:
                            isBot: false, //TODO:
                            teamId: getTeamID(playerInfo.team),
                            botName: '',
                            botSkinName: '',
                            botDifficulty: 0,
                            profileIconId: playerInfo.icon,
                        })
                    }),
                })
                return false
            }
            if(packet_type == PKT.PayloadType.RequestJoinTeam){

                const playerInfo = gameInfo.players.find(playerInfo => playerInfo.playerId == playerID)!
                const orderPlayers = gameInfo.players.filter(playerInfo => isOrder(playerInfo.team))
                const chaosPlayers = gameInfo.players.filter(playerInfo => isChaos(playerInfo.team))
                
                sendToClient(new PKT.World_SendGameNumber(), {
                    gameID: BigInt(gameInfo.gameId),
                })
                
                sendToClient(new PKT.TeamRosterUpdate(), {
                    teamsize_order: 6,
                    teamsize_chaos: 6,
                    orderMembers: orderPlayers.map(playerInfo => BigInt(playerInfo.playerId)),
                    chaosMembers: chaosPlayers.map(playerInfo => BigInt(playerInfo.playerId)),
                    current_teamsize_order: orderPlayers.length,
                    current_teamsize_chaos: chaosPlayers.length,
                }, ENetChannels.MIDDLE_TIER_ROSTER)
                
                sendToClient(new PKT.RequestRename(), {
                    playerId: BigInt(playerInfo.playerId),
                    skinID: playerInfo.skin,
                    buffer: playerInfo.name,
                }, ENetChannels.MIDDLE_TIER_ROSTER)

                sendToClient(new PKT.RequestReskin(), {
                    playerId: BigInt(playerInfo.playerId),
                    skinID: playerInfo.skin,
                    buffer: playerInfo.champion,
                }, ENetChannels.MIDDLE_TIER_ROSTER)

                return false
            }
            if(packet_type == PKT.Type.C2S_Ping_Load_Info){
                const packet = new PKT.C2S_Ping_Load_Info().read(decryptedData)

                const clientID = packet.clientID
                const playerID = clientID + 1

                sendToClient(new PKT.S2C_Ping_Load_Info(), {
                    clientID: clientID,
                    playerID: BigInt(playerID),
                    percentage: packet.percentage,
                    ETA: packet.ETA,
                    count: packet.count,
                    ping: packet.ping,
                    ready: packet.ready,
                })
                return false
            }
            if(packet_type == PKT.Type.C2S_CharSelected){

                return false
                
                sendToClient(new PKT.S2C_StartSpawn(), {
                    numBotsOrder: 0, //TODO:
                    numBotsChaos: 0, //TODO:
                })
                
                //TODO:

                for(const playerInfo of gameInfo.players){
                    
                    const netID = 0x40000000 + 22 //TODO:
                    const playerID = playerInfo.playerId
                    const clientID = playerID - 1

                    sendToClient(new PKT.S2C_CreateHero(), {
                        netObjID: netID,
                        playerUID: clientID,
                        netNodeID: 64,
                        skillLevel: 0,
                        teamIsOrder: isOrder(playerInfo.team),
                        isBot: false,
                        botRank: 0,
                        spawnPosIndex: 0,
                        skinID: playerInfo.skin,
                        name: playerInfo.name,
                        skin: playerInfo.champion,
                    }) //TODO:

                    sendToClient(new PKT.OnEnterVisiblityClient(), {
                        items: [],
                        lookAtType: 0, //TODO:
                        lookAtPosition: Vector3.Zero,
                        movementData: assign(new PKT.MovementDataStop(), {
                            position: vec2(899.7015, 1121.2828),
                            forward: vec2(0, 1),
                            syncID: 0, //TODO:
                        }),
                        senderNetID: netID,
                    })
                }
                sendToClient(new PKT.S2C_EndSpawn())
                return false
            }
            if(packet_type == PKT.Type.C2S_ClientReady){

                return true

                sendToClient(new PKT.S2C_StartGame(), {
                    tournamentPauseEnabled: false,
                })
                
                sendToClient(new PKT.PausePacket(), {
                    clientID: clientID,
                    pauseTimeRemaining: 2 ** 31 - 1,
                    tournamentPause: false,
                })
                
                // setTimeout(() => {
                //     sendToClient(new PKT.ResumePacket(), {
                //         clientID: clientID,
                //         delayed: false,
                //     })
                // }, 3000)
                
                return false
            }

            return true
        })

        if(!state.handshakeDone) return []

        return packets
    },

    filterIncoming(packets: WrappedPacket[]): WrappedPacket[] {

        packets = packets.filter(packet => {

            const [ ip, port, key, playerID, gameInfo ] = launchArgs!
            const clientID = playerID - 1
            
            //const nonDecryptedData = packet.data
            if(packet.channelID == ENetChannels.DEFAULT){

                if(!state.handshakeDone) state.handshakeDone = true
                else return false

                //const packet = new PKT.RegistryPacket().read(nonDecryptedData)
                sendToServer(new PKT.C2S_Reconnect(), {
                    isFullReconnect: true,
                })

                //TODO: ...
                sendToServer(new PKT.C2S_QueryStatusReq(), {})
                sendToServer(new PKT.C2S_QueryStatusReq(), {})

                sendToServer(new PKT.SynchVersionC2S(), {
                    time_LastClient: 0,
                    clientNetID: clientID,
                    versionString: "Version 1.0.0.126 [PUBLIC]",
                })

                return false
            }

            const decryptedData = decrypt(packet.data)
            const packet_type = decryptedData[0] as (PKT.Type | PKT.PayloadType)

            if(packet_type == PKT.Type.S2C_QueryStatusAns){
                return false
            }

            if(packet_type == PKT.Type.SynchVersionS2C){
                
                const playerInfo = gameInfo.players.find(playerInfo => playerInfo.playerId == playerID)!

                sendToServer(new PKT.RequestJoinTeam(), {
                    playerID: playerID,
                    team: getTeamID(playerInfo.team),
                }, ENetChannels.MIDDLE_TIER_ROSTER)
            }

            if(packet_type == PKT.Type.World_SendGameNumber){
                return false
            }

            if(packet_type == PKT.Type.SynchVersionS2C){
                sendToServer(new PKT.C2S_Ping_Load_Info(), {
                    clientID: clientID,
                    playerID: BigInt(playerID),
                    percentage: 100,
                    ETA: 0,
                    count: 1000,
                    ping: 8,
                    ready: true,
                })
                
                sendToServer(new PKT.C2S_CharSelected(), {})

                return false
            }

            //Allow: packet_type == PKT.Type.SynchSimTimeS2C

            if(
                packet.channelID == ENetChannels.MIDDLE_TIER_ROSTER
                //packet_type == PKT.PayloadType.TeamRosterUpdate ||
                //packet_type == PKT.PayloadType.RequestRename ||
                //packet_type == PKT.PayloadType.RequestReskin ||
            ){
                return false
            }

            if(packet_type == PKT.Type.S2C_Ping_Load_Info){
                return false
            }

            // if(packet_type == PKT.Type.S2C_StartSpawn){
            //     return false
            // }

            // if(packet_type == PKT.Type.S2C_EndSpawn){
            //     sendToServer(new PKT.C2S_ClientReady(), {})
            //     return false
            // }

            // if(packet_type == PKT.Type.S2C_StartGame){
            //     //TODO:
            //     sendToClient(new PKT.ResumePacket(), {
            //         clientID: clientID,
            //         delayed: false,
            //     })
            //     return false
            // }

            if(packet_type == PKT.Type.S2C_EndGame){
                //TODO:
                sendToClient(new PKT.PausePacket(), {
                    clientID: clientID,
                    pauseTimeRemaining: 2 ** 31 - 1,
                    tournamentPause: false,
                })
                return false
            }

            return true
        })

        if(!state.handshakeDone) return []

        
        
        return packets
    },
}

export const defaultGameInfo: GameInfo = {
    gameId: 0,
    game: {
        map: 30,
        gameMode: "CLASSIC",
        mutators: [],
        dataPackage: "AvCsharp-Scripts"
    },
    gameInfo: {
        TICK_RATE: 30,
        CLIENT_VERSION: "1.0.0.126",
        FORCE_START_TIMER: 60,
        KEEP_ALIVE_WHEN_EMPTY: false,
        MANACOSTS_ENABLED: true,
        COOLDOWNS_ENABLED: true,
        CHEATS_ENABLED: false,
        MINION_SPAWNS_ENABLED: true,
        CONTENT_PATH: "../../../../Content",
        DEPLOY_FOLDER: "",
        IS_DAMAGE_TEXT_GLOBAL: false,
        ENDGAME_HTTP_POST_ADDRESS: "",
        APIKEYDROPBOX: "",
        USERNAMEOFREPLAYMAN: "",
        PASSWORDOFREPLAYMAN: "",
        ENABLE_LAUNCHER: false,
        LAUNCHER_ADRESS_AND_PORT: "",
        SUPRESS_SCRIPT_NOT_FOUND_LOGS: true,
        AB_CLIENT: false,
        ENABLE_LOG_AND_CONSOLEWRITELINE: false,
        ENABLE_LOG_BehaviourTree: false,
        ENABLE_LOG_PKT: true,
        ENABLE_REPLAY: false,
        ENABLE_ALLOCATION_TRACKER: false,
        SCRIPT_ASSEMBLIES: [
            "AvLua-Converted",
            "AvCsharp-Scripts"
        ],
    },
    players: [
        {
            playerId: 1,
            blowfishKey: "17BLOhi6KZsTtldTsizvHg==",
            rank: "DIAMOND",
            name: "Willumir",
            champion: "Kassadin",
            team: "BLUE",
            skin: 0,
            summoner1: "SummonerRally",
            summoner2: "SummonerDot",
            ribbon: 2,
            useDoomSpells: false,
            icon: 0,
            talents: {
                100: 0,
                101: 2,
                102: 3,
                103: 0,
                104: 0,
                105: 3,
                107: 1,
                108: 0,
                111: 0,
                112: 0,
                113: 0,
                114: 0,
                115: 1,
                116: 4,
                117: 0,
                118: 2,
                119: 3,
                121: 3,
                123: 0,
                124: 0,
                125: 0,
                126: 1,
                127: 0,
                129: 1,
                130: 0,
                131: 0,
                132: 1,
                133: 0,
                134: 3,
                135: 0,
                137: 1,
                140: 1,
                143: 0,
                144: 0,
                145: 0,
                146: 0,
                147: 0,
            },
            runes: {
                1: 5245,
                2: 5245,
                3: 5245,
                4: 5245,
                5: 5245,
                6: 5245,
                7: 5245,
                8: 5245,
                9: 5245,
                10: 5317,
                11: 5317,
                12: 5317,
                13: 5317,
                14: 5317,
                15: 5317,
                16: 5317,
                17: 5317,
                18: 5317,
                19: 5289,
                20: 5289,
                21: 5289,
                22: 5289,
                23: 5289,
                24: 5289,
                25: 5289,
                26: 5289,
                27: 5289,
                28: 5335,
                29: 5335,
                30: 5335,
            },
        },
    ],
}
