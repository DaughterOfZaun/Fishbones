import { AbortError, peerDiscoverySymbol, serviceCapabilities, TypedEventEmitter, type AbortOptions, type ComponentLogger, type ContentRouting, type Logger, type PeerDiscovery, type PeerDiscoveryEvents, type PeerDiscoveryProvider, type Startable } from "@libp2p/interface";
import { CID } from 'multiformats/cid';
import { sleep } from "../../../utils/helpers";
import type { DHTProgressEvents } from "@libp2p/kad-dht";

const MIN_PEERS_TO_PROVIDE_TO = 1

class DiscoveryInit {
    cid!: CID
    startupDelay?: number = 5_000
    retryInterval?: number = 60_000
    lookupInterval?: number = 60_000
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
        this.log = components.logger.forComponent('libp2p:content-discovery')
        this.init = Object.assign(new DiscoveryInit(), init as Required<DiscoveryInit>)
        this.components = components
    }

    private abortController: undefined | AbortController
    start(){
        if(this.abortController) return

        this.abortController = new AbortController()
        const opts = { signal: this.abortController.signal }
        
        sleep(this.init.startupDelay, opts).then(() => {
            this.providerLoop(opts).catch((err: Error) => {
                if(!opts.signal.aborted)
                    this.log.error('provider loop exited - %e', err)
            })
            this.discoverLoop(opts).catch((err: Error) => {
                if(!opts.signal.aborted)
                    this.log.error('discover loop exited - %e', err)
            })
        }, (err: Error) => {
            if(!opts.signal.aborted)
                this.log.error('startup delay failed - %e', err)
        })
    }

    stop(){
        if(!this.abortController) return
        this.abortController.abort(new AbortError())
        this.abortController = undefined
    }
    
    private async providerLoop(opts: Required<AbortOptions>){
        while(!opts.signal.aborted){
            try {
            
                let sent = 0
                await this.components.contentRouting.provide(this.init.cid, {
                    ...opts,
                    onProgress(evt: DHTProgressEvents){
                        if(evt.detail.name == 'PEER_RESPONSE')
                            sent++
                    },
                })
                this.log('sent provider records to %d peers', sent)
                if(sent >= MIN_PEERS_TO_PROVIDE_TO)
                    break
            
            } catch(err) {
                opts.signal.throwIfAborted()
                this.log.error('error announcing self as provider - %e', err)
            }
            await sleep(this.init.retryInterval, opts)
        }
    }

    private async discoverLoop(opts: Required<AbortOptions>){
        while(!opts.signal.aborted){
            try {
            
                this.log('providers search started')
                for await (const provider of this.components.contentRouting.findProviders(this.init.cid, opts)){
                    this.log('discovered provider %s', provider.id.toString())
                    this.safeDispatchEvent('peer', { detail: provider })
                }
                this.log('providers search ended')

            } catch(err){
                opts.signal.throwIfAborted()
                this.log.error('failed to find providers - %e', err)
            }
            await sleep(this.init.lookupInterval, opts)
        }
    }
}
