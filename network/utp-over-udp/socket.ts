import { UTPAddress } from '../utp-native/address'
//import { UTPShutdown } from '../utp-native/enums'
import type { UTPSocket } from '../utp-native/socket'
import { pushable } from 'it-pushable'
import { EventEmitter as TypedEventEmitter } from 'node:events'
import type { Duplex, Source } from 'it-stream-types'
import { UTP_ERROR_NAMES, UTPError, UTPState } from '../utp-native/enums'

export type UTPSocketExt = UTPSocket & {
    wrapper?: Socket
}

interface SocketEvents {
    error: [Error],
    close: [boolean],
    end: [],
    timeout: [], //TODO: Implement.
    connect: [],
    drain: [],
}

export class Socket extends TypedEventEmitter<SocketEvents> implements Duplex<AsyncGenerator<Uint8Array>, Source<Uint8Array>, Promise<void>> {

    public destroyed: boolean = false
    public readable: boolean = false
    public closed: boolean = false
    
    public readonly writableLength: number = 0 //TODO: Implement.
    
    public readonly remoteAddress: string
    public readonly remotePort: number
    
    public constructor(
        private readonly wrapped: UTPSocket,
        address: UTPAddress
    ){
        super()
        //this.wrapped = wrapped
        this.remoteAddress = address.host
        this.remotePort = address.port
    }
    
    public source = pushable<Uint8Array>({
        objectMode: false,
        onEnd: (/*err*/) => {
            this.wrapped.read_drained()
        },
    })
    _read(buf: Uint8Array){
        this.source.push(buf)
    }

    public sink = async (source: Source<Uint8Array>) => {
        if(this.destroyed) return
        
        for await(const data of source){
            this.wrapped.write(data)
        }
    }
    
    public setTimeout(inactivityTimeout: number) {
        if(this.destroyed) return

        if(isFinite(inactivityTimeout))
            throw new Error('Method not implemented.')
    }

    _state_change(state: UTPState){
        switch(state){
            case UTPState.CONNECT:
                this.readable = true
                this.emit('connect')
            break
            case UTPState.WRITABLE:
                this.emit('drain')
            break
            case UTPState.EOF:
                this.readable = false
                this.emit('end')
                this.end()
            break
            case UTPState.DESTROYING:
                //TODO: Free UTPSocket & wrapper.
                /*
                if(!this.destroyed){
                    this.destroyed = true
                    this.readable = false
                    this.closed = true
                    this.emit('close' , false)
                }
                */
            break
        }
    }

    _error(err: UTPError){
        this.destroyed = true
        this.readable = false
        this.closed = true
        this.emit('error', new Error(UTP_ERROR_NAMES[err]))
        //TODO: Call utp_close if conn->state == CS_RESET
        this.emit('close' , true)
    }

    public end() {
        //if(this.destroyed) return
        //TODO: Finish sink.
        //this.wrapped.shutdown(UTPShutdown.SHUT_WR)

        this.destroy()
    }
    
    public destroy(err?: Error) {
        if(this.destroyed) return
        this.destroyed = true
        this.readable = false
        this.closed = true

        //TODO: Finish sink.
        this.source.end(err)
        this.wrapped.close()
        this.emit('close', !!err)
    }
}
