import { AbortError, peerDiscoverySymbol, serviceCapabilities, TypedEventEmitter, type AbortOptions, type ComponentLogger, type ContentRouting, type Logger, type PeerDiscovery, type PeerDiscoveryEvents, type PeerDiscoveryProvider, type Startable } from "@libp2p/interface";
import { CID } from 'multiformats/cid';

interface DiscoveryInit {
    cid: CID
    startupDelay?: number
    lookupInterval?: number
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
    private readonly init: Required<DiscoveryInit>
    private readonly components: DiscoveryComponents
    constructor(init: DiscoveryInit, components: DiscoveryComponents){
        super()
        this.init = {
            startupDelay: 5_000,
            lookupInterval: 60_000,
            ...init
        }
        this.components = components
        this.log = components.logger.forComponent('libp2p:content-discovery')
    }

    private abortController: undefined | AbortController

    beforeStart?(){}
    start(){}
    async afterStart?() {
        if(this.abortController) return

        this.abortController = new AbortController()
        const abortOpts = { signal: this.abortController.signal }
        
        await new Promise(res => setTimeout(res, this.init.startupDelay))
        
        this.log('content discovery started')

        this.components.contentRouting.provide(this.init.cid, abortOpts)
        .then(() => this.log('done announcing self as a provider'))
        .catch(err => {
            if(err.name !== AbortError.name)
                this.log.error('error announcing self as provider - %e', err)
        })

        this.discover(abortOpts).catch(err => {
            if(err.name !== AbortError.name)
                this.log.error('error in content discovery - %e', err)
        })
    }
    async discover(abortOpts: Required<AbortOptions>){
        while(!abortOpts.signal.aborted){
            this.log('providers search started')
            for await (const provider of this.components.contentRouting.findProviders(this.init.cid, abortOpts)){
                this.log('discovered provider %s', provider.id.toString())
                this.safeDispatchEvent('peer', { detail: provider })
            }
            this.log('providers search ended')
            await new Promise(res => setTimeout(res, this.init.lookupInterval))
        }
    }
    beforeStop?(){}
    stop(){
        if(!this.abortController) return
        this.abortController.abort(new AbortError())
        this.abortController = undefined
    }
    afterStop?(){}
}
