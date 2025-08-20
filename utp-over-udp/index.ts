import { Socket } from './socket'
import { Server } from './server'
export type { Socket, Server }

type CreationContext = Partial<{
    firstCreatedServer: Server
    lastCreatedServer: Server
}>

const globalContext: CreationContext = {}
export const createServer = createServerWithContext.bind(null, globalContext)
export const connect = connectWithContext.bind(null, globalContext)

export function createServerWithContext(ctx: CreationContext, opts: object, onConnection?: (socket: Socket) => void): Server {
    const server = new Server()
    if(onConnection) server.on('connection', onConnection.bind(server))
    ctx.firstCreatedServer ??= server
    ctx.lastCreatedServer = server
    return server
}

export function connectWithContext(ctx: CreationContext, opts: { host?: string, port?: number }): Socket {
    const msg =
    (!ctx.firstCreatedServer) ?
        'A global server must be created before connections can be established.' :
    (ctx.firstCreatedServer !== ctx.lastCreatedServer) ?
        'There should be only one server to create connections via the global method.' :
    ''
    if(msg){
        //console.trace(msg)
        throw new Error(msg)
    }
    return ctx.firstCreatedServer!.connect(opts)
}
