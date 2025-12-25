import { createGossipRpc } from '../../node_modules/@chainsafe/libp2p-gossipsub/src/utils/create-gossip-rpc.ts'
import type { RPC } from '../../node_modules/@chainsafe/libp2p-gossipsub/src/message/rpc.ts'
import type { GossipSub, GossipsubOpts } from "@chainsafe/libp2p-gossipsub"
import type { MsgIdStr } from '@chainsafe/libp2p-gossipsub/types'
import type { ComponentLogger, Logger, PeerId } from "@libp2p/interface"

const GossipsubMaxIHaveLength = 5000

type PeerIdStr = string
type RPCControlIHave = {
    topicID?: string | undefined;
    messageIDs: Uint8Array<ArrayBufferLike>[];
}
type PubSubSendSubscriptions = (toPeer: PeerIdStr, topics: string[], subscribe: boolean) => void
type PubSubHandleReceivedRpc = (from: PeerId, rpc: RPC) => Promise<void>
type PubSubPushGossip = (id: PeerIdStr, controlIHaveMsgs: RPCControlIHave) => void
type PubSubSendRpc = (id: PeerIdStr, rpc: RPC) => boolean
type MessageCache = GossipsubOpts['messageCache']

type PinningServiceComponents = {
    logger: ComponentLogger
    pubsub: GossipSub
}

type PinnedMessage = {
    iwantCounts: Map<string, number>
    msgIdStr: string
    msgId: Uint8Array
    msg: RPC.Message
}

export const pinning = () => (components: PinningServiceComponents) => new PinningService(components)

export class PinningService {
    
    private readonly log: Logger
    private readonly components: PinningServiceComponents
    
    public readonly [Symbol.toStringTag] = '@libp2p/message-pinning'
    
    private readonly pinnedMessages = new Map<MsgIdStr, PinnedMessage>()
    
    constructor(components: PinningServiceComponents){
        this.log = components.logger.forComponent('libp2p:message-pinning')
        this.components = components
        this.monkeyPatch()
    }

    private monkeyPatch(){
        const pubsub = this.components.pubsub

        const pubsub_mcache = pubsub['mcache'] as MessageCache
        const pubsub_mcache_getWithIWantCount = pubsub_mcache.getWithIWantCount.bind(pubsub_mcache)
        pubsub_mcache.getWithIWantCount = (msgIdStr: string, p: string) => {
            
            let msgwiwc = pubsub_mcache_getWithIWantCount(msgIdStr, p)

            if(!msgwiwc){
                const pmsg = this.pinnedMessages.get(msgIdStr)
                if(pmsg){
                    const count = (pmsg.iwantCounts.get(p) ?? 0) + 1
                    pmsg.iwantCounts.set(p, count)
                    msgwiwc = { msg: pmsg.msg, count }
                }
            }
            return msgwiwc
        }

        const pubsub_pushGossip = (pubsub['pushGossip'] as PubSubPushGossip).bind(pubsub)
        const pubsub_sendSubscriptions = (pubsub['sendSubscriptions'] as PubSubSendSubscriptions).bind(pubsub)
        pubsub['sendSubscriptions'] = (peerIdStr: PeerIdStr, topics: string[], subscribe: boolean): void => {
            if(subscribe){
                
                //const msgIdsByTopic = pubsub_mcache.getGossipIDs(new Set(topics))
                const msgIdsByTopic = new Map<string, Uint8Array[]>()

                for(const pmsg of this.pinnedMessages.values()){
                    const { msg, msgId } = pmsg
                    let msgIds = msgIdsByTopic.get(msg.topic)
                    if(!msgIds){
                        msgIds = []
                        msgIdsByTopic.set(msg.topic, msgIds)
                    }
                    msgIds.push(msgId)
                }
                
                for(let [ topicID, messageIDs ] of msgIdsByTopic.entries()){
                    //TODO: messageIDs = messageIDs.slice(0, GossipsubMaxIHaveLength)
                    pubsub_pushGossip(peerIdStr, { topicID, messageIDs })
                }
            }

            pubsub_sendSubscriptions(peerIdStr, topics, subscribe)
        }

        const pubsub_opts_msgIdToStrFn = pubsub['opts']['msgIdToStrFn']
        const pubsub_sendRpc = (pubsub['sendRpc'] as PubSubSendRpc).bind(pubsub)
        const pubsub_handleReceivedRpc = (pubsub['handleReceivedRpc'] as PubSubHandleReceivedRpc).bind(pubsub)
        pubsub['handleReceivedRpc'] = async (from: PeerId, rpc: RPC): Promise<void> => {
            
            pubsub_handleReceivedRpc(from, rpc)

            if((rpc.subscriptions?.length ?? 0) > 0 && (rpc.control?.ihave?.length ?? 0) > 0){
                
                const topics = rpc.subscriptions
                    .filter(sub => sub.subscribe && sub.topic)
                    .map(sub => sub.topic!)
                const temp = rpc.control!.ihave
                    .flatMap(ihave => ihave.messageIDs)
                    .map(msgId => [ pubsub_opts_msgIdToStrFn(msgId), msgId ] as const)
                const seenMsgs = new Map(temp)
                const peerIdStr = from.toString()

                if(topics.length){
                    
                    const messages = [...this.pinnedMessages.values()]
                        .filter(({ msg, msgIdStr }) => {
                            return !seenMsgs.has(msgIdStr) && topics.includes(msg.topic)
                        })
                        .map(pmsg => pmsg.msg)
                    
                    const messageIDs = [...seenMsgs.entries()]
                        .filter(([ msgIdStr, msgId ]) => {
                            return !this.pinnedMessages.has(msgIdStr)
                        })
                        .map(([ msgIdStr, msgId ]) => msgId)

                    const rpc = createGossipRpc(messages, { iwant: [{ messageIDs }] })
                    pubsub_sendRpc(peerIdStr, rpc)
                }
            }
        }
    }

    public pin(msgIdStr: MsgIdStr){
        const mcache = this.components.pubsub!['mcache'] as MessageCache

        const msg = mcache.msgs.get(msgIdStr)!.message
        const msgId = mcache.history[0]!.find(entry => entry.msgIdStr === msgIdStr)!.msgId

        this.pinnedMessages.set(msgIdStr, {
            iwantCounts: new Map(),
            msgIdStr,
            msgId,
            msg,
        })
    }

    public unpin(msgIdStr: MsgIdStr){
        this.pinnedMessages.delete(msgIdStr)
    }
}
