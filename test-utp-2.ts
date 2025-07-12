import UTP from './utp-native'
import { UTPAddress, AddressFamily } from './utp-native/address'
import { UTPError, UTPShutdown, UTPState } from './utp-native/enums'
import type { UTPSocket } from './utp-native/socket'
import { pushable, type Pushable } from 'it-pushable'
import { isIPv4, isIPv6 } from '@chainsafe/is-ip'
import type { UTPContext } from './utp-native/context'

console.log('begin')

const determineAddressFamily = (host: string) => {
    const ipv4 = isIPv4(host)
    const ipv6 = ipv4 ? false : isIPv6(host)
    console.assert(ipv4 || ipv6)
    return ipv4 ? AddressFamily.INET : AddressFamily.INET6
}

type UTPSocketExt = UTPSocket & {
    wrapper?: Socket
}

let udp: Bun.udp.Socket<'buffer'>
let ctx: UTPContext
let server: Server

export function createServer(opts: {}, onConnection?: (socket: Socket) => void){
    
    Bun.udpSocket({
        socket: {
            data(socket, data, port, address){
                ctx.process_udp(data, new UTPAddress(determineAddressFamily(address), address, port))
            },
            drain(socket){},
            error(socket, error){},
        }
    }).then(socket => udp = socket)

    ctx = UTP.init(2, {
        firewall(address){ return 0 },
        accept(socket: UTPSocketExt, address){
            const wrapper = socket.wrapper = new Socket(socket, address)
            server.emit('connection', wrapper)
        },
        read(socket: UTPSocketExt, buf){
            socket.wrapper?.queue.push(buf)
        },
        state_change(socket: UTPSocketExt, state){
            if(state === UTPState.CONNECT)
                socket.wrapper?.emit('connect', void 0)
        },
        error(socket: UTPSocketExt, err){
            let msg = 'UNKNOWN'
            if(err == UTPError.CONNREFUSED) msg = 'CONNREFUSED'
            if(err == UTPError.CONNRESET) msg = 'CONNRESET'
            if(err == UTPError.TIMEDOUT) msg = 'TIMEDOUT'
            socket.wrapper?.emit('error', new Error(msg))
        },
        send(socket: UTPSocketExt, buf, address, flags){
            udp.send(buf, address.port, address.host)
        },
        log(socket: UTPSocketExt, buf){
            console.log(buf)
        },
    })
    
    server = new Server()
    if(onConnection) server.on('connection', onConnection.bind(server))
    server.listen(opts)
    return server
}

export function connect(opts: { host: string, port: number }){
    const { host, port } = opts
    
    const socket = ctx.create_socket() as UTPSocketExt
    const address = new UTPAddress(determineAddressFamily(host), host, port)
    const wrapper = socket.wrapper = new Socket(socket, address)
    socket.connect(address)

    return wrapper
}

class TypedEventEmitter<Events> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    on<K extends keyof Events>(arg0: K, arg1: (arg: Events[K]) => void) {
        //throw new Error('Method not implemented.')
        return this
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    once<K extends keyof Events>(arg0: K, arg1: (arg: Events[K]) => void) {
        //throw new Error('Method not implemented.')
        return this
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    emit<K extends keyof Events>(arg0: K, arg1: Events[K]) {
        throw new Error('Method not implemented.')
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    removeListener<K extends keyof Events>(arg0: K, arg1: (arg: Events[K]) => void) {
        throw new Error('Method not implemented.')
    }
}

type ServerEvents = {
    connection: Socket,
    listening: void,
    error: Error,
    close: void,
    drop: void,
}

export class Server extends TypedEventEmitter<ServerEvents> {
    
    listening!: boolean
    maxConnections!: number
    
    address() {
        return { address: udp.hostname, port: udp.port }
    }
    
    listen(opts: {}, callback?: () => void) {
        throw new Error('Method not implemented.')
    }

    close() {
        throw new Error('Method not implemented.')
    }
}

type SocketEvents = {
    error: Error,
    timeout: void,
    connect: void,
    drain: void,
    close: void,
    end: void,
}

export class Socket extends TypedEventEmitter<SocketEvents> {

    closed: boolean = false
    destroyed: boolean = false
    readable: boolean = false
    
    queue: Pushable<Buffer> = pushable()
    writableLength: number = 0
    
    remoteAddress: string
    remotePort: number

    constructor(private readonly wrapped: UTPSocket, address: UTPAddress){
        super()
        this.remoteAddress = address.host
        this.remotePort = address.port
    }
    
    setTimeout(inactivityTimeout: number) {
        throw new Error('Method not implemented.')
    }

    end() {
        this.wrapped.shutdown(UTPShutdown.SHUT_WR)
    }

    destroy(err?: any) {
        this.wrapped.close()
    }
}

const s1 = ctx.create_socket()
s1.connect(new UTPAddress(AddressFamily.INET, '127.0.0.1', 9000))
s1.shutdown(UTPShutdown.SHUT_RDWR)
s1.close()
ctx.destroy()

console.log('end')
