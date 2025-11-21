import type { AbortOptions, IdentifyResult, PeerId } from "@libp2p/interface";
import { consumePeerInfoString, getPeerInfoString, serverPeerID, validatePeerInfoString, type LibP2PNode } from "../node/node";
import { console_log } from "../ui/remote/remote";
import { logger } from "../utils/log";
import { NAME } from "../utils/constants-build";
import { render, DeferredView } from "../ui/remote/view";
import { button, form, label, list, text } from "../ui/remote/types";
import { getUsername } from "../utils/namegen/namegen";
import { PeerMap } from "@libp2p/peer-collections";
import type { PingResult } from "../network/libp2p/ping";

//enum PeerType { Undetermined, Player, Server }
enum PeerStatus { Disconnected, Connecting, Connected, ConnectionFailed }
const fbPeers = new PeerMap<FBPeerInfo>()
class FBPeerInfo {
    constructor(
        //public type = PeerType.Undetermined,
        public status = PeerStatus.Disconnected,
        public shownInUI = false,
    ){}
}

type MasteriesPage = (opts: Required<AbortOptions>) => Promise<void>
export async function profilePanel(node: LibP2PNode, masteries: MasteriesPage, opts: Required<AbortOptions>){
    
    const view = render('ProfilePanel', form({
        Name: label(getUsername(node.peerId)),
        Edit: button(() => void masteries(opts)),
        //Status: label(''),
    }), opts)

    return view.promise
}

const peerStatusToString = {
    [PeerStatus.Disconnected]: 'Disconnected',
    [PeerStatus.Connecting]: 'Connecting...',
    [PeerStatus.Connected]: 'Connected',
    [PeerStatus.ConnectionFailed]: 'Connection failed',
}

function updatePeerStatus(view: DeferredView<void>, peerId: PeerId, status: PeerStatus, getPing: (peerId: PeerId) => number | undefined){
    let info = fbPeers.get(peerId)
    if(!info){
        info = new FBPeerInfo()
        fbPeers.set(peerId, info)
    }

    const prevStatus = info.status
    info.status = status

    const pingString = (info.status !== prevStatus && info.status == PeerStatus.Connected) ?
        getPing(peerId)?.toFixed()?.concat(' ms') ?? '' :
        ''

    if(info.status == PeerStatus.Disconnected){
        if(info.shownInUI){
            info.shownInUI = false
            view.get('Connections').remove(peerId.toString())
        }
    } else if(!info.shownInUI){
        info.shownInUI = true
        view.get('Connections').add(peerId.toString(), form({
            Name: label(getUsername(peerId)),
            Status: label(peerStatusToString[info.status]),
            Ping: label(pingString),
        }))
    } else if(info.status != prevStatus){
        view.get(`Connections/${peerId.toString()}`).update(form({
            Status: label(peerStatusToString[info.status]),
            //Ping: label(pingString),
        }))
    }
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

    const pingService = node.services.ping
    const getPing = (peerId: PeerId) => {
        const ms = pingService.getPing(peerId)
        return ms
    }

    view.addEventListener(node, 'same-program-peer:discovery', onPeerDiscoveredByMechanism)
    function onPeerDiscoveredByMechanism(event: CustomEvent<PeerId>){
        const peerId = event.detail
        if(!fbPeers.has(peerId)){
            updatePeerStatus(view, peerId, PeerStatus.Disconnected, getPing)
        }
    }

    view.addEventListener(node, 'connection:begin', (evt: CustomEvent<PeerId>) => {
        const peerId = evt.detail
        if(fbPeers.has(peerId)){
            updatePeerStatus(view, peerId, PeerStatus.Connecting, getPing)
        }
    })

    view.addEventListener(node, 'connection:fail', (evt: CustomEvent<PeerId>) => {
        const peerId = evt.detail
        if(fbPeers.has(peerId)){
            //updatePeerStatus(view, peerId, PeerStatus.ConnectionFailed, getPing)
            updatePeerStatus(view, peerId, PeerStatus.Disconnected, getPing)
        }
    })

    view.addEventListener(node, 'peer:connect', (evt: CustomEvent<PeerId>) => {
        const peerId = evt.detail
        if(fbPeers.has(peerId)){
            updatePeerStatus(view, peerId, PeerStatus.Connected, getPing)
            //pingService.ping(peerId).catch(() => { /* Ignore */ })
        }
    })

    view.addEventListener(node, 'peer:identify', (evt: CustomEvent<IdentifyResult>) => {
        const { peerId, agentVersion } = evt.detail
        if(agentVersion?.includes(NAME)){
            updatePeerStatus(view, peerId, PeerStatus.Connected, getPing)
            //pingService.ping(peerId).catch(() => { /* Ignore */ })
        }
    })

    view.addEventListener(node, 'peer:disconnect', (evt: CustomEvent<PeerId>) => {
        const peerId = evt.detail
        if(fbPeers.has(peerId)){
            updatePeerStatus(view, peerId, PeerStatus.Disconnected, getPing)
        }
    })

    view.addEventListener(node.services.ping, 'ping', (event: CustomEvent<PingResult>) => {
        const { peerId, ms } = event.detail
        const info = fbPeers.get(peerId)
        if(info && info.shownInUI){
            view.get(`Connections/${peerId.toString()}/Ping`)
                .update(label(ms?.toFixed()?.concat(' ms') ?? ''))
        }
    })

    //fbPeers.set(serverPeerID, new FBPeerInfo(PeerType.Server))
    updatePeerStatus(view, serverPeerID, PeerStatus.Connecting, getPing)

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
    
    const getPing = node.services.ping.getPing.bind(node.services.ping)

    updatePeerStatus(view, peerId, PeerStatus.Connecting, getPing)
    try {
        logger.log('Connecting to', peerId.toString())
        await node.dial(peerId, opts)
        updatePeerStatus(view, peerId, PeerStatus.Connected, getPing)
    } catch(err) {
        console_log('Connecting via key failed:', Bun.inspect(err))
        updatePeerStatus(view, peerId, PeerStatus.ConnectionFailed, getPing)
    }
}
