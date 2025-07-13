import { EventEmitter as TypedEventEmitter } from 'node:events'

export const isUTP = (msg: Buffer) => {
    if(msg.length < /*sizeof_PacketFormatV1*/ 20) return false
    
    const ver_type = msg[0]!
	const version = ver_type & 0xf
	const type = ver_type >> 4
	const ext = msg[1]!

    return type < /*ST_NUM_STATES*/ 5 && ext < 3 && version === 1
}

export const isDHT = (msg: Buffer) => {
    //TODO:
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

type SocketType = "udp4" | "udp6";
export function createSocket(type: SocketType, onMessage?: (msg: Buffer, rinfo: RemoteInfo) => void): Socket {
    const socket = new Socket(type)
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

type MessageFilter = (msg: Buffer) => boolean
const defaultFilter = () => false

class Socket extends TypedEventEmitter<SocketEvents> {

    private static udp?: Bun.udp.Socket<'buffer'>
    private static udpPromise?: Promise<unknown>
    private static sockets = new Set<Socket>()

    public filter: MessageFilter = defaultFilter

    constructor(
        private readonly type: SocketType
    ){
        super()
    }

    bind(port?: number, address?: string, callback?: () => void): this {
        
        Socket.sockets.add(this)

        Socket.udpPromise ??= Bun.udpSocket({
            binaryType: 'buffer',
            //hostname: address,
            //port: port,
            socket: {
                data: (socket, data, port, address) => {
                    for(const socket of Socket.sockets){
                        if(socket.filter(data)){
                            socket.emit('message', data, { address, port })
                        }
                    }
                },
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                drain: (socket) => {},
                error: (socket, error) => {
                    for(const socket of Socket.sockets){
                        socket.emit('error', error)
                    }
                },
            }
        }).then(socket => {
            Socket.udp = socket
        })

        if(callback) Socket.udpPromise.then(() => callback.call(this))
        
        return this
    }

    address(): AddressInfo {
        return {
            address: Socket.udp!.hostname,
            port: Socket.udp!.port,
        }
    }

    send(
        msg: Uint8Array, offset: number, length: number,
        port?: number, address?: string,
        callback?: (error: Error | null, bytes: number) => void
    ): void {
        console.assert(offset == 0 && length == msg.length)
        const success = port && address && Socket.udp!.send(msg, port, address)
        if(callback){
            if(success) callback.call(this, null, msg.length)
            else callback.call(this, new Error(), 0)
        } else if(!success){
            this.emit('error', new Error())
        }
    }

    close(){
        Socket.sockets.delete(this)
        if(Socket.sockets.size == 0){
            Socket.udp?.close()
            Socket.udp = undefined
            Socket.udpPromise = undefined
        }
    }
}
