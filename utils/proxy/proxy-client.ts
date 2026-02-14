import type { PeerId, AbortOptions } from "@libp2p/interface"
import type { LibP2PNode } from "../../node/node"
import { Proxy } from './proxy'
import { Role } from "./shared"

//import { LOCALHOST } from "./constants"
const LOCALHOST = "127.0.0.1"

import { logger } from "@libp2p/logger"
import type { ProxyServer } from "./proxy-server"
const log = logger('launcher:proxy-client')

export class ProxyClient extends Proxy {
    
    public constructor(node: LibP2PNode){
        super(node, Role.Client)
    }

    private serverId: PeerId | undefined
    public async connect(id: PeerId, proxyServer: ProxyServer | undefined, opts: Required<AbortOptions>) {
        this.serverId = id
        if(id.equals(this.node.peerId) && proxyServer){

            log('connecting to local server peer %p', id)

            const proxyClient = this as ProxyClient
            const serverSidePeer = proxyServer.getPeer(id)!
            const clientSidePeer = await proxyClient.createPeer(id, LOCALHOST, 0, opts)
            clientSidePeer.socketToRemote = serverSidePeer.socketToProgram
            serverSidePeer.socketToRemote = clientSidePeer.socketToProgram

        } else {

            log('connecting to remote server peer %p', id)

            await Promise.all([
                this.strategy.createMainSocketToRemote(opts),
                this.createPeer(id, LOCALHOST, 0, opts),
            ])
        }
    }
    
    public disconnect(){
        
        log('disconnecting from server peer %p', this.serverId)

        this.serverId = undefined
        this.closeSockets()
    }

    public getPort(id = this.serverId){
        console.assert(id && id.equals(this.serverId), 'id && id.equals(this.serverId)')
        return super.getPort(id!)
    }
}
