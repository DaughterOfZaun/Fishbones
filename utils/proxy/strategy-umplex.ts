import type { PeerId, AbortOptions } from "@libp2p/interface"
import { logger } from "@libp2p/logger"
import { isENet, type BunSocket } from "../network/umplex"
import * as uMplex from '../network/umplex'
import { UTPMatcher } from "../network/tcp"
import { ConnectionStrategy, type AnySocket } from "./data-proxy-shared"

const log = logger('launcher:proxy')

type HostPortStr = string

export class ShareSocketWithExistingUTPConnection extends ConnectionStrategy {
    
    protected mainSocketToRemote: BunSocket | undefined
    protected readonly socketsByRemoteHostPort = new Map<HostPortStr, AnySocket & {
        onData(data: Buffer, remotePort: number, remoteHost: string): void
    }>()

    private getRemoteHostPorts(id: PeerId): HostPortStr[] {

        let remoteHostPorts = this.node.getConnections(id)
            .filter(connection => UTPMatcher.exactMatch(connection.remoteAddr))
            .map(connection => {
                const { host, port } = connection.remoteAddr.toOptions()
                return `${host}:${port}`
            })
        remoteHostPorts = new Set(remoteHostPorts).values().toArray()
        remoteHostPorts = remoteHostPorts.sort()

        log('hostports for peer %p are', id, remoteHostPorts)
        
        return remoteHostPorts
    }

    public async createMainSocketToRemote(opts: Required<AbortOptions>){

        log('creating external socket')

        const socket = await uMplex.udpSocket({
            binaryType: 'buffer',
            socket: {
                filter: isENet,
                data: (_, data, remotePort, remoteHost) => {
                    const remoteHostPort = `${remoteHost}:${remotePort}`
                    const socket = this.socketsByRemoteHostPort.get(remoteHostPort)
                    if(!socket){
                        log.error('external socket: ignoring pkt from unknown addr %s:%d', remoteHost, remotePort)
                    } else {
                        socket.onData(data, remotePort, remoteHost)
                    }
                },
            }
        })
    
        log('created external socket at %s:%d', socket.hostname, socket.port)
        this.mainSocketToRemote = socket
        //openSockets.add(socket)

        opts.signal.throwIfAborted()
    }

    // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
    public async createSocketToRemote(id: PeerId, onData: (data: Buffer, remoteHostPort: string) => void, opts: Required<AbortOptions>): Promise<AnySocket> {
        
        let remoteHostLastUsed = '',
            remotePortLastUsed = 0,
            remoteHostPorts: HostPortStr[] = []
        
        console.assert(!this.node.peerId.equals(id), '!this.node.peerId.equals(id)')

        remoteHostPorts = this.getRemoteHostPorts(id)
        if(!remoteHostPorts.length){
            log('peer %p is not connected.', id)
        } else {
            //remoteHost = remoteHostPorts[0]!.host
            //remotePort = remoteHostPorts[0]!.port
            const remoteHostPort = remoteHostPorts[0]!
            const index = remoteHostPort.lastIndexOf(':')
            remotePortLastUsed = parseInt(remoteHostPort.slice(index + 1))
            remoteHostLastUsed = remoteHostPort.slice(0, index)
        }

        const main = () => this.mainSocketToRemote!
        const socket = {
            close(): void { /* Ignore */ },
            get opened(){ return !main().closed },
            get sourceHostPort(){ return `${main().hostname}:${main().port}` },
            get targetHostPort(){ return `${remoteHostLastUsed}:${remotePortLastUsed}` },
            get connected(){ return !!(remoteHostLastUsed && remotePortLastUsed) },
            send(data: Buffer): boolean {
                return main().send(data, remotePortLastUsed, remoteHostLastUsed)
            },
            onData(data: Buffer, remotePort: number, remoteHost: string){
                const remoteHostPort = `${remoteHost}:${remotePort}`
                remoteHostLastUsed = remoteHost
                remotePortLastUsed = remotePort
                onData(data, remoteHostPort)
            },
        }

        for(const remoteHostPort of remoteHostPorts)
            this.socketsByRemoteHostPort.set(remoteHostPort, socket)

        return socket
    }

    public closeSockets(){
        if(this.mainSocketToRemote){
            log('closing socket at %s:%d', this.mainSocketToRemote.hostname, this.mainSocketToRemote.port)
            //openSockets.delete(this.mainSocketToRemote)
            this.mainSocketToRemote.close()
            this.mainSocketToRemote = undefined
        }
        this.socketsByRemoteHostPort.clear()
    }
}
