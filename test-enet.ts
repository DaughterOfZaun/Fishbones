import { dlopen, FFIType, ptr, toArrayBuffer, type Pointer, read } from "bun:ffi"

import os from 'node:os'
//import type { SocketToProgram } from "./utils/proxy/proxy"
import { Role, type AnySocket } from "./utils/proxy/shared"
import { getFreePort, registerShutdownHandler } from "./utils/process/process"
import type { AbortOptions } from "@libp2p/interface"
import type { WrappedPacket } from "./utils/proxy/peer"
import { Wrapped } from "./message/proxy"

type BELE = 'BE' | 'LE'
const BELE: BELE = os.endianness()
Buffer.prototype.writeUint16 = Buffer.prototype[`writeUint16${BELE}`]
Buffer.prototype.writeUint32 = Buffer.prototype[`writeUint32${BELE}`]
type BufferType = ReturnType<(typeof Buffer<ArrayBuffer>)['alloc']>
declare global {
    interface Buffer {
        writeUint16: BufferType[`writeUint16${BELE}`]
        writeUint32: BufferType[`writeUint32${BELE}`]
    }
}

const is64Bit = ['arm64', 'ppc64', 'x64', 's390x'].includes(process.arch)
const bits = is64Bit ? 64 : 32
const sizeof = {
    ptr_t: bits / 8,
    size_t: bits / 8,
    uint32: 32 / 8,
    uint16: 16 / 8,
    uint8: 8 / 8,
    int: 32 / 8,
}

const ptr_t = is64Bit ? FFIType.u64 as const : FFIType.u32 as const
const size_t = is64Bit ? FFIType.u64 as const : FFIType.u32 as const
const uint32_t = FFIType.uint32_t as const
const uint8_t = FFIType.uint8_t as const
const int32_t = FFIType.int32_t as const

const {
    symbols: {
        enet_initialize,
        enet_deinitialize,
        
        enet_host_create,
        enet_host_service,
        enet_host_connect,
        enet_host_destroy,

        enet_packet_create,
        enet_packet_destroy,

        enet_peer_send,
    },
} = dlopen(
    '/home/user/Documents/launcher/thirdparty/enet-1.2.5/install/usr/local/lib/libenet.so.0.0.3',
    {
        // int enet_initialize
        enet_initialize: {
            returns: int32_t,
        },
        // void enet_deinitialize
        enet_deinitialize: {
            returns: FFIType.void,
        },
        // ENetHost * enet_host_create
        enet_host_create: {
            returns: ptr_t,
            args: [
                ptr_t,    // const ENetAddress * address
                size_t,   // size_t peerCount
                uint32_t, // enet_uint32 incomingBandwidth
                uint32_t, // enet_uint32 outgoingBandwidth
            ] as const,
        },
        // int enet_host_service
        enet_host_service: {
            returns: int32_t,
            args: [
                ptr_t,    // ENetHost * host
                ptr_t,    // ENetEvent * event
                uint32_t, // enet_uint32 timeout
            ] as const,
        },
        // ENetPeer * enet_host_connect
        enet_host_connect: {
            returns: ptr_t,
            args: [
                ptr_t,  // ENetHost * host
                ptr_t,  // const ENetAddress * address
                size_t, // size_t channelCount
            ] as const,
        },
        // void enet_host_destroy
        enet_host_destroy: {
            //returns: FFIType.void,
            args: [
                ptr_t,    // ENetHost * host
            ] as const,
        },
        // ENetPacket * enet_packet_create
        enet_packet_create: {
            returns: ptr_t,
            args: [
                ptr_t,    // const void * data
                size_t,   // size_t dataLength
                uint32_t, // enet_uint32 flags
            ] as const,
        },
        // void enet_packet_destroy
        enet_packet_destroy: {
            returns: FFIType.void,
            args: [
                ptr_t, // ENetPacket * packet
            ] as const,
        },
        // int enet_peer_send
        enet_peer_send: {
            returns: int32_t,
            args: [
                ptr_t,   // ENetPeer * peer
                uint8_t, // enet_uint8 channelID
                ptr_t,   // ENetPacket * packet
            ] as const,
        }
    },
)

class ENetAddress {

    public constructor(
        public readonly host: number, // enet_uint32 host
        public readonly port: number, // enet_uint16 port
    ){}

    private buffer?: Buffer
    private pointer?: Pointer
    public get ptr(){
        if(!this.buffer){
            this.buffer = Buffer.alloc(
                + sizeof.uint32
                + sizeof.uint16
            )
            let offset = 0
            this.buffer.writeUint32BE(this.host, offset); offset += sizeof.uint32
            this.buffer.writeUint16(this.port, offset); offset += sizeof.uint16
        }
        if(!this.pointer){
            this.pointer = ptr(this.buffer)
        }
        return this.pointer
    }
}

enum ENetEventType {
    NONE       = 0,  
    CONNECT    = 1,  
    DISCONNECT = 2,
    RECEIVE    = 3,
}

type Ptr<T> = number | bigint

class ENetPeer {}

const read_size = is64Bit ? read.u64 : read.u32
const read_ptr = is64Bit ? read.u64 : read.u32

enum ENetPacketFlag {
    NONE        = 0,
    RELIABLE    = (1 << 0),
    UNSEQUENCED = (1 << 1),
    NO_ALLOCATE = (1 << 2),
} ENetPacketFlag

class ENetPacket {

    // size_t referenceCount
    // enet_uint32 flags
    // enet_uint8 * data
    // size_t dataLength
    // ENetPacketFreeCallback freeCallback
    // void * userData

    public data?: Buffer

    public read(ptr: Ptr<ENetPacket>){
        let offset = 0
        offset += sizeof.size_t
        offset += sizeof.uint32
        const dataPointer = read_ptr(ptr as Pointer, offset) as Pointer; offset += sizeof.ptr_t
        const dataLength = read_size(ptr as Pointer, offset); offset += sizeof.ptr_t
        // ...
        this.data = Buffer.from(toArrayBuffer(dataPointer, 0, Number(dataLength)))
    }
}

class ENetEvent {
    
    // ENetEventType type
    public type: ENetEventType = 0
    // ENetPeer *    peer
    public peer: Ptr<ENetPeer> = NULL
    // enet_uint8    channelID
    public channelID: number = 0
    // enet_uint32   data
    public data: number = 0
    // ENetPacket *  packet
    public packet: Ptr<ENetPacket> = NULL
    
    private buffer?: Buffer
    private pointer?: Pointer
    public get ptr(){
        if(!this.buffer){
            this.buffer = Buffer.alloc(
                + sizeof.uint8 //TODO:
                + sizeof.ptr_t
                + sizeof.uint8
                + sizeof.uint32
                + sizeof.ptr_t
            )
        }
        if(!this.pointer){
            this.pointer = ptr(this.buffer)
        }
        return this.pointer
    }

    public read() {
        throw new Error("Method not implemented.")
    }
}

// const ENET_HOST_ANY = 0
// const ENET_PORT_ANY = 0
const LOCALHOST = 127 << (3 * 8) | 1
const CHANNEL_COUNT = 8
const NULL = 0

class ENetHost {}

enet_initialize()
registerShutdownHandler(() => {
    enet_deinitialize()
})

type OnData = (data: Buffer, programHostPort: string) => void
async function createSocketToProgram(role: Role, programPort: number, onData: OnData, opts: Required<AbortOptions>): Promise<AnySocket> {

    let connected = false
    let opened = true

    let host: Ptr<ENetHost> = NULL
    if(role == Role.Server){
        const port = await getFreePort()
        console.log('port', port)
        const addr = new ENetAddress(LOCALHOST, port)
        console.log('addr.ptr', addr.ptr)
        host = enet_host_create(addr.ptr, 1, 0, 0)
        console.log('host.ptr', host)
    } else {
        host = enet_host_create(NULL, 1, 0, 0)
        console.log('host.ptr', host)
    }

    let peer: Ptr<ENetPeer> = NULL
    const event = new ENetEvent()
    const packet = new ENetPacket()

    let immediate: ReturnType<typeof setImmediate>
    function serve(){
        
        const packets: WrappedPacket[] = []
        const packetsToFree: Ptr<ENetPacket>[] = []

        while(enet_host_service(host, event.ptr, 0) > 0){
            
            event.read()

            switch (event.type){
                case ENetEventType.CONNECT: {
                    peer = event.peer
                    connected = true
                    break
                }
                case ENetEventType.RECEIVE: {
                    
                    packet.read(event.packet)
                    
                    packets.push({
                        channelID: event.channelID,
                        fragment: undefined,
                        data: packet.data!,
                    })
                    
                    packetsToFree.push(event.packet)

                    break
                }
                case ENetEventType.DISCONNECT: {
                    //event.peer.data = NULL
                    connected = false
                    break
                }
            }
        }

        if(packets.length > 0){
            const wrapped = Buffer.from(Wrapped.encode({ packets }))
            onData(wrapped, 'host:port')
        }

        for(const packet of packetsToFree)
            enet_packet_destroy(packet)

        immediate = setImmediate(serve)
    }
    immediate = setImmediate(serve)

    if(role == Role.Client){
        const addr = new ENetAddress(LOCALHOST, programPort)
        peer = enet_host_connect(host, addr.ptr, CHANNEL_COUNT)
    }

    return {
        sourceHostPort: 'host:port',
        targetHostPort: 'host:port',
        //get connected(){ return connected },
        send(wrapped: Buffer){
            let result = true
            const packets = Wrapped.decode(wrapped).packets
            for(const { data, channelID } of packets){
                const packet = enet_packet_create(ptr(data), data.length, ENetPacketFlag.NONE) 
                result &&= enet_peer_send(peer, channelID, packet) == 0
            }
            return result
        },
        //get opened(){ return opened },
        close(){
            clearImmediate(immediate)
            enet_host_destroy(host)
            opened = false
        },
    }
}
