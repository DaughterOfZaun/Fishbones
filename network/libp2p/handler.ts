import type { ComponentLogger, Connection, Logger, Startable, Stream, StreamHandler } from "@libp2p/interface"
import type { Registrar } from "@libp2p/interface-internal"

interface HandlerComponents {
    registrar: Registrar
    logger: ComponentLogger
}

interface HandlerOptions {
    protocols: string[]
}

export type { HandlerService }
export function handler(options: HandlerOptions){
  return (components: HandlerComponents) => new HandlerService(components, options)
}

// A service that registers protocols in advance and makes handle/unhandle operations synchronous.
class HandlerService implements Startable {
    
    private readonly log: Logger

    constructor(
        private readonly components: HandlerComponents,
        private readonly options: HandlerOptions,
    ){
        this.log = components.logger.forComponent('libp2p:protocol-handler')
    }

    public async start(){
        for(const protocol of this.options.protocols)
            await this.components.registrar.handle(protocol, (stream: Stream, connection: Connection) => {
                const handler = this.handlers.get(protocol) ?? this.defaultHandler
                return handler(stream, connection)
            })
    }
    
    public async stop() {
        for(const protocol of this.options.protocols)
            await this.components.registrar.unhandle(protocol)
    }

    private defaultHandler = async (stream: Stream, _connection: Connection) => {
        return stream.close().catch(err => this.log.error(err))
    }

    private readonly handlers = new Map<string, StreamHandler>()
    public handle(protocol: string, handler: StreamHandler){
        this.handlers.set(protocol, handler)
    }
    public unhandle(protocol: string){
        this.handlers.delete(protocol)
    }
}
