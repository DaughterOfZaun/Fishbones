import type { AbortOptions, IdentifyResult, PeerId } from "@libp2p/interface";
import { consumePeerInfoString, getPeerInfoString, validatePeerInfoString, type LibP2PNode } from "./index-node-simple";
import { console_log } from "./ui/remote";
import { logger } from "./utils/data-shared";
import { NAME, VERSION } from "./utils/constants-build";
import { PeerSet } from "@libp2p/peer-collections";
import { render, DeferredView } from "./ui/remote-view";

export async function profilePanel(node: LibP2PNode, opts: Required<AbortOptions>){
    
    const view = render('ProfilePanel', {
        $type: 'form',
        fields: {
            Name: {
                $type: 'label',
                text: node.peerId.toString().slice(-8),
            },
            Status: {
                $type: 'label',
                text: ''
            },
        }
    }, opts)

    return view.promise
}

export async function connections(node: LibP2PNode, opts: Required<AbortOptions>){
    
    const view = render('ConnectionsPanel', {
        $type: 'form',
        fields: {
            Connections: {
                $type: 'list',
                placeholderText: 'No connections',
            },
            DirectConnect: {
                $type: 'button',
                $listeners: {
                    pressed: () => {
                        void directConnect(node, opts)
                        .then(async str => {
                            if(typeof str === 'string')
                                return connectByPeerInfoString(node, view, str, opts)
                        })
                    },
                }
            }
        }
    }, opts)

    const fbPeers = new PeerSet()
    view.addEventListener(node, 'peer:identify', (evt: CustomEvent<IdentifyResult>) => {
        const { peerId, agentVersion } = evt.detail
        const userAgent = `${NAME}/${VERSION}`
        if(agentVersion === userAgent && !fbPeers.has(peerId)){
            fbPeers.add(peerId)
            view.get('Connections').add(peerId.toString(), {
                $type: 'form',
                fields: {
                    Name: { $type: 'label', text: peerId.toString().slice(-8) },
                    Status: { $type: 'label', text: 'Connected' },
                }
            })
        }
    })

    node.addEventListener('peer:disconnect', (evt: CustomEvent<PeerId>) => {
        const peerId = evt.detail
        if(fbPeers.has(peerId)){
            fbPeers.delete(peerId)
            view.get('Connections').remove(peerId.toString())
        }
    })

    return view.promise
}

let lastPeerInfoString = ''
async function directConnect(node: LibP2PNode, opts: Required<AbortOptions>){
    
    const view = render<string | void>('DirectConnect', {
        $type: 'form',
        fields: {
            PastedText: {
                $type: 'text',
                //text: lastPeerInfoString,
                $listeners: {
                    changed: (str: string) => {
                        lastPeerInfoString = str
                        void validatePeerInfoString(node, str, opts)
                        .then((err) => {
                            view.get('Error').update({ $type: 'label', text: err ?? '', visible: !!err })
                            view.get('Connect').update({ $type: 'button', disabled: !!err })
                        })
                    },
                },
            },
            Error: { $type: 'label', },
            Connect: {
                $type: 'button',
                $listeners: {
                    pressed: () => {
                        view.resolve(lastPeerInfoString)
                    },
                },
            },
            Cancel: {
                $type: 'button',
                $listeners: {
                    pressed: () => {
                        view.resolve()
                    }
                }
            }
        }
    }, opts)

    view.addEventListener(node, 'self:peer:update', onPeerUpdate)
    function onPeerUpdate(){
        getPeerInfoString(node, opts)
            .then((str) => {
                view.get('TextToCopy').update({ $type: 'text', text: str })
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
    
    view.get('Connections').add(peerId.toString(), {
        $type: 'form',
        fields: {
            Name: { $type: 'label', text: peerId.toString().slice(-8) },
            Status: { $type: 'label', text: 'Connecting...' },
        }
    })
    let statusText
    try {
        logger.log('Connecting to', peerId.toString())
        await node.dial(peerId, opts)
        statusText = 'Connected'
    } catch(err) {
        console_log('Connecting via key failed:', Bun.inspect(err))
        statusText = 'Connection failed'
    }
    view.get(`Connections/${peerId.toString()}/Status`).update({ $type: 'label', text: statusText })
}
