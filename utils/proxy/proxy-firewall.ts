import { Peer, type WrappedPacket } from './peer'
import { Proxy } from './proxy'
import { Wrapped } from '../../message/proxy'
import { Role, type RemoteStreamIndex } from './shared'
import { decrypt, encrypt } from './blowfish'
import * as PKT from './pkt'
import { Vector2Int, Vector2Single, sadd, sdiv, fromIntToSingle, fromSingleToInt, ilen, slen, smul, isub, ssub, toStringInt } from './math'
import { assign, type bool, type float, type int } from './utils'
import type { ClientPreloaderCallbacks } from '../process/client-preloader'
//import os from 'node:os'

const STREAMS_COUNT = 4
const DEFAULT_STREAM_IDX = 0 as RemoteStreamIndex
const WAYPOINT_STREAM_IDX = 1 as RemoteStreamIndex
const STATS_REPLICATION_STREAM_IDX = 2 as RemoteStreamIndex
const MISSILE_REPLICATION_STREAM_IDX = 3 as RemoteStreamIndex
const HEARTBEAT_INTERVAL = 1000 / 30
const deltaTime = 1000 / 30
//const CELL_SIZE = 50
const k = 0.00001

//TODO: Disable.
export const packetsTransmittedByType = new Map<number, { count: number, size: number }>()
function countTransmittedPacket(packet_type: PKT.Type, packet: WrappedPacket){
    let packetsOfType = packetsTransmittedByType.get(packet_type)
    if(!packetsOfType){
        packetsOfType = { count: 0, size: 0 }
        packetsTransmittedByType.set(packet_type, packetsOfType)
    }
    packetsOfType.size += packet.data.length
    packetsOfType.count++
}

class Entity {
    constructor(public id: number){}
}

class Missile extends Entity {}
class ChainMissile extends Missile {
    public ownerNetworkID: number = 0
    public targets: number[] = []
}

class Unit extends Entity {
    
    public teleportID: number = 0
    public waypoints: Vector2Int[] = []
    public waypointsSyncID: number = -1
    public waypointsSynced: boolean = true
    public repeats: number = 0

    public targetID: number = 0
    public isAttacking: boolean = false

    public movementSpeed: number = 310
    public currentPosition?: Vector2Single

    public stats?: Stats
    public replicationSyncID: number = -1
    public replicationDataSynced: boolean = true
    public replicationDataUnsynced: number[][] = []

    public turnOnAA(targetID: number){
        console.assert(targetID != 0, 'Assertion failed: targetID != 0')
        //console.log('unit', unit.id, 'turnOnAA', targetID)
        this.isAttacking = true
        this.targetID = targetID
        //this.setWaypoints([])
    }
    public turnOffAA(){
        //console.log('unit', unit.id, 'turnOffAA')
        this.isAttacking = false
        this.targetID = 0
        //this.setWaypoints([])
        //setTimeout(() => {
        //    if(unit.waypoints.length < 2)
        //        console.log('unit', unit.id, 'stuck')
        //}, 30)
    }
    public setWaypoints(waypoints: Vector2Int[], syncID: number, hasTeleportID?: boolean, teleportID?: number){
        this.waypoints = waypoints
        this.waypointsSynced = false
        this.waypointsSyncID = syncID
        if(waypoints.length > 0)
            this.currentPosition = fromIntToSingle(waypoints[0]!)
        if(hasTeleportID && teleportID != undefined && teleportID != this.teleportID)
            this.teleportID = teleportID
        this.repeats = 0
    }
    public mergeReplicationData(replicationData: number[][], syncID: number){
        this.replicationSyncID = syncID
        this.replicationDataSynced = false
        for(let primaryID = 0; primaryID < replicationData.length; primaryID++){
            const values = replicationData[primaryID]
            if(values){
                for(let secondaryID = 0; secondaryID < values.length; secondaryID++){
                    const value = values[secondaryID]
                    if(value){
                        (this.replicationDataUnsynced[primaryID] ??= [])[secondaryID] = value
                    }
                }
            }
        }
    }
    public setReplicationDataSynced(to: boolean){
        this.replicationDataSynced = to
        if(!to) return
        for(let primaryID = 0; primaryID < this.replicationDataUnsynced.length; primaryID++){
            const values = this.replicationDataUnsynced[primaryID]
            if(values){
                values.length = 0
            }
        }
    }
}

class Hero extends Unit {
    stats = new HeroStats()
    constructor(id: number){
        super(id)
        this.movementSpeed = 319.3
    }
}

class Minion extends Unit {
    stats = new MinionStats()
    constructor(id: number){
        super(id)
        this.movementSpeed = 350
    }
}

type RDObj = Record<string, int | float | bool>

abstract class Stats {
    public abstract read(data: PKT.ReplicationData): RDObj
}

class HeroStats extends Stats {

    public override read(data: PKT.ReplicationData){

        const obj: RDObj = {}

        if(data.hasPrimaryID(0)){
            data.getFloat(0, 0, obj, 'exp', 0)
            data.getFloat(0, 1, obj, 'gold', 0)
            data.getUInt(0, 2, obj, 'hero.spells.enabled')
            //data.getUInt(0, 3, obj, 'unknown') //TODO: Investigate.
            data.getFloat(0, 4, obj, 'hero.spells.q.cost', 0)
            data.getFloat(0, 5, obj, 'hero.spells.w.cost', 0)
            data.getFloat(0, 6, obj, 'hero.spells.e.cost', 0)
            data.getFloat(0, 7, obj, 'hero.spells.r.cost', 0)
        }

        if(data.hasPrimaryID(1)){
            data.getUInt(1, 0, obj, 'hero.status.actionState')
            data.getBool(1, 1, obj, 'hero.status.isMagicImmune')
            data.getBool(1, 2, obj, 'hero.status.isInvulnerable')
            data.getBool(1, 3, obj, 'hero.status.isTargetable')
            data.getUInt(1, 4, obj, 'hero.status.isTargetableToTeam')
            data.getBool(1, 5, obj, 'hero.status.isPhysicalImmune')
            data.getFloat(1, 6, obj, 'baseAttackDamage', 0)
            data.getFloat(1, 7, obj, 'baseAbilityDamage', 0)
            data.getFloat(1, 8, obj, 'dodge', 2)
            data.getFloat(1, 9, obj, 'crit', 2)
            data.getFloat(1, 10, obj, 'armor', 0)
            data.getFloat(1, 11, obj, 'spellBlock', 0)
            data.getFloat(1, 12, obj, 'hpRegenRate', 1)
            data.getFloat(1, 13, obj, 'parRegenRate', 1)
            data.getFloat(1, 14, obj, 'attackRange', 0)
            data.getFloat(1, 15, obj, 'flatPhysicalDamageMod', 0)
            data.getFloat(1, 16, obj, 'percentPhysicalDamageMod', 2)
            data.getFloat(1, 17, obj, 'flatMagicDamageMod', 0)
            data.getFloat(1, 18, obj, 'percentMagicDamageMod', 0)
            data.getFloat(1, 19, obj, 'flatMagicReduction', 0)
            //data.getFloat(1, 20, obj, 'percentMagicReduction', 0)
            data.getFloat(1, 20, obj, 'attackSpeedMod', 2)
            data.getFloat(1, 21, obj, 'dodge', 2) //TODO: Investigate.
            data.getFloat(1, 22, obj, 'percentCooldownMod', 2)
            data.getFloat(1, 23, obj, 'flatArmorPenetrationMod', 2)
            data.getFloat(1, 24, obj, 'percentArmorPenetrationMod', 2)
            data.getFloat(1, 25, obj, 'flatMagicPenetrationMod', 2)
            data.getFloat(1, 26, obj, 'percentMagicPenetrationMod', 2)
            data.getFloat(1, 27, obj, 'percentLifeStealMod', 2)
            data.getFloat(1, 28, obj, 'percentSpellVampMod', 2)
        }

        //TODO: this.setPrimaryID(2)
        //TODO: data.getBool(0, 'isMagicImmune')
        //TODO: data.getBool(1, 'isInvulnerable')

        if(data.hasPrimaryID(3)){
            data.getFloat(3, 0, obj, 'health', 0)
            data.getFloat(3, 1, obj, 'par', 0)
            data.getFloat(3, 2, obj, 'maxHealth', 0)
            data.getFloat(3, 3, obj, 'maxPAR', 0)
            data.getFloat(3, 4, obj, 'flatBubbleRadiusMod', 0)
            data.getFloat(3, 5, obj, 'percentBubbleRadiusMod', 2)
            data.getFloat(3, 6, obj, 'movementSpeed', 2)
            data.getFloat(3, 7, obj, 'scaleSkinCoef', 2)
            data.getUInt(3, 8, obj, 'level')
            data.getUInt(3, 9, obj, 'minionsKilled')
            //AB: data.getFloat(3, 9, 'hero.collision.radius', 2)
            //AB: data.getUInt(3, 10, 'minionsKilled')
        }

        return obj
    }
}

class MinionStats extends Stats {
    public override read(data: PKT.ReplicationData){
        const obj: RDObj = {}

        //TODO: Fill in.

        return obj
    }
}

class Fragment {
    public buffer: Buffer
    public numbers = new Set<number>()
    public constructor(public count: number, length: number){
        this.buffer = Buffer.alloc(length)
    }
}

export const firewall = <T extends Proxy>(proxy: T, enabled: boolean, callbacks?: ClientPreloaderCallbacks): T => {

    if(!enabled) return proxy

    proxy.streamsCount = STREAMS_COUNT

    let latestSyncID = 0

    const units = new Map<number, Unit>()
    const getUnit = (id: number) => {
        let unit = units.get(id)
        let unitCreated = false
        if(!unit){
            unit = new Unit(id)
            unitCreated = true
            units.set(id, unit)
        }
        return { unit, unitCreated }
    }

    const missiles = new Map<number, Missile>()
    const getMissile = (id: number) => {
        let missile = missiles.get(id) as ChainMissile
        const missileCreated = !missile
        if(missileCreated){
            missile = new ChainMissile(id)
            missiles.set(missile.id, missile)
        }
        return { missile, missileCreated }
    }

    const fragments = new Map<number, Fragment>()
    const defragment = (packet: WrappedPacket): WrappedPacket | null => {
        const info = packet.fragment
        if(!info) return packet

        const fragmentID = info.startSequenceNumber
        let fragment = fragments.get(fragmentID)
        if(!fragment){
            fragment = new Fragment(info.fragmentCount, info.totalLength)
            fragments.set(fragmentID, fragment)
        }
        if(!fragment.numbers.has(info.fragmentNumber)){
            fragment.numbers.add(info.fragmentNumber)
            fragment.buffer.set(packet.data, info.fragmentOffset)
        }
        
        //console.log('defragment', fragmentID, info.fragmentNumber, fragment.numbers.size, '/', fragment.count, 'at', info.fragmentOffset, 'for', packet.data.length, '/', fragment.buffer.length)
        
        if(fragment.numbers.size == fragment.count){
            fragments.delete(fragmentID)
            return {
                fragment: undefined,
                data: fragment.buffer,
                channelID: packet.channelID,
            }
        }
        return null
    }

    const super_createSocketToProgram = proxy['createSocketToProgram'].bind(proxy)
    proxy['createSocketToProgram'] = async function (programHost, programPort, onData, opts) {

        if(callbacks && this['role'] == Role.Client){
            const socketToProgram =
                callbacks.getSocketToProgram()
                callbacks.setOnData(onData)
            if(socketToProgram) return socketToProgram
            onData = callbacks.getOnData()
        }
        
        const autoDefrag = true
        const autoFilter = true
        const autoRespond = true
        //const autoLimit = false

        const peerToProgram = new Peer('peerToProgram')
        const respond = <T extends PKT.BasePacket>(packet: WrappedPacket, ack: T, fields: Partial<T>) => {
            Object.assign(ack, fields)
            return peerToProgram.sendUnreliable([{
                fragment: undefined,
                data: encrypt(ack.write()),
                channelID: packet.channelID,
            }])
        }
        
        type WrappedPacketWithStreamIdx = WrappedPacket & { streamIdx?: RemoteStreamIndex }
        const socketToProgram = await super_createSocketToProgram(programHost, programPort, (rawdata, _ /*streamIdx*/, programHostPort) => {
            let packets: WrappedPacketWithStreamIdx[] = peerToProgram.receivePackets(rawdata)

            if(autoDefrag)
            packets = packets.map(defragment).filter(packet => !!packet)

            if(autoFilter)
            packets = packets.filter((packet) => {
                
                let messageReceived: PKT.BasePacket | undefined
                let messageAccepted = true
                let messageChanged = false
                let messageStreamIdx = 0 as RemoteStreamIndex
                
                const decryptedData = decrypt(packet.data)
                const packet_type = decryptedData[0] as PKT.Type
                
                //console.log(Role[this['role']], 'sends', PKT.Type[packet_type], /*'on', PKT.ENetChannels[packet.channelID]*/)
                
                filterInOutPackets(packet_type, units, getUnit, decryptedData)

                if(autoRespond && packet_type == PKT.Type.World_SendCamera_Server){
                    const message = messageReceived = new PKT.World_SendCamera_Server().read(decryptedData)
                    messageAccepted = false
                    respond(packet, new PKT.World_SendCamera_Server_Acknologment(), {
                        senderNetID: message.senderNetID,
                        syncID: message.syncID,
                    })
                }
                if(autoRespond && packet_type == PKT.Type.World_SendCamera_Server_Acknologment){
                    messageAccepted = false
                }

                if(packet_type == PKT.Type.OnReplication){
                    const message = messageReceived = new PKT.OnReplication().read(decryptedData)
                    
                    latestSyncID = message.syncID

                    messageStreamIdx = STATS_REPLICATION_STREAM_IDX

                    //for(const data of message.data){
                    //    const { unit, unitCreated } = getUnit(data.unitNetID)
                    //    const obj = unit?.stats?.read(data)
                    //    console.log('OnReplicationData', unit.id, JSON.stringify(obj, null, 4))
                    //}

                    if(autoRespond)
                    respond(packet, new PKT.OnReplication_Acc(), {
                        senderNetID: message.senderNetID,
                        syncID: message.syncID,
                    })
                }
                if(packet_type == PKT.Type.OnReplication_Acc){
                    const message = messageReceived = new PKT.OnReplication_Acc().read(decryptedData)

                    if(autoRespond)
                        messageAccepted = false

                    for(const unit of units.values())
                        if(unit.replicationSyncID <= message.syncID)
                            unit.setReplicationDataSynced(true)
                }

                if(packet_type == PKT.Type.S2C_ChainMissileSync){
                    const message = messageReceived = new PKT.S2C_ChainMissileSync().read(decryptedData)
                    //console.log('S2C_ChainMissileSync', message.stringify())
                    
                    messageStreamIdx = MISSILE_REPLICATION_STREAM_IDX

                    const { missile, missileCreated } = getMissile(message.senderNetID)
                    console.assert(
                        missile instanceof ChainMissile,
                        'Assertion failed: missile instanceof ChainMissile'
                    )

                    const ownerChanged = missileCreated || message.ownerNetworkID != missile.ownerNetworkID
                    const targetsChanged = missileCreated || message.targets.length != missile.targets.length || !message.targets.every((newTargetID, i) => {
                        const prevTargetID = missile.targets[i]!
                        return newTargetID == prevTargetID
                    })

                    //console.log(
                    //    '', missile.id, missile.ownerNetworkID, missile.targets.join(','), '\n',
                    //        message.senderNetID, message.ownerNetworkID, message.targets.join(', '), '\n',
                    //        ownerChanged, targetsChanged, ownerChanged || targetsChanged,
                    //)

                    messageAccepted = false
                    if(ownerChanged || targetsChanged){
                        missile.ownerNetworkID = message.ownerNetworkID
                        missile.targets = message.targets
                        messageAccepted = true
                    }
                }

                if(packet_type == PKT.Type.WaypointGroup){
                    const message = messageReceived = new PKT.WaypointGroup().read(decryptedData)
                    //message.write(undefined, true)

                    latestSyncID = message.syncID

                    messageStreamIdx = WAYPOINT_STREAM_IDX

                    //console.log('received', JSON.stringify(message, replacer, 4), 'on', packet.channelID)

                    const teleportCount = message.movements.length
                    
                    message.movements = message.movements.filter(movement => {

                        const { unit, unitCreated } = getUnit(movement.teleportNetID)
                        
                        //if(movement.hasTeleportID)
                        //unit.teleportID = movement.teleportID
                        //unit.waypoints = movement.waypoints
                        //return false

                        if(unit.isAttacking){
                            //if(movement.waypoints.length > 1)
                            //    console.log(
                            //        '', unit.id, 'attacking', 'vs\n',
                            //            unit.id, movement.teleportID, `[${movement.waypoints.map(wp => `(${toStringInt(wp)})`).join(', ')}]`, '\n',
                            //    )
                            //return false
                        }

                        //if(movement.waypoints.length > 1)
                        //    movement.waypoints.length = 2

                        //const teleportIDChanged = true
                        //const waypointsChanged = true
                        const teleportIDChanged = unitCreated || movement.hasTeleportID && movement.teleportID != unit.teleportID
                        const waypointsChanged = unitCreated || movement.waypoints.length != unit.waypoints.length || !movement.waypoints.every((newWaypoint, i) => {
                            if(i == 0) return true
                            const prevWaypoint = unit.waypoints[i]!
                            console.assert(prevWaypoint != undefined, 'Assertion failed: prevWaypoint != undefined')
                            //if(i == 0 && leni(subi(prevWaypoint, newWaypoint)) < CELL_SIZE) return true //HACK:
                            return newWaypoint == prevWaypoint
                        })
                        //const waypointsChanged = unitCreated
                        //|| (movement.waypoints.length <= 1 && unit.waypoints.length > 1)
                        //|| (movement.waypoints.length > 1 && unit.waypoints.length <= 1)
                        //|| (movement.waypoints.length > unit.waypoints.length)
                        //|| !movement.waypoints.every((newWaypoint, i) => {
                        //    if(i == 0) return true // Current position.
                        //    //if(i >= 2) return true // Everything past the first waypoint.
                        //    const prevWaypoint = unit.waypoints[unit.waypoints.length - movement.waypoints.length + i]
                        //    console.assert(prevWaypoint != undefined, 'Assertion failed: prevWaypoint != undefined')
                        //    return newWaypoint == prevWaypoint
                        //})
                        const chasesMovingUnit = !!message.movements.find(otherMovement => {
                            // Targeting the position of the moving unit
                            return otherMovement != movement
                                && otherMovement.waypoints.length > 1
                                && otherMovement.waypoints.at(0) == movement.waypoints.at(-1)
                        })

                        //if(unit.waypoints.length > 0)
                        //    console.log(unit.id, leni(subi(unit.waypoints[0]!, movement.waypoints[0]!)))
                        //unit.waypoints[0] = movement.waypoints[0]!
                        
                        if(teleportIDChanged || waypointsChanged && !chasesMovingUnit){

                            //console.log(
                            // '', message.syncID, movement.syncID, '\n',
                            //    unit.id, unit.teleportID, `[${unit.waypoints.map(wp => `(${toStringInt(wp)})`).join(', ')}]`, 'vs\n',
                            //    unit.id, movement.teleportID, `[${movement.waypoints.map(wp => `(${toStringInt(wp)})`).join(', ')}]`, '\n',
                            //    teleportIDChanged, waypointsChanged, teleportIDChanged || waypointsChanged,
                            //)

                            unit.setWaypoints(movement.waypoints, message.syncID, movement.hasTeleportID, movement.teleportID)
                            return true
                        }
                        //else if(unit.waypoints.length > 1 && unit.repeats++ < 3){
                        //   return true
                        //}
                        return false
                    })

                    //messageAccepted = message.movements.length > 0
                    //messageChanged = message.movements.length != teleportCount
                    //messageChanged = true
                    messageAccepted = false
                    messageChanged = false

                    if(autoRespond)
                    respond(packet, new PKT.Waypoint_Acc(), {
                        senderNetID: message.senderNetID,
                        syncID: message.syncID,
                        teleportCount, //TODO:
                    })

                    //messageChanged = true
                    //messageReceived = Object.assign(
                    //    new PKT.WaypointGroupWithSpeed(),
                    //    message,
                    //    {
                    //        movements: message.movements.map(movement => {
                    //            const { unit, unitCreated } = getUnit(movement.teleportNetID)
                    //            return Object.assign(
                    //                new PKT.MovementDataWithSpeed(),
                    //                movement,
                    //                {
                    //                    pathSpeedOverride: unit.movementSpeed,
                    //                },
                    //            )
                    //        }),
                    //    },
                    //)
                }
                if(packet_type == PKT.Type.Waypoint_Acc){
                    const message = messageReceived = new PKT.Waypoint_Acc().read(decryptedData)
                    
                    if(autoRespond)
                        messageAccepted = false
                    
                    for(const unit of units.values())
                        if(unit.waypointsSyncID <= message.syncID)
                            unit.waypointsSynced = true
                }

                //if(packet_type == PKT.Type.S2C_DestroyClientMissile){
                //    messageAccepted = false
                //}
                
                if(messageAccepted){
                    //console.log('accepted', PKT.Type[packet_type], 'from', Role[this['role']], /*'on', PKT.ENetChannels[packet.channelID]*/)
                    packet.streamIdx = messageStreamIdx
                }
                
                if(messageReceived != undefined && messageAccepted && messageChanged){
                    //const writer = new Writer(packet.data, 'LE') //HACK:
                    //const writer = new Writer(Buffer.alloc(1024), 'LE') //HACK:
                    const writer = undefined
                    const written = messageReceived.write(writer)
                    packet.data = encrypt(written)
                    console.assert(packet.fragment == undefined)
                }

                //console.assert(packet.data.length <= 962, `packet.data.length = ${packet.data.length}`)

                if(messageAccepted)
                    countTransmittedPacket(packet_type, packet)

                return messageAccepted
            })

            if(autoFilter && callbacks && this['role'] == Role.Client)
                packets = callbacks.filterOutgoing(packets)
            
            //console.log('sum(packets.length)', '=', packets.reduce((sum, p) => sum + p.data.length, 0))

            if(packets.length === 0) return

            const packetsByStreamIdx: WrappedPacketWithStreamIdx[][] = []
            for(const packet of packets){
                const streamIdx = packet.streamIdx ?? DEFAULT_STREAM_IDX
                const streamPackets = packetsByStreamIdx[streamIdx] ??= []
                      streamPackets.push(packet)
            }
            for(let streamIdx = 0 as RemoteStreamIndex; streamIdx < packetsByStreamIdx.length; streamIdx++){
                const packets = packetsByStreamIdx[streamIdx]
                if(packets){
                    const wrapped = Buffer.from(Wrapped.encode({ packets }))
                    onData(wrapped, streamIdx, programHostPort)
                }
            }
        }, opts)
        
        //if(autoLimit && this['role'] == Role.Client){
        //   const kbps = 4 * 1024
        //   const queue: Buffer[] = []
        //   const socketToProgram_send = socketToProgram.send.bind(socketToProgram)
        //   let timeout: ReturnType<typeof setTimeout> | null = null
        //   peerToProgram.onsend = (data) => {
        //       queue.push(data)
        //       if(timeout == null)
        //           sendData_and_setTimeout()
        //   }
        //   function sendData_and_setTimeout(){
        //       const data = queue.shift()
        //       if(data){
        //           socketToProgram_send(data)
        //           timeout = setTimeout(sendData_and_setTimeout, Math.round(data.length / kbps * 1000))
        //       } else {
        //           timeout = null
        //       }
        //   }
        //} else {
        const socketToProgram_send = socketToProgram.send.bind(socketToProgram)
        peerToProgram.onsend = (data) => socketToProgram_send(data)
        //}

        socketToProgram.send = (rawdata, streamIdx) => {

            const unwrapped = Wrapped.decode(rawdata)
            let packets = unwrapped.packets.map((packet): WrappedPacket => ({
                fragment: packet.fragment,
                channelID: packet.channelID,
                data: Buffer.from(packet.data),
            }))

            //for(const packet of packets)
            //    console.log(Date.now(), Role[this['role']], 'receives packet on', `Stream[${streamIdx}]`, /*PKT.ENetChannels[packet.channelID]*/)
            
            const packetsUnreliable: WrappedPacket[] = []

            if(autoFilter)
            packets = packets.filter((packet) => {

                let messageReceived: PKT.BasePacket | undefined
                let messageAccepted = true
                //let messageChanged = false

                const decryptedData = decrypt(packet.data)
                const packet_type = decryptedData[0] as PKT.Type

                filterInOutPackets(packet_type, units, getUnit, decryptedData)

                if(packet_type == PKT.Type.WaypointGroup){

                    const message = messageReceived = new PKT.WaypointGroup().read(decryptedData)

                    for(const movement of message.movements){
                        const { unit, unitCreated } = getUnit(movement.teleportNetID)
                        unit.setWaypoints(movement.waypoints, message.syncID, movement.hasTeleportID, movement.teleportID)
                        //unit.waypointsSyncID = message.syncID
                        //unit.waypointsSyncID = Date.now() & 0xFFFFFFFF
                        //unit.waypointsSyncID = syncID++
                        //unit.waypointsSynced = false
                    }

                    //messageChanged = true
                    messageAccepted = false
                    
                    //const teleportCount = message.movements.length
                    message.movements = getUnsyncedMovements()
                    
                    if(message.movements.length > 0){
                        packet.data = encrypt(message.write())
                        packetsUnreliable.push(packet)
                    }

                    //const n = message.movements.length - teleportCount
                    //if(n != 0)
                    //    console.log('Sending', n, 'more movement datas')
                }
                else
                if(packet_type == PKT.Type.OnReplication){

                    const message = messageReceived = new PKT.OnReplication().read(decryptedData)

                    for(const data of message.data){
                        const { unit, unitCreated } = getUnit(data.unitNetID)
                        unit.mergeReplicationData(data.data, message.syncID)
                        //console.log('OnReplication', unit.id, JSON.stringify(unit.replicationDataUnsynced, null, 4), unit.replicationDataSynced)
                    }

                    messageAccepted = false

                    //const initialCount = message.data.length
                    message.data = getUnsyncedReplicationDatas()
                    if(message.data.length > 0){
                        packet.data = encrypt(message.write())
                        packetsUnreliable.push(packet)
                    }
                    
                    //const n = message.data.length - initialCount
                    //if(n != 0)
                    //    console.log('Sending', n, 'more replication datas')
                }

                //if(messageReceived != undefined && messageAccepted && messageChanged){
                //    packet.data = encrypt(messageReceived.write())
                //    console.assert(packet.fragment == undefined)
                //}

                return messageAccepted
            })

            if(autoFilter && callbacks && this['role'] == Role.Client)
                packets = callbacks.filterIncoming(packets)

            if(packets.length > 0)
                peerToProgram.sendReliable(packets)

            if(packetsUnreliable.length > 0)
                peerToProgram.sendUnreliable(packetsUnreliable)

            return true
        }

        if(this['role'] == Role.Server)
            peerToProgram.connect()
        
        socketToProgram.peer = peerToProgram

        if(callbacks && this['role'] == Role.Client)
            callbacks.setSocketToProgram(socketToProgram)

        function sendToProgram(packet: PKT.BasePacket, channel = PKT.ENetChannels.GENERIC_APP_BROADCAST){
            peerToProgram.sendUnreliable([{
                fragment: undefined,
                data: encrypt(packet.write()),
                channelID: channel,
            }])
        }

        function sendToRemote(message: PKT.GamePacket, streamIdx: RemoteStreamIndex){
            const packet: WrappedPacket = {
                fragment: undefined,
                data: encrypt(message.write()),
                channelID: PKT.ENetChannels.GENERIC_APP_BROADCAST,
            }
            const packets = [ packet ]
            const programHostPort = 'undefined: undefined'
            const wrapped = Buffer.from(Wrapped.encode({ packets }))
            countTransmittedPacket(message._type(), packet)
            onData(wrapped, streamIdx, programHostPort)
        }

        /*
        if(this['role'] == Role.Client){

            setInterval(() => {

                //fixedUpdate(units, send)

                const movements = getUnsyncedMovements()
                if(movements.length > 0){

                    const n = movements.length
                    console.log('Sending', n, 'movement datas')

                    const message = new PKT.WaypointGroup()
                    //message.syncID = Math.floor(os.uptime() * 1000)
                    //message.syncID = Date.now() & 0xFFFFFFFF
                    message.syncID = syncID++
                    message.movements = movements
                    peerToProgram.sendUnreliable([{
                        fragment: undefined,
                        data: encrypt(message.write()),
                        channelID: PKT.ENetChannels.GENERIC_APP_BROADCAST,
                    }])
                }

            }, HEARTBEAT_INTERVAL)
        }
        */

        if(this['role'] == Role.Server){
            setInterval(() => {

                const movements = getUnsyncedMovements(true)
                if(movements.length > 0){
                    const message = new PKT.WaypointGroup()
                    message.syncID = latestSyncID
                    message.movements = movements
                    sendToRemote(message, WAYPOINT_STREAM_IDX)
                }

                const data = getUnsyncedReplicationDatas(true)
                if(data.length > 0){
                    const message = new PKT.OnReplication()
                    message.syncID = latestSyncID
                    message.data = data
                    sendToRemote(message, STATS_REPLICATION_STREAM_IDX)
                }

            }, HEARTBEAT_INTERVAL)
        }

        function getUnsyncedMovements(markAsSynced = false){
            const movements: PKT.MovementDataNormal[] = []
            for(const unit of units.values()){
                if(!unit.waypointsSynced && unit.waypoints.length > 0){
                    unit.waypointsSynced = markAsSynced
                    //unit.currentPosition ??= fromIntToSingle(unit.waypoints[0]!)
                    const mdn = assign(new PKT.MovementDataNormal(), {
                        teleportNetID: unit.id,
                        waypoints: unit.waypoints,
                        //waypoints: [
                        //    fromSingleToInt(unit.currentPosition),
                        //    ...unit.waypoints.slice(1),
                        //],
                        teleportID: (unit.teleportID & 0xFF),
                        hasTeleportID: true,
                        syncID: 0,
                    })
                    movements.push(mdn)
                }
            }
            return movements
        }

        function getUnsyncedReplicationDatas(markAsSynced = false){
            const datas: PKT.ReplicationData[] = []
            for(const unit of units.values()){
                if(!unit.replicationDataSynced && unit.replicationDataUnsynced.length > 0){
                    unit.setReplicationDataSynced(markAsSynced)
                    const rd = assign(new PKT.ReplicationData(), {
                        data: unit.replicationDataUnsynced,
                        unitNetID: unit.id,
                    })
                    datas.push(rd)
                }
            }
            return datas
        }
        
        return socketToProgram
    }

    return proxy
}

function fixedUpdate(units: Map<number, Unit>, send: (packet: PKT.BasePacket, channel?: PKT.ENetChannels) => void){

    //const movements: PKT.MovementDataNormal[] = []
    for(const unit of units.values()){

        if(unit.waypoints.length == 0) continue

        let currentPosition = unit.currentPosition ??= fromIntToSingle(unit.waypoints[0]!)
        
        let distancePassed = 0
        let distanceToPass = unit.movementSpeed * 0.001 * deltaTime * 0.5
        while(unit.waypoints.length >= 2 && distanceToPass > k){

            const nearestWaypoint = fromIntToSingle(unit.waypoints[1]!)
            
            const directionToNearestWaypoint = ssub(nearestWaypoint, currentPosition)
            const distanceToNearestWaypoint = slen(directionToNearestWaypoint)
            if(distanceToPass >= distanceToNearestWaypoint){
                distancePassed += distanceToNearestWaypoint
                distanceToPass -= distanceToNearestWaypoint
                currentPosition = nearestWaypoint
                unit.waypoints.shift()
                continue
            } else {
                distancePassed += distanceToPass
                const directionToNearestWaypointNormalized =
                    (distanceToNearestWaypoint > k) ?
                        sdiv(directionToNearestWaypoint, distanceToNearestWaypoint) :
                        Vector2Single.Zero
                currentPosition = sadd(currentPosition, smul(directionToNearestWaypointNormalized, distanceToPass))
                distanceToPass = 0
                break
            }
        }

        //const distance = slen(ssub(unit.currentPosition, currentPosition))
        //console.log(unit.id, distance / deltaTime)
        //console.log(unit.id, distancePassed / deltaTime * 1000)
        unit.currentPosition = currentPosition

        /*
        const movementData = new PKT.MovementDataNormal()
        movementData.syncID = 0
        movementData.waypoints = [
            fromSingleToInt(currentPosition),
            ...unit.waypoints.slice(1, 2),
            //...unit.waypoints.slice(1),
        ]
        //movementData.pathSpeedOverride = unit.movementSpeed
        movementData.teleportID = (unit.teleportID & 0xFF)
        movementData.teleportNetID = unit.id
        movementData.hasTeleportID = true
        movements.push(movementData)
        */
    }

    /*
    if(movements.length > 0){
        const message = new PKT.WaypointGroup()
        message.syncID = Math.floor(os.uptime() * 1000)
        message.movements = movements
        send(message)
    }
    */
}

function filterInOutPackets(packet_type: PKT.Type, units: Map<number, Unit>, getUnit: (id: number) => { unit: Unit, unitCreated: boolean }, decryptedData: Buffer){

    let messageReceived

    if(packet_type == PKT.Type.S2C_CreateHero){
        const message = messageReceived = new PKT.S2C_CreateHero().read(decryptedData)
        const existingUnit = units.get(message.netObjID)
        console.assert(
            !existingUnit || existingUnit instanceof Hero,
            'Assertion failed: !existingUnit || existingUnit instanceof Hero'
        )
        if(!existingUnit){
            const hero = new Hero(message.netObjID)
            units.set(hero.id, hero)
        }
    }

    if(packet_type == PKT.Type.Barrack_SpawnUnit){
        const message = messageReceived = new PKT.Barrack_SpawnUnit().read(decryptedData)
        const existingUnit = units.get(message.netObjID)
        console.assert(
            !existingUnit || existingUnit instanceof Minion,
            'Assertion failed: !existingUnit || existingUnit instanceof Minion'
        )
        if(!existingUnit){
            const minion = new Minion(message.netObjID)
            units.set(minion.id, minion)
        }
    }

    {
        let message: PKT.Building_Die | PKT.NPC_Hero_Die | PKT.NPC_Die | undefined
        if(packet_type == PKT.Type.Building_Die) message = messageReceived = new PKT.Building_Die().read(decryptedData)
        if(packet_type == PKT.Type.NPC_Hero_Die) message = messageReceived = new PKT.NPC_Hero_Die().read(decryptedData)
        if(packet_type == PKT.Type.NPC_Die     ) message = messageReceived = new PKT.NPC_Die     ().read(decryptedData)
        if(message){
            const targetID = message.senderNetID
            for(const unit of units.values())
                if(unit.isAttacking && unit.targetID == targetID)
                    unit.turnOffAA()
            const unit = units.get(targetID)
            if(unit instanceof Minion)
                units.delete(unit.id)
        }
    }
    
    if(packet_type == PKT.Type.Basic_Attack){
        const message = messageReceived = new PKT.Basic_Attack().read(decryptedData)
        const { unit, unitCreated } = getUnit(message.senderNetID)
        unit.turnOnAA(message.targetNetID)
    }
    if(packet_type == PKT.Type.Basic_Attack_Pos){
        const message = messageReceived = new PKT.Basic_Attack_Pos().read(decryptedData)
        const { unit, unitCreated } = getUnit(message.senderNetID)
        unit.turnOnAA(message.targetNetID)
    }
    if(packet_type == PKT.Type.NPC_InstantStop_Attack){
        const message = messageReceived = new PKT.NPC_InstantStop_Attack().read(decryptedData)
        const { unit, unitCreated } = getUnit(message.senderNetID)
        unit.turnOffAA()
    }
    if(packet_type == PKT.Type.AI_TargetS2C){
        const message = messageReceived = new PKT.AI_TargetS2C().read(decryptedData)
        const { unit, unitCreated } = getUnit(message.senderNetID)
        //console.assert(unit.isAttacking, 'Assertion failed: unit.isAttacking')

        unit.targetID = message.targetID
        if(unit.isAttacking && unit.targetID == 0)
            unit.turnOffAA()
    }
}
