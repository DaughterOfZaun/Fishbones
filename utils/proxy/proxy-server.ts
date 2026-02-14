import type { AbortOptions, PeerId } from "@libp2p/interface"
import type { LibP2PNode } from "../../node/node"
import { Proxy } from './proxy'
import { Role } from "./shared"

//import { LOCALHOST } from "./constants"
const LOCALHOST = "127.0.0.1"

import { logger } from "@libp2p/logger"
const log = logger('launcher:proxy-server')

export class ProxyServer extends Proxy {

    public constructor(node: LibP2PNode){
        super(node, Role.Server)
    }

    public async start(programPort: number, peerIds: PeerId[], opts: Required<AbortOptions>) {
        
        log('starting proxy server at %s:%d', LOCALHOST, programPort)

        await Promise.all([
            this.strategy.createMainSocketToRemote(opts),
            // eslint-disable-next-line @typescript-eslint/await-thenable
            peerIds.map(async (id) => this.createPeer(id, LOCALHOST, programPort, opts)),
        ])
    }
    
    public stop(){
        log('stopping proxy server')
        this.closeSockets()
    }
}
