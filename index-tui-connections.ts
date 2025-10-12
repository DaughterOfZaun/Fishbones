import type { AbortOptions, IdentifyResult, PeerId } from "@libp2p/interface";
import { consumePeerInfoString, getPeerInfoString, validatePeerInfoString, type LibP2PNode } from "./index-node-simple";
import { console_log, DeferredView, show } from "./ui/remote";
import type { OpenConnectionOptions } from "@libp2p/interface-internal";
import { logger } from "./utils/data-shared";
import { NAME, VERSION } from "./utils/constants-build";
import { PeerSet } from "@libp2p/peer-collections";
/*
interface PlayerInfo {
    name: string
    icon: string
    status: string
}
*/

export async function profilePanel(node: LibP2PNode, opts: Required<AbortOptions>){
    
    const view = show('ProfilePanel', {
        //Icon: { path: '' },
        Name: { text: node.peerId.toString().slice(-8) },
        Status: { text: '' },
    }, {}, opts)

    return view.promise
}

export async function connections(node: LibP2PNode, opts: Required<AbortOptions>){
    
    const view = show('ConnectionsPanel', {
        Connections: {
            default: 'No connections',
        }
    }, {
        'DirectConnect.pressed': () => {
            void directConnect(node, opts)
            .then(async str => {
                if(typeof str === 'string')
                    return connectByPeerInfoString(node, view, str, opts)
            })
        },
    }, opts)

    const fbPeers = new PeerSet()
    view.addEventListener(node, 'peer:identify', (evt: CustomEvent<IdentifyResult>) => {
        const { peerId, agentVersion } = evt.detail
        const userAgent = `${NAME}/${VERSION}`
        if(agentVersion === userAgent){
            fbPeers.add(peerId)
            view.call('add', {
                id: peerId.toString(),
                //Icon: { path: '' },
                Name: { text: peerId.toString().slice(-8) },
                Status: { text: 'Connected' },
            })
        }
    })

    node.addEventListener('peer:disconnect', (evt: CustomEvent<PeerId>) => {
        const peerId = evt.detail
        if(fbPeers.has(peerId)){
            fbPeers.delete(peerId)
            view.call('remove', {
                id: peerId.toString(),
            })
        }
    })

    return view.promise
}

let lastPeerInfoString = ''
async function directConnect(node: LibP2PNode, opts: Required<AbortOptions>){
    
    const view = show<string | void>('DirectConnect', {
        //PastedText: { text: lastPeerInfoString },
    }, {
        'PastedText.changed': (str: string) => {
            lastPeerInfoString = str
            void validatePeerInfoString(node, str, opts)
            .then((err) => {
                view.call('update', {
                    Error: { text: err ?? '', visible: !!err },
                    Connect: { disabled: !!err },
                })
            })
        },
        'Connect.pressed': () => {
            return view.resolve(lastPeerInfoString)
        },
        'Cancel.pressed': () => {
            return view.resolve()
        }
    }, opts)

    view.addEventListener(node, 'self:peer:update', onPeerUpdate)
    function onPeerUpdate(){
        getPeerInfoString(node, opts)
            .then((str) => {
                view.call('update', {
                    TextToCopy: { text: str },
                })
            })
            .catch((/*err*/) => { /* Ignore */ })
    }
    onPeerUpdate()

    return view.promise
}

async function connectByPeerInfoString(node: LibP2PNode, view: DeferredView<unknown>, str: string, opts: Required<AbortOptions>){
    
    let peerId: PeerId | undefined
    try {
        peerId = await consumePeerInfoString(node, str, opts)
    } catch(err) {
        console_log('Parsing the key failed:', Bun.inspect(err))
    }
    if(!peerId) return
    
    view.call('add', {
        id: peerId.toString(),
        icon: '',
        name: peerId.toString().slice(-8),
        status: 'Connecting...',
    })
    const options: OpenConnectionOptions = {
        signal: opts.signal,
        /*
        onProgress(evt){
            const { type, detail } = evt
            view.call('update', {
                id: peerId.toString(),
                status: type
            })
            let detailString = ''
            if(typeof detail === 'string') detailString = detail
            else if(Array.isArray(detail)){
                detailString = JSON.stringify(detail.map((addr: Address) => ({
                    multiaddr: addr.multiaddr.toString(),
                    isCertified: addr.isCertified,
                })), null, 4)
            }
            logger.log('Connecting to', peerId.toString(), type, detailString)
        },
        */
    }
    try {
        logger.log('Connecting to', peerId.toString())
        await node.dial(peerId, options)
        view.call('update', {
            id: peerId.toString(),
            status: 'Connected',
        })
    } catch(err) {
        console_log('Connecting via key failed:', Bun.inspect(err))
        view.call('update', {
            id: peerId.toString(),
            status: 'Connection failed',
        })
    }
}
