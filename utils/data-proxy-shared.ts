import type { Libp2p } from "libp2p"
import type { PeerId, AbortOptions } from "@libp2p/interface"
//import { registerShutdownHandler } from "./data-process"

export type AnySocket = {
    sourceHostPort: string // Only used for logging.
    targetHostPort: string // Only used for logging.
    connected: boolean
    send(data: Buffer): boolean
    opened: boolean
    close(): void
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
export enum Role { Server, Client }
export abstract class ConnectionStrategy {
    
    protected readonly role: Role
    protected readonly node: Libp2p
    public constructor(node: Libp2p, role: Role){
        this.node = node
        this.role = role
    }

    abstract createMainSocketToRemote(opts: Required<AbortOptions>): Promise<void>
    abstract createSocketToRemote(id: PeerId, onData: (data: Buffer, remoteHostPort: string) => void, opts: Required<AbortOptions>): Promise<AnySocket>
    abstract closeSockets(): void
}
