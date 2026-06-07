import type { LibP2PNode } from "../../node/node"
import type { PeerId, AbortOptions } from "@libp2p/interface"
//import { registerShutdownHandler } from "./data-process"
import type { Peer } from "./peer"

export interface ClosableSocket {
    sourceHostPort: string // Only used for logging.
    targetHostPort: string // Only used for logging.
    //connected: boolean
    //opened: boolean
    close(): void
}

export interface SocketToRemote extends ClosableSocket {
    send(data: Buffer, streamIdx?: number): boolean
}

export interface SocketToProgram extends ClosableSocket {
    send(data: Buffer, streamIdx?: number): boolean
    setPort(port: number): void
    port: number
    peer?: Peer
}

/*
type Closable = { close(): void }
export const openSockets = new Set<Closable>()
registerShutdownHandler(() => {
    for(const socket of openSockets)
        socket.close()
    openSockets.clear()
})
*/

export enum Role {
    Unset = 0,
    Client = 1, Server = 2,
    ClientServer = Client | Server
}

export type RemoteStreamIndex = number & { readonly __brand: unique symbol }
export const DEFAULT_REMOTE_STREAM_INDEX = 0 as RemoteStreamIndex
export type OnDataFromRemote = (data: Buffer, streamIdx: RemoteStreamIndex, remoteHostPort: string) => void
export type OnDataFromProgram = (data: Buffer, streamIdx: RemoteStreamIndex, remoteHostPort: string) => void

export abstract class ConnectionStrategy {
    
    protected readonly role: Role
    protected readonly node: LibP2PNode
    public constructor(node: LibP2PNode, role: Role){
        this.node = node
        this.role = role
    }

    abstract createMainSocketToRemote(opts: Required<AbortOptions>): Promise<void>
    abstract createSocketToRemote(id: PeerId, streamsCount: number, onData: OnDataFromRemote, opts: Required<AbortOptions>): Promise<SocketToRemote>
    abstract closeSockets(): void
}
