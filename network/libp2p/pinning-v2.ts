import type { ComponentLogger } from '@libp2p/interface'
import type { GossipSub } from '@chainsafe/libp2p-gossipsub'
import type { MsgIdStr, PeerIdStr } from '@chainsafe/libp2p-gossipsub/types'
import * as constants from '../../node_modules/@chainsafe/libp2p-gossipsub/src/constants.ts'
import { MessageCache as MessageCacheClass, type CacheEntry } from '../../node_modules/@chainsafe/libp2p-gossipsub/src/message-cache.ts'
import { messageIdToString } from '../../node_modules/@chainsafe/libp2p-gossipsub/src/utils/messageIdToString.ts'

import type { GossipsubOpts } from '@chainsafe/libp2p-gossipsub'
export type MessageCache = GossipsubOpts['messageCache']

import type { RPC } from '@chainsafe/libp2p-gossipsub/message' 
type PubSubSendRpc = (id: PeerIdStr, rpc: RPC) => boolean

export class PinningMessageCache extends MessageCacheClass {

    private readonly pinnedMessages = new Set<MsgIdStr>()

    constructor(){
        super(
            constants.GossipsubHistoryGossip,
            constants.GossipsubHistoryLength,
            messageIdToString,
        )
    }

    public pin(msgIdStr: MsgIdStr): void {
        this.pinnedMessages.add(msgIdStr)
    }

    public unpin(msgIdStr: MsgIdStr): void {
        this.pinnedMessages.delete(msgIdStr)
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

    public getGossipIDs(topics: Set<string>): Map<string, Uint8Array[]> {
        const r = super.getGossipIDs(topics)
        //console.log('getGossipIDs', [...topics], [...r.keys()])
        return r
    }

    public getWithIWantCount(msgIdStr: string, p: string){
        const r = super.getWithIWantCount(msgIdStr, p)
        //console.log('getWithIWantCount', msgIdStr, p, r)
        return r
    }
}

export const pinning = (init: PinningServiceInit) => (components: PinningServiceComponents) => new PinningService(init, components)

export interface PinningServiceComponents {
    logger: ComponentLogger
    pubsub: GossipSub
}

export interface PinningServiceInit {
    messageCache: PinningMessageCache
}

export type { PinningService }
class PinningService {
    constructor(
        private readonly init: PinningServiceInit,
        private readonly components: PinningServiceComponents,
    ){
        const pubsub = this.components.pubsub
        //const pubsub_sendRpc = (pubsub['sendRpc'] as PubSubSendRpc).bind(pubsub)
        //pubsub['sendRpc'] = ((id, rpc) => {
        //   console.log('sendRPC', id, rpc)
        //   return pubsub_sendRpc(id, rpc)
        //}) as PubSubSendRpc

        const mkpatch = (obj: any, key: any) => {
            const orig = obj[key].bind(obj)
            obj[key] = (...args: any) => {
                console.log(key, ...args)
                return orig(...args)
            }
        }

        //mkpatch(pubsub, 'doEmitGossip')
    }

    public pin(msgIdStr: MsgIdStr){
        this.init.messageCache.pin(msgIdStr)
    }
    public unpin(msgIdStr: MsgIdStr){
        this.init.messageCache.unpin(msgIdStr)
    }
}
