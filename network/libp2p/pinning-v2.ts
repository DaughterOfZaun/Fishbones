import type { Startable } from '@libp2p/interface'
import type { MsgIdStr, MsgIdToStrFn, PeerIdStr, TopicStr } from '@libp2p/gossipsub/types'
import type { GossipSub, GossipSubComponents, GossipsubOpts, SubscriptionChangeData } from '@libp2p/gossipsub'

import * as constants from '../../node_modules/@libp2p/gossipsub/src/constants.ts'
import { GossipSub as GossipSubClass } from '../../node_modules/@libp2p/gossipsub/src/gossipsub.ts'
import { MessageCache as MessageCacheClass } from '../../node_modules/@libp2p/gossipsub/src/message-cache.ts'
import { messageIdToString } from '../../node_modules/@libp2p/gossipsub/src/utils/messageIdToString.ts'

export function gossipsub (init: Partial<Omit<GossipsubOpts, 'messageCache'>> = {}){
  return (components: GossipSubComponents) => new PinningGossipSub(components, init) as GossipSub
}

export class PinningGossipSub extends GossipSubClass implements Startable {
    
    private readonly pinnedMessages: Set<MsgIdStr>
    public pin(msgIdStr: MsgIdStr){ this.pinnedMessages.add(msgIdStr) }
    public unpin(msgIdStr: MsgIdStr){ this.pinnedMessages.delete(msgIdStr) }

    //private readonly messageCache: PinningMessageCache

    private readonly topicsToGossipByPeer = new Map<PeerIdStr, Set<TopicStr>>()

    constructor(components: GossipSubComponents, options?: Partial<Omit<GossipsubOpts, 'messageCache'>>){
        const pinnedMessages = new Set<MsgIdStr>()
        const messageCache = new PinningMessageCache(
            options?.mcacheGossip ?? constants.GossipsubHistoryGossip,
            options?.mcacheLength ?? constants.GossipsubHistoryLength,
            options?.msgIdToStrFn ?? messageIdToString,
            pinnedMessages,
        )
        super(components, Object.assign(options ?? {}, {
            messageCache,
        }))
        this.pinnedMessages = pinnedMessages
        //this.messageCache = messageCache
        this.patch()
    }

    async start(){
        await super.start()
        this.addEventListener('subscription-change', this.onSubscriptionChange)
        this.addEventListener('gossipsub:heartbeat', this.onAfterHeartbeat)
    }

    async stop(){
        await super.stop()
        this.removeEventListener('subscription-change', this.onSubscriptionChange)
        this.removeEventListener('gossipsub:heartbeat', this.onAfterHeartbeat)
    }

    private onSubscriptionChange = (event: CustomEvent<SubscriptionChangeData>) => {
        const { peerId, subscriptions } = event.detail
        const topics = subscriptions.filter(sub => sub.subscribe).map(sub => sub.topic)
        if(topics.length === 0) return

        const topicsToGossip = this.topicsToGossipByPeer.getOrInsert(peerId.toString(), new Set())
        for(const topic of topics)
            topicsToGossip.add(topic)
    }

    private patch(){
        const super_emitGossip = this['emitGossip'].bind(this)
        this['emitGossip'] = (peersToGossipByTopic: Map<string, Set<string>>) => {
            for(const [id, topics] of this.topicsToGossipByPeer){
                for(const topic of topics){
                    const peersToGossip = peersToGossipByTopic.getOrInsert(topic, new Set())
                    peersToGossip.add(id)
                }
            }
            return super_emitGossip(peersToGossipByTopic)
        }
    }

    private onAfterHeartbeat = () => {
        this.topicsToGossipByPeer.clear()
    }
}

export class PinningMessageCache extends MessageCacheClass {

    private readonly pinnedMessages: Set<MsgIdStr>

    constructor(
        gossip: number,
        historyCapacity: number,
        msgIdToStrFn: MsgIdToStrFn,
        pinnedMessages: Set<MsgIdStr>,
    ){
        super(gossip, historyCapacity, msgIdToStrFn)
        this.pinnedMessages = pinnedMessages
    }

    public shift(): void {
        const i = this['gossip'] - 1
        const preserved = this.history[i]!
            .filter(entry => this.pinnedMessages.has(entry.msgIdStr))
        this.history[i] = this.history[i]!
            .filter(entry => !this.pinnedMessages.has(entry.msgIdStr))
        super.shift()
        this.history[i]!.push(...preserved)
    }
}

export const pinning = (opts: PinningServiceOpts = {}) => {
    return (components: PinningServiceComponents) => {
        return new PinningService(components, opts)
    }
}

export interface PinningServiceComponents {
    pubsub: GossipSub
}

export interface PinningServiceOpts {}

export type { PinningService }
class PinningService {

    constructor(
        private readonly components: PinningServiceComponents,
        private readonly options: PinningServiceOpts,
    ){}

    public pin(msgIdStr: MsgIdStr){
        (this.components.pubsub as PinningGossipSub).pin(msgIdStr)
    }
    public unpin(msgIdStr: MsgIdStr){
        (this.components.pubsub as PinningGossipSub).unpin(msgIdStr)
    }
}
