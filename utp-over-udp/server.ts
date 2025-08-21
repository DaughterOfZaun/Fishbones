import UTP from '../utp-native'
import { UTPOptions } from '../utp-native/enums'
import { determineAddressFamily, UTPAddress } from "../utp-native/address"
import { EventEmitter as TypedEventEmitter } from 'node:events'
import { Socket, type UTPSocketExt } from "./socket"
import type { UTPContext } from '../utp-native/context'
import { isUTP, udpSocket } from '../network/umplex'

type ServerEvents = {
    listening: [],
    connection: [Socket],
    error: [Error],

    close: [],
    drop: [],
}

type HostPort = { host: string, port: number }

export class Server extends TypedEventEmitter<ServerEvents> {
    
    public listening: boolean = false
    public maxConnections: number = Infinity
    
    private udp!: Bun.udp.Socket<'buffer'>
    private ctx!: UTPContext
    private int!: ReturnType<typeof setInterval>
    
    public address() {
        return { address: this.udp.hostname, port: this.udp.port }
    }
    
    private listeningRequested: boolean = false
    public async listen(options: Partial<HostPort>, onListening?: () => void) {

        if(this.listening || this.listeningRequested){
            //TODO: Reverse engineer proper error.
            //throw new Error('ERR_SERVER_ALREADY_LISTEN')
            this.emit('error', new Error('ERR_SERVER_ALREADY_LISTEN'))
        }
        this.listeningRequested = true

        //if(onListening) this.once('listening', onListening.bind(this))

        try {
            await this._listen(options)
        } finally {
            this.listeningRequested = false
        }

        this.listening = true
        if(onListening) onListening.call(this)
        this.emit('listening')
    }

    private async _listen({ host: hostname, port }: Partial<HostPort>){

        this.udp = await udpSocket({
            binaryType: 'buffer',
            ...(hostname ? { hostname } : {}),
            ...(port ? { port } : {}),
            socket: {
                filter: isUTP,
                data: (socket, data, port, address) => {
                    //console.log('udp socket', 'data')
                    this.ctx.process_udp(data, new UTPAddress(determineAddressFamily(address), address, port))
                    this.ctx.issue_deferred_acks() //TODO:
                },
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                drain: (socket) => {
                    //console.log('udp socket', 'drain')
                    //TODO: Handle pressure.
                },
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                error: (socket, error) => {
                    //console.log('udp socket', 'error', error)
                    //TODO: Handle errors.
                },
            }
        })
        
        this.ctx = UTP.init(2, {
            accept: (socket: UTPSocketExt, address) => {
                const wrapper = socket.wrapper = new Socket(socket, address)
                this.emit('connection', wrapper)
            },
            read: (socket: UTPSocketExt, buf) => {
                socket.wrapper?._read(buf)
            },
            state_change: (socket: UTPSocketExt, state) => {
                socket.wrapper?._state_change(state)
            },
            error: (socket: UTPSocketExt, err) => {
                socket.wrapper?._error(err)
            },
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            send: (socket: UTPSocketExt, buf, address, flags) => {
                //console.log('send', address.host, address.port, buf)
                this.udp.send(buf, address.port, address.host)
            },
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            log: (socket: UTPSocketExt, buf) => {
                //TODO: console.log('log', buf)
            },
        })

        this.ctx.set_option(UTPOptions.LOG_NORMAL, 1)
		this.ctx.set_option(UTPOptions.LOG_MTU,    1)
		this.ctx.set_option(UTPOptions.LOG_DEBUG,  1)

        this.int = setInterval(() => this.ctx.check_timeouts(), 500)
    }

    public close() {
        if(!this.listening) return
        this.listening = false

        clearInterval(this.int)
        this.ctx.destroy()
        this.udp.close()

        this.emit('close')
    }

    public connect({ host, port }: Partial<HostPort>): Socket {
        if(!host || !port) throw new Error('!host || !port')
    
        const socket = this.ctx.create_socket() as UTPSocketExt
        const address = new UTPAddress(determineAddressFamily(host), host, port)
        const wrapper = socket.wrapper = new Socket(socket, address)
        socket.connect(address)
    
        return wrapper
    }
}
