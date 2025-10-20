import type { AbortOptions, IdentifyResult, PeerId } from "@libp2p/interface";
import { consumePeerInfoString, getPeerInfoString, validatePeerInfoString, type LibP2PNode } from "./index-node-simple";
import { console_log } from "./ui/remote";
import { logger } from "./utils/data-shared";
import { NAME, VERSION } from "./utils/constants-build";
import { PeerSet } from "@libp2p/peer-collections";
import { render, DeferredView } from "./ui/remote-view";
import { button, form, label, list, text } from "./ui/remote-types";

const fbPeers = new PeerSet()

export async function profilePanel(node: LibP2PNode, opts: Required<AbortOptions>){
    
    const view = render('ProfilePanel', form({
        Name: label(node.peerId.toString().slice(-8)),
        Status: label(''),
    }), opts)

    return view.promise
}

export async function connections(node: LibP2PNode, opts: Required<AbortOptions>){
    
    const view = render('ConnectionsPanel', form({
        Connections: list(undefined, 'No connections'),
        DirectConnect: button(() => {
            void directConnect(node, opts)
            .then(async str => {
                if(typeof str === 'string')
                    return connectByPeerInfoString(node, view, str, opts)
            })
        }),
    }), opts)

    view.addEventListener(node, 'peer:identify', (evt: CustomEvent<IdentifyResult>) => {
        const { peerId, agentVersion } = evt.detail
        const userAgent = `${NAME}/${VERSION}`
        if(!fbPeers.has(peerId) && agentVersion === userAgent){
            fbPeers.add(peerId)
            view.get('Connections').add(peerId.toString(), form({
                Name: label(peerId.toString().slice(-8)),
                Status: label('Connected'),
            }))
        }
    })

    view.addEventListener(node, 'peer:disconnect', (evt: CustomEvent<PeerId>) => {
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
    
    const view = render<string | void>('DirectConnect', form({
        PastedText: text(undefined, (str: string) => {
            lastPeerInfoString = str
            void validatePeerInfoString(node, str, opts)
            .then((err) => {
                view.get('Error').update({ $type: 'label', text: err ?? '', visible: !!err })
                view.get('Connect').update({ $type: 'button', disabled: !!err })
            })
        }),
        Error: label(),
        Connect: button(() => view.resolve(lastPeerInfoString)),
        Cancel: button(() => view.resolve()),
    }), opts)

    view.addEventListener(node, 'self:peer:update', onPeerUpdate)
    function onPeerUpdate(){
        getPeerInfoString(node, opts)
            .then((str) => {
                view.get('TextToCopy').update(text(str))
            })
            .catch((/*err*/) => { /* Ignore */ })
    }
    onPeerUpdate()

    return view.promise
}

async function connectByPeerInfoString(node: LibP2PNode, view: DeferredView<void>, str: string, opts: Required<AbortOptions>){
    
    let peerId: PeerId | undefined
    try {
        peerId = await consumePeerInfoString(node, str, opts)
    } catch(err) {
        console_log('Parsing the key failed:', Bun.inspect(err))
    }
    if(!peerId) return
    
    if(!fbPeers.has(peerId)){
        fbPeers.add(peerId)
        view.get('Connections').add(peerId.toString(), form({
            Name: label(peerId.toString().slice(-8)),
            Status: label('Connecting...'),
        }))
    }
    let statusText
    try {
        logger.log('Connecting to', peerId.toString())
        await node.dial(peerId, opts)
        statusText = 'Connected'
    } catch(err) {
        console_log('Connecting via key failed:', Bun.inspect(err))
        statusText = 'Connection failed'
    }
    view.get(`Connections/${peerId.toString()}/Status`).update(label(statusText))
}
