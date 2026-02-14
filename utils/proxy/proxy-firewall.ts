import { Peer, type WrappedPacket } from './peer'
import { Proxy } from './proxy'
import { Wrapped } from '../../message/proxy'
import { Role } from './shared'
import { decrypt, encrypt } from './blowfish'
import * as PKT from './pkt'
import { toString, Vector2 } from './math'
import { Writer } from './enet'

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
        
        //console.log(fragmentID, info.fragmentNumber, fragment.numbers.size, '/', fragment.count, 'at', info.fragmentOffset, 'for', packet.data.length, '/', fragment.buffer.length)
        
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
        
        const peerToProgram = new Peer('peerToProgram')
        
        const socketToProgram = await super_createSocketToProgram(programHost, programPort, (rawdata, programHostPort) => {
            let packets = peerToProgram.receivePackets(rawdata)
            .map(defragment).filter(packet => !!packet)
            .filter((packet) => {
                
                let messageReceived: PKT.BasePacket | undefined
                let messageAccepted = true
                let messageChanged = false
                
                const decryptedData = decrypt(packet.data)
                const packet_type = decryptedData[0] as PKT.Type
                
                if(packet_type == PKT.Type.World_SendCamera_Server){
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
                    messageAccepted = false
                    const message = messageReceived = new PKT.NPC_InstantStop_Attack().read(decryptedData)
                    const { unit, unitCreated } = getUnit(message.senderNetID)
                    if(unit.isAttacking){
                        unit.isAttacking = false
                        messageAccepted = true
                    }
                }
                if(packet_type == PKT.Type.WaypointGroup){
                    messageAccepted = false
                    const message = messageReceived = new PKT.WaypointGroup().read(decryptedData)
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
                            messageAccepted = true
                            return true
                        }
                        //messageChanged = true
                        return false
                    })
                }
                
                if(messageAccepted)
                    console.log('accepted', PKT.Type[packet_type], 'on', packet.channelID)

                if(messageReceived != undefined && messageAccepted && messageChanged){
                    const writer = new Writer(packet.data, 'LE') //HACK:
                    packet.data = encrypt(messageReceived.write(writer))
                    console.assert(packet.fragment == undefined)
                }
                return messageAccepted
            })
            
            if(packets.length === 0) return

            const wrapped = Buffer.from(Wrapped.encode({ packets }))
            onData(wrapped, programHostPort)
        }, opts)
        
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
