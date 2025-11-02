import type { GossipSub, GossipsubOpts } from "@chainsafe/libp2p-gossipsub"
import type { PubSubPeerDiscovery } from "../network/libp2p/discovery/pubsub-discovery"
//import { console_log } from "./ui/remote";

type PeerIdStr = string
type RPCControlIHave = {
    topicID?: string | undefined;
    messageIDs: Uint8Array<ArrayBufferLike>[];
}
type PubSubSendSubscriptions = (toPeer: PeerIdStr, topics: string[], subscribe: boolean) => void
type PubSubPushGossip = (id: PeerIdStr, controlIHaveMsgs: RPCControlIHave) => void
type MessageCache = GossipsubOpts['messageCache']
type LibP2PNode = {
    services: {
        pubsub: GossipSub
        pubsubPeerDiscovery: PubSubPeerDiscovery
    }
}

export function tiePubSubWithPeerDiscovery(node: LibP2PNode){
    const pubsub = node.services.pubsub
    const pspd = node.services.pubsubPeerDiscovery

    /*
    pubsub['log'] = Object.assign(log.bind(null, 'LOG'), { error: log.bind(null, 'ERR') })
    function log(...args: unknown[]){
        console_log('PUBSUB', ...args.map(arg => {
            return (typeof arg === 'string' || typeof arg === 'number') ? arg : Bun.inspect(arg)
        }))
    }
    */
    
    const GossipsubMaxIHaveLength = 5000

    const pubsub_pushGossip = (pubsub['pushGossip'] as PubSubPushGossip).bind(pubsub)
    const pubsub_sendSubscriptions = (pubsub['sendSubscriptions'] as PubSubSendSubscriptions).bind(pubsub)
    pubsub['sendSubscriptions'] = (peerIdStr: PeerIdStr, topics: string[], subscribe: boolean) => {
        if(subscribe){
            //const gossipIDsByTopic = pubsub_mcache.getGossipIDs(new Set(topics))
            const gossipIDsByTopic = pspd.getGossipIDs(new Set(topics))
            //console_log('PUBSUB', 'gossipIDs', 'for', topics[0]!, '[', gossipIDsByTopic.get(topics[0]!)!.map(id => uint8ArrayToString(id, 'base64')).join(', '), ']')
            // eslint-disable-next-line prefer-const
            for(let [ topicID, messageIDs ] of gossipIDsByTopic.entries()){
                messageIDs = messageIDs.slice(0, GossipsubMaxIHaveLength)
                pubsub_pushGossip(peerIdStr, { topicID, messageIDs })
            }
        }
        pubsub_sendSubscriptions(peerIdStr, topics, subscribe)
    }
    
    const pubsub_mcache = pubsub['mcache'] as MessageCache
    const pubsub_mcache_getWithIWantCount = pubsub_mcache.getWithIWantCount.bind(pubsub_mcache)
    pubsub_mcache.getWithIWantCount = (msgIdStr: string, p: string) => {
        return pubsub_mcache_getWithIWantCount(msgIdStr, p) ??
            pspd.getWithIWantCount(msgIdStr, p)
    }
}
