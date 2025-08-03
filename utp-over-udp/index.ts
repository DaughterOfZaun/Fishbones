import { UTPAddress, determineAddressFamily } from '../utp-native/address'

import { Socket, type UTPSocketExt } from './socket'
import { Server } from './server'
export type { Socket, Server }

let globalServer: Server

export function createServer(opts: object, onConnection?: (socket: Socket) => void): Server {
    if(globalServer){
        const msg = 'The global server has already been created.'
        //console.trace(msg)
        throw new Error(msg)
    }
    const server = new Server()
    if(onConnection) server.on('connection', onConnection.bind(server))
    globalServer ??= server
    return server
}

export function connect(opts: { host?: string, port?: number }): Socket {
    if(!globalServer){
        const msg = 'A global server must be created before connections can be established.'
        //console.trace(msg)
        throw new Error(msg)
    }
    const { host, port } = opts
    const { ctx } = globalServer

    if(!host || !port)
        throw new Error()

    const socket = ctx.create_socket() as UTPSocketExt
    const address = new UTPAddress(determineAddressFamily(host), host, port)
    const wrapper = socket.wrapper = new Socket(socket, address)
    socket.connect(address)

    return wrapper
}
