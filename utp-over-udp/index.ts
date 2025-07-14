import { UTPAddress, determineAddressFamily } from '../utp-native/address'

import { Socket, type UTPSocketExt } from './socket'
import { Server } from './server'
export type { Socket, Server }

let globalServer: Server

export function createServer(opts: object, onConnection?: (socket: Socket) => void): Server {
    console.assert(!globalServer)

    const server = new Server()
    if(onConnection) server.on('connection', onConnection.bind(server))
    globalServer ??= server
    return server
}

export function connect(opts: { host?: string, port?: number }): Socket {
    console.assert(globalServer)

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
