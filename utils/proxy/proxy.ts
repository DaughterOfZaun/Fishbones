import type { LibP2PNode } from "../../node/node"
import type { PeerId, AbortOptions } from "@libp2p/interface"
import { UseExistingLibP2PConnection } from "./strategy-libp2p"
import { Role, type AnySocket } from "./shared"
import { Peer } from "./peer"

//import { LOCALHOST } from "./constants"
const LOCALHOST = "127.0.0.1"

import { logger } from "@libp2p/logger"
const log = logger('launcher:proxy')

//import { logger as ourLogger } from "../log"
//const ourLog = () => ourLogger.log.bind(logger, 'PROXY')
//const ourLog = (...args: Parameters<typeof console['log']>) => console.log(...args)
//const formatPeer = (peer: { peerId: PeerId }) => peer.peerId.toString().slice(-8)
//const formatData = (data: Buffer) => `${Bun.hash(data).toString(36)} (${data.length})`

type PeerIdStr = string

export interface PeerData {
    peerId: PeerId,
    socketToRemote: AnySocket,
    socketToProgram: SocketToProgram,
    peerToProgram?: Peer,
}

export type SocketToProgram = AnySocket & {
    setPort(port: number): void
    port: number
}

export class Proxy {
    
    public dataTransmitted: number = 0

    protected readonly strategy: UseExistingLibP2PConnection
    protected readonly peersByPeerId = new Map<PeerIdStr, PeerData>()

    protected readonly role: Role
    protected readonly node: LibP2PNode
    protected constructor(node: LibP2PNode, role: Role){
        this.strategy = new UseExistingLibP2PConnection(node, role)
        this.node = node
        this.role = role
    }

    public getPeer(id: PeerId){
        return this.peersByPeerId.get(id.toString())
    }

    public getPort(id: PeerId){
        return this.getPeer(id)?.socketToProgram.port
    }

    protected async createPeer(id: PeerId, programHost: string, programPort: number, opts: Required<AbortOptions>){
        
        log('creating internal socket for peer %p', id)

        const peer: PeerData = {
            peerId: id,
            socketToRemote: this.node.peerId.equals(id) ? undefined! : await this.strategy.createSocketToRemote(id, (data: Buffer, remoteHostPort: string) => {
                log.trace('external socket: redirecting pkt from %s through %s to %s', remoteHostPort, peer.socketToProgram.sourceHostPort, peer.socketToProgram.targetHostPort)
                peer.socketToProgram.send(data)
            }, opts),
            socketToProgram: await this.createSocketToProgram(programHost, programPort, (data: Buffer, programHostPort: string) => {
                log.trace('internal socket: redirecting pkt from %s through %s to %s', programHostPort, peer.socketToRemote.sourceHostPort, peer.socketToRemote.targetHostPort)
                this.dataTransmitted += data.length
                peer.socketToRemote.send(data)
            }, opts)
        }
        //openSockets.add(peer.socketToProgram)

        log('created internal socket for peer %p at %s', peer.peerId, peer.socketToProgram.sourceHostPort)

        this.peersByPeerId.set(peer.peerId.toString(), peer)

        opts.signal.throwIfAborted()
        
        return peer
    }

    protected async createSocketToProgram(programHost: string, programPort: number, onData: (data: Buffer, programHostPort: string) => void, opts: Required<AbortOptions>): Promise<SocketToProgram> {
        let programHostLastUsed: string = programHost
        let programPortLastUsed: number = programPort
        const socket = await Bun.udpSocket({
            hostname: LOCALHOST,
            socket: {
                data: (_, data, programPort, programHost) => {
                    if(!programPortLastUsed || !programPortLastUsed){
                        log('internal socket: setting internal addr to %s:%d', programHost, programPort)
                    } else if(programHostLastUsed !== programHost || programPortLastUsed !== programPort){
                        log.error('internal socket: got pkt from unexpected addr %s:%d', programHost, programPort)
                    }
                    const programHostPort = `${programHost}:${programPort}`
                    programHostLastUsed = programHost
                    programPortLastUsed = programPort
                    onData(data, programHostPort)
                },
            }
        })
        
        opts.signal.throwIfAborted()

        return {
            close(): void { socket.close() },
            get port(){ return socket.port },
            //get opened(){ return !socket.closed },
            get sourceHostPort(){ return `${socket.hostname}:${socket.port}` },
            get targetHostPort(){ return `${programHostLastUsed}:${programPortLastUsed}` },
            //get connected(){ return !!(programHostLastUsed && programPortLastUsed) },
            setPort(port: number){ programPortLastUsed = port },
            send(data: Buffer): boolean {
                if(socket.closed){
                    log.error('attempting to send data through a closed socket')
                    return false
                }
                return socket.send(data, programPortLastUsed, programHostLastUsed)
            },
        }
    }

    protected closeSockets(){
        this.strategy.closeSockets()
        for(const peer of this.peersByPeerId.values()){
            log('closing socket for peer %p at %s', peer.peerId, peer.socketToProgram.sourceHostPort)
            //openSockets.delete(peer.socketToProgram)
            peer.socketToProgram.close()
        }
        this.peersByPeerId.clear()
    }
}
