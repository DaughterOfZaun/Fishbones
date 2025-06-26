import { AbortError, peerDiscoverySymbol, serviceCapabilities, TypedEventEmitter, type ComponentLogger, type ContentRouting, type Logger, type PeerDiscovery, type PeerDiscoveryEvents, type PeerDiscoveryProvider, type Startable } from "@libp2p/interface";
import { CID } from 'multiformats/cid';

interface DiscoveryInit {
    cid: CID
}
interface DiscoveryComponents {
    contentRouting: ContentRouting
    logger: ComponentLogger
}

export function contentPeerDiscovery(init: DiscoveryInit): (components: DiscoveryComponents) => DiscoveryClass {
    return (components: DiscoveryComponents) => new DiscoveryClass(init, components)
}

class DiscoveryClass extends TypedEventEmitter<PeerDiscoveryEvents> implements PeerDiscovery, PeerDiscoveryProvider, Startable {
    
    public readonly [peerDiscoverySymbol] = this
    public readonly [Symbol.toStringTag] = '@libp2p/content-discovery'
    public readonly [serviceCapabilities]: string[] = [
        '@libp2p/peer-discovery'
    ]

    private readonly log: Logger
    private readonly init: DiscoveryInit
    private readonly components: DiscoveryComponents
    constructor(init: DiscoveryInit, components: DiscoveryComponents){
        super()
        this.init = init
        this.components = components
        this.log = components.logger.forComponent('libp2p:content-discovery')
    }

    private abortController?: AbortController

    beforeStart?(): void | Promise<void> {}
    start(): void | Promise<void> {}
    afterStart?(): void | Promise<void> {
        if(this.abortController) return
        this.discover().catch(err => {
            if(err.name !== AbortError.name)
                this.log.error('error in content discovery - %e', err)
        })
    }
    async discover(){
        this.log('content discovery started')
        
        this.abortController = new AbortController()
        const abortOpts = { signal: this.abortController.signal }

        await new Promise(res => setTimeout(res, 60_000))

        await this.components.contentRouting.provide(this.init.cid, abortOpts)
            .then(() => this.log('done announcing self as a provider'))
            .catch(err => this.log.error('error announcing self as provider - %e', err))
        
        while(!this.abortController.signal.aborted){
            this.log('providers search started')
            for await (const provider of this.components.contentRouting.findProviders(this.init.cid, abortOpts)){
                this.log('discovered provider %s', provider.id.toString())
                this.safeDispatchEvent('peer', { detail: provider })
            }
            this.log('providers search ended')
            await new Promise(res => setTimeout(res, 10_000))
        }
    }
    beforeStop?(): void | Promise<void> {}
    stop(): void | Promise<void> {
        if(!this.abortController) return
        this.abortController.abort(new AbortError())
    }
    afterStop?(): void | Promise<void> {}
}
