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

const clientState = new class ClientState {
    loaded = false
    started = false
    paused = false
    objs = new Array<GameObject>()
    reset(){
        this.loaded = false
        this.started = false
        this.paused = false
        this.objs.length = 0
    }
}

const serverState = new class ServerState {
    handshaken = false
    gameStarted = false
    reset(){
        this.handshaken = false
        this.gameStarted = false
    }
}

class GameObject {
    constructor(
        public netID: number,
        public partOfInitialScene: boolean,
    ){}
    reset() {
        //throw new Error("Method not implemented.")
    }
    delete(){
        //throw new Error("Method not implemented.")
    }
}
class LaneMinion extends GameObject {
    delete(){
        sendToClient(new PKT.NPC_Die(), {
            senderNetID: this.netID,
            killerNetID: this.netID,
        })
    }
}
class Turret extends GameObject {
    
    //name: string = ''

    reset(){
        //sendToClient(new PKT.S2C_CreateTurret(), {
        //    senderNetID: this.netID,
        //    netObjID: this.netID,
        //    netNodeID: 64,
        //    name: this.name,
        //})
    }
}

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
    const clientID = playerID - 1

    serverState.reset()

    const canReuse =
        clientState.loaded
        //&& socketToProgram !== undefined
        //&& clientSubprocess !== undefined
        //&& clientSubprocess.exitCode == null
        //&& playerID == lastPlayerID
        //&& JSON.stringify(gameInfo) == JSON.stringify(lastGameInfo)
        //&& gameInfo.game.map == lastGameInfo?.game.map
        //&& gameInfo.game.gameMode == lastGameInfo?.game.gameMode

    if(!canReuse){
        clientState.reset()
        launchArgs = [ip, port, key, playerID, gameInfo]
        return originalLaunchClient(ip, port, key, playerID, opts)
    }
    else {
        
        resetClient()
        
        setTimeout(() => {
            sendToServer(new PKT.RegistryPacket(), {
                cid: clientID,
                playerID: BigInt(playerID),
                signiture: encrypt(Buffer.from([ playerID, 0, 0, 0, 0, 0, 0, 0 ])),
            }, ENetChannels.DEFAULT)
        }, 1000)

        return clientSubprocess
    } 
}

export async function stopClient(opts: Required<AbortOptions>){
    pauseClient()
}

const isOrder = (str: string) => str.toUpperCase() == 'BLUE'
const getTeamID = (str: string) => isOrder(str) ? 100 : 200
const isChaos = (str: string) => !isOrder(str)

function resetClient(){
    //TODO:
    for(const obj of clientState.objs){
        if(obj.partOfInitialScene) obj.reset()
        else obj.delete()
    }
    clientState.objs.length = 0
}

export type ClientPreloaderCallbacks = typeof clientPreloaderCallbacks
export const clientPreloaderCallbacks = {

    getSocketToProgram(){
        return socketToProgram
    },
    setSocketToProgram(stp: SocketToProgram){
        socketToProgram = stp
        socketToProgram.close = () => {}
    },
    getOnData(){
        return (data: Buffer, programHostPort: string) => {
            socketToProgram_onData?.(data, programHostPort)
        }
    },
    setOnData(onData: OnData){
        socketToProgram_onData = onData
    },

    filterOutgoing(packets: WrappedPacket[]): WrappedPacket[] {

        for(const packet of packets){

            const decryptedData = decrypt(packet.data)
            const packet_type = decryptedData[0] as (PKT.Type | PKT.PayloadType)

            if(packet_type == PKT.Type.C2S_ClientReady){
                clientState.loaded = true
            }
        }
        return packets
    },

    filterIncoming(packets: WrappedPacket[]): WrappedPacket[] {

        packets = packets.filter(packet => {

            const [ ip, port, key, playerID, gameInfo ] = launchArgs!
            const clientID = playerID - 1
            
            const decryptedData = decrypt(packet.data)
            const packet_type = decryptedData[0] as (PKT.Type | PKT.PayloadType)

            if(clientState.loaded){

                //const nonDecryptedData = packet.data
                if(packet.channelID == ENetChannels.DEFAULT){

                    if(serverState.handshaken) return false
                    else serverState.handshaken = true

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

                if(packet_type == PKT.Type.S2C_StartSpawn){
                    return false
                }

                if(packet_type == PKT.Type.S2C_EndSpawn){
                    sendToServer(new PKT.C2S_ClientReady(), {})
                    return false
                }

                if(packet_type == PKT.Type.S2C_StartGame){
                    
                    serverState.gameStarted = true

                    if(!clientState.started){
                        clientState.started = true
                        return true
                    }
                    resumeClient()
                    return false
                }

                if(packet_type == PKT.Type.S2C_EndGame){
                    pauseClient()
                    return false
                }
            }

            //TODO: Remove minions
            //TODO: Restore buildings
            //TODO: Restore spells

            if(!clientState.loaded || serverState.gameStarted){

                if(packet_type == PKT.Type.Barrack_SpawnUnit){
                    const packet = new PKT.Barrack_SpawnUnit().read(decryptedData)
                    clientState.objs.push(new LaneMinion(packet.netObjID, !clientState.loaded))
                }

                if(packet_type == PKT.Type.S2C_CreateTurret){
                    const packet = new PKT.S2C_CreateTurret()
                    clientState.objs.push(new Turret(packet.netNodeID, !clientState.loaded))
                }

                {
                    let packet
                    if(packet_type == PKT.Type.Building_Die) packet = new PKT.Building_Die().read(decryptedData)
                    if(packet_type == PKT.Type.NPC_Hero_Die) packet = new PKT.NPC_Hero_Die().read(decryptedData)
                    if(packet_type == PKT.Type.NPC_Die     ) packet = new PKT.NPC_Die     ().read(decryptedData)
                    if(packet){
                        
                        sendToClient(new PKT.OnLeaveLocalVisiblityClient(), {
                            senderNetID: packet!.senderNetID
                        })
                        sendToClient(new PKT.OnLeaveVisiblityClient(), {
                            senderNetID: packet!.senderNetID
                        })
                        
                        //TODO: Spawn DestroyedTower
                        //TODO: Spawn DestroyedExplosion

                        return false
                    }
                }

                return true
            }
            return false
        })

        return packets
    },
}

function resumeClient(){

    const [ ip, port, key, playerID, gameInfo ] = launchArgs!
    const clientID = playerID - 1

    if(clientState.paused){
        clientState.paused = false
        sendToClient(new PKT.ResumePacket(), {
            clientID: clientID,
            delayed: false,
        })
    }
}

function pauseClient(){

    const [ ip, port, key, playerID, gameInfo ] = launchArgs!
    const clientID = playerID - 1

    if(!clientState.paused){
        clientState.paused = true
        sendToClient(new PKT.PausePacket(), {
            clientID: clientID,
            pauseTimeRemaining: 2 ** 31 - 1,
            tournamentPause: false,
        })
    }
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
        CHEATS_ENABLED: true,
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
