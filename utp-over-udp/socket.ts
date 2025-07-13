import { UTPAddress } from '../utp-native/address'
import { UTPShutdown } from '../utp-native/enums'
import type { UTPSocket } from '../utp-native/socket'
import { pushable } from 'it-pushable'
import { TypedEventEmitter } from './emitter'
import type { Duplex, Source } from 'it-stream-types'

export type UTPSocketExt = UTPSocket & {
    wrapper?: Socket
}

type SocketEvents = {
    error: [Error],
    close: [boolean],
    end: [],
    timeout: [],
    connect: [],

    drain: [],
}

export class Socket extends TypedEventEmitter<SocketEvents> implements Duplex<AsyncGenerator<Uint8Array>, Source<Uint8Array>, Promise<void>> {

    public closed: boolean = false
    public destroyed: boolean = false
    public readable: boolean = false
    
    public readonly writableLength: number = 0
    
    public readonly remoteAddress: string
    public readonly remotePort: number

    constructor(
        private readonly wrapped: UTPSocket,
        address: UTPAddress
    ){
        super()
        //this.wrapped = wrapped
        this.remoteAddress = address.host
        this.remotePort = address.port
    }
    
    source = pushable<Uint8Array>()
    sink = async (source: Source<Uint8Array>) => {
        for await(const data of source){
            this.wrapped.write(data)
        }
    }
    
    setTimeout(inactivityTimeout: number) {
        if(isFinite(inactivityTimeout))
            throw new Error('Method not implemented.')
    }

    end() {
        //TODO: Finish sink.
        this.wrapped.shutdown(UTPShutdown.SHUT_WR)
    }

    destroy(err?: Error) {
        //TODO: Finish sink.
        this.source.end(err)
        this.wrapped.close()
        this.emit('close', err !== undefined)
    }
}
