import { EventEmitter as TypedEventEmitter } from 'node:events'

//src: utp-native/deps/libutp/utp_internal.cpp
export const isUTP = (msg: Buffer) => {
    if(msg.length < /*sizeof_PacketFormatV1*/ 20) return false
    
    const ver_type = msg[0]!
	const version = ver_type & 0xf
	const type = ver_type >> 4
	const ext = msg[1]!

    return type < /*ST_NUM_STATES*/ 5 && ext < 3 && version === 1
}

//src: wireshark/epan/dissectors/packet-bt-dht.c
const dhtHeaders = [ 'd1:ad', 'd1:rd', 'd2:ip', 'd1:el' ]
//const dhtHeaderMaxLength = dhtHeaders.reduce((a, e) => Math.max(a, e.length), 0)
export const isDHT = (msg: Buffer) => {
    if(msg.length < /*DHT_MIN_LEN*/ 5) return false
    const first = msg.toString('utf8', 0, /*dhtHeaderMaxLength*/ 5)
    const last = msg.toString('utf8', msg.length - 1, msg.length)
    const result = dhtHeaders.includes(first) && last == 'e'
    //console.log('isDHT', first, last, result)
    return result
}

export const isENet = (msg: Buffer) => {
    if(msg) throw new Error() //TODO:
}

interface RemoteInfo {
    address: string;
    //family: 'IPv4' | 'IPv6';
    port: number;
    //size: number;
}

interface AddressInfo {
    address: string;
    //family: 'IPv4' | 'IPv6';
    port: number;
}

const binaryType = 'buffer' as const
type BinaryType = typeof binaryType

type BunSocket = Bun.udp.Socket<BinaryType>
type BunSocketOptions = Bun.udp.SocketOptions<BinaryType> & {
    socket: BunSocketHandler
}
type BunSocketHandler = Bun.udp.SocketHandler<BinaryType> & {
    filter: DataFilter
}

type DataFilter = (data: Buffer) => boolean
//const defaultFilter = () => false

const container = new class BunSocketContainer {
    socket!: BunSocket
    promise: undefined | Promise<BunSocket>
    handlers = new Set<BunSocketHandler>()
    refs: number = 0
}

export async function udpSocket(options: BunSocketOptions): Promise<BunSocket> {
    const { socket: handler } = options

    console.assert(options.binaryType === binaryType)

    container.socket = await (container.promise ??= Bun.udpSocket({
        binaryType: binaryType,
        hostname: options.hostname,
        port: options.port,
        socket: {
            data: (socket, data, port, address) => {
                for(const handler of container.handlers){
                    if(handler.filter?.(data)){
                        handler.data?.(socket, data, port, address)
                        break
                    }
                }
            },
            drain: (socket) => {
                for(const handler of container.handlers){
                    handler.drain?.(socket)
                }
            },
            error: (socket, error) => {
                for(const handler of container.handlers){
                    handler.error?.(socket, error)
                }
            },
        }
    }))

    return new BunSocketWrapper(handler)
}

class BunSocketWrapper {

    public constructor(
        private handler?: BunSocketHandler
    ){
        this.open()
    }

    public get hostname(){ return container.socket.hostname }
    public get port(){ return container.socket.port }
    public get address(){ return container.socket.address }
    public get binaryType(){ return container.socket.binaryType }
    
    private opened = false
    private open(){
        this.opened = true
        if(this.handler)
            container.handlers.add(this.handler)
        this.ref()
    }
    public get closed(){ return !this.opened }
    public close(){
        this.opened = false
        if(this.handler)
            container.handlers.delete(this.handler)
        this.unref()
    }

    private reffs = false
    public ref(){
        if(!this.reffs){
            this.reffs = true
            if(++container.refs > 0) container.socket.ref()
        }
    }
    public unref(){
        if(this.reffs){
            this.reffs = false
            if(--container.refs <= 0) container.socket.unref()
        }
    }

    sendMany(packets: readonly (Bun.udp.Data | string | number)[]): number {
        return container.socket.sendMany(packets)
    }
    send(data: Bun.udp.Data, port: number, address: string): boolean {
        return container.socket.send(data, port, address)
    }

    reload(handler: BunSocketHandler): void {
        if(this.handler)
            container.handlers.delete(this.handler)
        
        this.handler = handler

        if(this.handler)
            container.handlers.add(this.handler)
    }
}

type SocketType = "udp4" | "udp6";
type SocketOptions = {
    type: SocketType
    filter: DataFilter
}
export function createSocket(options: SocketOptions, onMessage?: (msg: Buffer, rinfo: RemoteInfo) => void): Socket {
    const { type, filter } = options
    const socket = new Socket(type, filter)
    if(onMessage) socket.on('message', onMessage)
    return socket
}

type SocketEvents = {
    message: [ Buffer, RemoteInfo ],
    error: [ Error ],
    listening: [],
    //connect: [],
    close: [],
}

export type { Socket }
class Socket extends TypedEventEmitter<SocketEvents> {

    constructor(
        private readonly type: SocketType,
        private readonly filter: DataFilter
    ){
        super()
    }

    socket!: BunSocket
    promise: undefined | Promise<BunSocket>

    //public filter: DataFilter = defaultFilter

    bind(port?: number, address?: string, onListening?: () => void): this {
        Promise.resolve().then(async () => {

            //if(onListening) this.once('listening', onListening.bind(this))
            
            this.socket = await (this.promise ??= udpSocket({
                binaryType: binaryType,
                hostname: address,
                port: port,
                socket: {
                    data: (socket, data, port, address) => {
                        this.emit('message', data, { address, port })
                    },
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    drain: (socket) => {},
                    error: (socket, error) => {
                        this.emit('error', error)
                    },
                    //filter: (data) => this.filter(data)
                    filter: this.filter
                }
            }))

            if(onListening) onListening.call(this)
            this.emit('listening')
        })
        return this
    }

    address(): AddressInfo {
        return {
            address: this.socket.hostname,
            port: this.socket.port,
        }
    }

    send(
        msg: Uint8Array, offset: number, length: number,
        port?: number, address?: string,
        callback?: (error: Error | null, bytes: number) => void
    ): void {
        console.assert(offset == 0 && length == msg.length)
        const success = port && address && this.socket.send(msg, port, address)
        if(callback){
            if(success) callback.call(this, null, msg.length)
            else callback.call(this, new Error(), 0)
        } else if(!success){
            this.emit('error', new Error())
        }
    }

    close(){
        this.socket.close()
        this.promise = undefined
    }
}
