import UTP from '../utp-native'
import { UTPError, UTPOptions, UTPState } from '../utp-native/enums'
import { determineAddressFamily, UTPAddress } from "../utp-native/address"
import { TypedEventEmitter } from "./emitter"
import { Socket, type UTPSocketExt } from "./socket"
import type { UTPContext } from '../utp-native/context'

type ServerEvents = {
    listening: [],
    connection: [Socket],
    error: [Error],

    close: [],
    drop: [],
}

export class Server extends TypedEventEmitter<ServerEvents> {
    
    listening!: boolean
    maxConnections: number = Infinity
    
    udp!: Bun.udp.Socket<'buffer'>
    ctx!: UTPContext
    int!: ReturnType<typeof setInterval>

    address() {
        return { address: this.udp!.hostname, port: this.udp!.port }
    }
    
    async listen(opts: { host?: string, port?: number }, onListening?: () => void) {

        //if(onListening) this.once('listening', onListening.bind(this))

        this.udp = await Bun.udpSocket({
            binaryType: 'buffer',
            hostname: opts.host,
            port: opts.port,
            socket: {
                data: (socket, data, port, address) => {
                    //console.log('udp socket', 'data')
                    this.ctx.process_udp(data, new UTPAddress(determineAddressFamily(address), address, port))
                    this.ctx.issue_deferred_acks() //TODO:
                },
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                drain: (socket) => {
                    //console.log('udp socket', 'drain')
                },
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                error: (socket, error) => {
                    //console.log('udp socket', 'error', error)
                },
            }
        })
        
        this.ctx = UTP.init(2, {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            firewall: (address) => 0,
            accept: (socket: UTPSocketExt, address) => {
                const wrapper = socket.wrapper = new Socket(socket, address)
                this.emit('connection', wrapper)
            },
            read: (socket: UTPSocketExt, buf) => {
                socket.wrapper?.source.push(buf)
                socket.read_drained()
            },
            state_change: (socket: UTPSocketExt, state) => {
                if(state === UTPState.CONNECT)
                    socket.wrapper?.emit('connect')
                if(state === UTPState.EOF)
                    socket.wrapper?.emit('end')
            },
            error: (socket: UTPSocketExt, err) => {
                let msg = 'UNKNOWN'
                if(err == UTPError.CONNREFUSED) msg = 'CONNREFUSED'
                if(err == UTPError.CONNRESET) msg = 'CONNRESET'
                if(err == UTPError.TIMEDOUT) msg = 'TIMEDOUT'
                socket.wrapper?.emit('error', new Error(msg))
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

        this.listening = true
        if(onListening) onListening.call(this)
        this.emit('listening')
    }

    close() {
        //throw new Error('Method not implemented.')
    }
}
