import { Peer, type WrappedPacket } from './peer'
import { Proxy } from './proxy'
import { Wrapped } from '../../message/proxy'
import { Role } from './shared'
import { decrypt, encrypt } from './blowfish'
import * as PKT from './pkt'
import { toString, Vector2 } from './math'
import { Writer } from './enet'
import { replacer } from './utils'

class Unit {
    public teleportID: number = 0
    public waypoints: Vector2[] = []
    public isAttacking: boolean = false
    constructor(public id: number){}
}

class Fragment {
    public buffer: Buffer
    public numbers = new Set<number>()
    public constructor(public count: number, length: number){
        this.buffer = Buffer.alloc(length)
    }
}

export const firewall = <T extends Proxy>(proxy: T, enabled: boolean): T => {

    if(!enabled) return proxy

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
        
        const autoDefrag = true
        const autoFilter = true
        const autoRespond = true
        const autoLimit = false

        const peerToProgram = new Peer('peerToProgram')
        const respond = <T extends PKT.BasePacket>(packet: WrappedPacket, ack: T, fields: Partial<T>) => {
            Object.assign(ack, fields)
            return peerToProgram.sendUnreliable([{
                fragment: undefined,
                data: encrypt(ack.write()),
                channelID: packet.channelID,
            }])
        }
        
        const socketToProgram = await super_createSocketToProgram(programHost, programPort, (rawdata, programHostPort) => {
            let packets = peerToProgram.receivePackets(rawdata)

            if(autoDefrag)
            packets = packets.map(defragment).filter(packet => !!packet)

            if(autoFilter)
            packets = packets.filter((packet) => {
                
                let messageReceived: PKT.BasePacket | undefined
                let messageAccepted = true
                let messageChanged = false
                
                const decryptedData = decrypt(packet.data)
                const packet_type = decryptedData[0] as PKT.Type
                
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

                if(autoRespond && packet_type == PKT.Type.OnReplication){
                    const message = messageReceived = new PKT.OnReplication().read(decryptedData)
                    respond(packet, new PKT.OnReplication_Acc(), {
                        senderNetID: message.senderNetID,
                        syncID: message.syncID,
                    })
                }
                if(autoRespond && packet_type == PKT.Type.OnReplication_Acc){
                    messageAccepted = false
                }
                
                if(packet_type == PKT.Type.Basic_Attack){
                    const message = messageReceived = new PKT.Basic_Attack().read(decryptedData)
                    const { unit, unitCreated } = getUnit(message.senderNetID)
                    unit.isAttacking = true
                    unit.waypoints = []
                }
                if(packet_type == PKT.Type.Basic_Attack_Pos){
                    const message = messageReceived = new PKT.Basic_Attack_Pos().read(decryptedData)
                    const { unit, unitCreated } = getUnit(message.senderNetID)
                    unit.isAttacking = true
                    unit.waypoints = []
                }
                if(packet_type == PKT.Type.NPC_InstantStop_Attack){
                    const message = messageReceived = new PKT.NPC_InstantStop_Attack().read(decryptedData)
                    const { unit, unitCreated } = getUnit(message.senderNetID)
                    messageAccepted = unit.isAttacking
                    unit.isAttacking = false
                }

                if(packet_type == PKT.Type.WaypointGroup){
                    const message = messageReceived = new PKT.WaypointGroup().read(decryptedData)

                    const teleportCount = message.movements.length
                    
                    message.movements = message.movements.filter(movement => {

                        const { unit, unitCreated } = getUnit(movement.teleportNetID)
                        
                        const teleportIDChanged = unitCreated || movement.hasTeleportID && movement.teleportID != unit.teleportID
                        const waypointsChanged = unitCreated || movement.waypoints.length > unit.waypoints.length || !movement.waypoints.every((waypoint, i) => {
                            if(i == 0) return true // Current position.
                            return waypoint == unit.waypoints[unit.waypoints.length - movement.waypoints.length + i]
                        })

                        // console.log(
                        //     '', unit.id, unit.teleportID, `[${unit.waypoints.map(wp => `(${toString(wp)})`).join(', ')}]`, 'vs\n',
                        //         unit.id, movement.teleportID, `[${movement.waypoints.map(wp => `(${toString(wp)})`).join(', ')}]`, '\n',
                        //         teleportIDChanged, waypointsChanged, teleportIDChanged || waypointsChanged,
                        // )

                        if(teleportIDChanged || waypointsChanged){
                            if(movement.hasTeleportID)
                            unit.teleportID = movement.teleportID
                            unit.waypoints = movement.waypoints
                            return true
                        }
                        return false
                    })

                    messageAccepted = message.movements.length > 0
                    messageChanged = message.movements.length != teleportCount

                    if(autoRespond)
                    respond(packet, new PKT.Waypoint_Acc(), {
                        senderNetID: message.senderNetID,
                        syncID: message.syncID,
                        teleportCount, //TODO:
                    })
                }
                if(autoRespond && packet_type == PKT.Type.Waypoint_Acc){
                    messageAccepted = false
                }
                
                //if(messageAccepted)
                //    console.log('accepted', PKT.Type[packet_type], 'on', packet.channelID)
                
                if(messageReceived != undefined && messageAccepted && messageChanged){
                    //const writer = new Writer(packet.data, 'LE') //HACK:
                    //const writer = new Writer(Buffer.alloc(1024), 'LE') //HACK:
                    const writer = undefined
                    const written = messageReceived.write(writer)
                    packet.data = encrypt(written)
                    console.assert(packet.fragment == undefined)
                }

                //console.assert(packet.data.length <= 962, `packet.data.length = ${packet.data.length}`)

                return messageAccepted
            })
            
            //console.log('sum(packets.length)', '=', packets.reduce((sum, p) => sum + p.data.length, 0))

            if(packets.length === 0) return

            const wrapped = Buffer.from(Wrapped.encode({ packets }))
            onData(wrapped, programHostPort)
        }, opts)
        
        if(autoLimit && this['role'] == Role.Client){
           const kbps = 4 * 1024
           const queue: Buffer[] = []
           const socketToProgram_send = socketToProgram.send.bind(socketToProgram)
           let timeout: ReturnType<typeof setTimeout> | null = null
           peerToProgram.onsend = (data) => {
               queue.push(data)
               if(timeout == null)
                   sendData_and_setTimeout()
           }
           function sendData_and_setTimeout(){
               const data = queue.shift()
               if(data){
                   socketToProgram_send(data)
                   timeout = setTimeout(sendData_and_setTimeout, Math.round(data.length / kbps * 1000))
               } else {
                   timeout = null
               }
           }
        } else
        peerToProgram.onsend = socketToProgram.send.bind(socketToProgram)

        socketToProgram.send = (rawdata) => {

            const unwrapped = Wrapped.decode(rawdata)
            const packets = unwrapped.packets.map(packet => ({
                fragment: packet.fragment,
                channelID: packet.channelID,
                data: Buffer.from(packet.data),
            }))
            peerToProgram.sendUnreliable(packets)
            return true
        }

        if(this['role'] == Role.Server)
            peerToProgram.connect()
        
        return socketToProgram
    }

    return proxy
}
