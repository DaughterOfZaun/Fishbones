import type { AbortOptions, IdentifyResult, PeerId } from "@libp2p/interface";
import { consumePeerInfoString, getPeerInfoString, serverPeerID, validatePeerInfoString, type LibP2PNode } from "../node/node";
import { console_log } from "../ui/remote/remote";
import { logger } from "../utils/log";
import { NAME } from "../utils/constants-build";
import { render, DeferredView } from "../ui/remote/view";
import { button, form, icon, label, list, text } from "../ui/remote/types";
import { getCustomIconPath, getCustomUsername, getUsername } from "../utils/namegen/namegen";
import { PeerMap } from "@libp2p/peer-collections";
import type { PingResult } from "../network/libp2p/ping";
import { args } from "../utils/args";
import { tr } from "../utils/translation";
import type { PeerIdWithData } from "../network/libp2p/discovery/pubsub-discovery";
import { inspect } from 'node:util'

//enum PeerType { Undetermined, Player, Server }
enum PeerStatus { Disconnected, Connecting, Connected, ConnectionFailed }
const fbPeers = new PeerMap<FBPeerInfo>()
class FBPeerInfo {
    constructor(
        public name: string | undefined = undefined,
        public icon: number | undefined = undefined,
        public ping: number | undefined = undefined,
        public status = PeerStatus.Disconnected,
        //public type = PeerType.Undetermined,
    ){}
}

type MasteriesPage = (opts: Required<AbortOptions>) => Promise<void> | void
export async function profilePanel(node: LibP2PNode, masteries: MasteriesPage, opts: Required<AbortOptions>){
    
    const view = render('ProfilePanel', form({
        Icon: icon(`res://images/profile-icons-128x128.png:${args.usericon.value}`),
        Username: label(args.username.value),
        Name: label(getUsername(node.peerId, true)),
        Edit: button(() => void masteries(opts)),
        //Status: label(''),
    }), opts)

    return view.promise
}

const peerStatusToString = {
    [PeerStatus.Disconnected]: tr('Disconnected'),
    [PeerStatus.Connecting]: tr('Connecting...'),
    [PeerStatus.Connected]: tr('Connected'),
    [PeerStatus.ConnectionFailed]: tr('Connection failed'),
}

function updatePeer(view: DeferredView<void>, peerId: PeerId, patch: Partial<FBPeerInfo>, getPing: (peerId: PeerId) => number | undefined){
    
    let info = fbPeers.get(peerId)!
    if(!info){
        info = new FBPeerInfo()
        fbPeers.set(peerId, info)
    }

    let { status, ping, name: nameStr, icon: iconIdx } = patch

    ping ??= getPing(peerId)
    status ??= info.status
    nameStr ??= info.name
    iconIdx ??= info.icon

    if(status != info.status && info.status == PeerStatus.Disconnected){
        view.get('Connections').add(peerId.toString(), getForm(true))
    } else if(status != info.status && status == PeerStatus.Disconnected){
        view.get('Connections').remove(peerId.toString())
    } else if(status != PeerStatus.Disconnected && (
           iconIdx != info.icon
        || nameStr != info.name
        || status != info.status
        || ping != info.ping
    )){
        view.get(`Connections/${peerId.toString()}`).update(getForm())
    }

    info.ping = ping
    info.status = status
    info.name = nameStr
    info.icon = iconIdx

    function getForm(full = false){
        return form({
            Icon: (full || iconIdx != info.icon) ? icon(getCustomIconPath({ icon: { value: iconIdx } })) : undefined!,
            Username: (full || nameStr != info.name) ? label(getCustomUsername({ name: { value: nameStr } })) : undefined!,
            Name: (full) ? label(getUsername(peerId, true)) : undefined!,
            Status: (full || status != info.status) ? label(peerStatusToString[status!]) : undefined!,
            Ping: (full || ping != info.ping) ? label(ping?.toFixed()?.concat('' + tr('ms')) ?? '') : undefined!,
        }, {
            modulate: (status == PeerStatus.Connected) ? '#ffffffff' : '#ffffff99',
        })
    }
}

export async function connections(node: LibP2PNode, opts: Required<AbortOptions>){
    
    const view = render('ConnectionsPanel', form({
        Connections: list(undefined, tr('No connections')),
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
            updatePeer(view, peerId, {}, getPing)
        }
    }

    view.addEventListener(node, 'connection:begin', (evt: CustomEvent<PeerId>) => {
        const peerId = evt.detail
        if(fbPeers.has(peerId)){
            updatePeer(view, peerId, { status: PeerStatus.Connecting }, getPing)
        }
    })

    view.addEventListener(node, 'connection:fail', (evt: CustomEvent<PeerId>) => {
        const peerId = evt.detail
        if(fbPeers.has(peerId)){
            //updatePeerStatus(view, peerId, PeerStatus.ConnectionFailed, getPing)
            updatePeer(view, peerId, { status: PeerStatus.Disconnected }, getPing)
        }
    })

    view.addEventListener(node, 'peer:connect', (evt: CustomEvent<PeerId>) => {
        const peerId = evt.detail
        if(fbPeers.has(peerId)){
            updatePeer(view, peerId, { status: PeerStatus.Connected }, getPing)
            //pingService.ping(peerId).catch(() => { /* Ignore */ })
        }
    })

    view.addEventListener(node, 'peer:identify', (evt: CustomEvent<IdentifyResult>) => {
        const { peerId, agentVersion } = evt.detail
        if(agentVersion?.includes(NAME)){
            updatePeer(view, peerId, { status: PeerStatus.Connected }, getPing)
            //pingService.ping(peerId).catch(() => { /* Ignore */ })
        }
    })

    view.addEventListener(node, 'peer:disconnect', (evt: CustomEvent<PeerId>) => {
        const peerId = evt.detail
        if(fbPeers.has(peerId)){
            updatePeer(view, peerId, { status: PeerStatus.Disconnected }, getPing)
        }
    })

    view.addEventListener(node.services.ping, 'ping', (event: CustomEvent<PingResult>) => {
        const { peerId, ms } = event.detail
        if(fbPeers.has(peerId)){
            updatePeer(view, peerId, { ping: ms }, getPing)
        }
    })

    view.addEventListener(node.services.pubsubPeerDiscovery, 'update', (event: CustomEvent<PeerIdWithData>) => {
        const peerId = event.detail?.id
        const name = event.detail?.data?.name
        const icon = event.detail?.data?.icon
        if(peerId !== undefined && (name !== undefined || icon !== undefined))
            updatePeer(view, peerId, { name, icon }, getPing)
    })

    if(args.allowInternet.value){
        //fbPeers.set(serverPeerID, new FBPeerInfo(PeerType.Server))
        updatePeer(view, serverPeerID, { status: PeerStatus.Connecting }, getPing)
    }

    return view.promise
}

let lastPeerInfoString = ''
async function directConnect(node: LibP2PNode, opts: Required<AbortOptions>){
    
    const view = render<string | void>('DirectConnect', form({
        TextToCopy: text(),
        BinaryToCopy: text(),
        PastedText: text(),
        PastedBinary: text(undefined, (str: string) => {
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
            .then(({ b64, json }) => {
                view.get('TextToCopy').update(text(json))
                view.get('BinaryToCopy').update(text(b64))
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
        console_log(tr('Parsing the key failed:', {}), inspect(err))
    }
    if(!peerId) return
    
    const getPing = node.services.ping.getPing.bind(node.services.ping)

    updatePeer(view, peerId, { status: PeerStatus.Connecting }, getPing)
    try {
        logger.log('Connecting to', peerId.toString())
        await node.dial(peerId, opts)
        updatePeer(view, peerId, { status: PeerStatus.Connected }, getPing)
    } catch(err) {
        console_log(tr('Connecting via key failed:', {}), inspect(err))
        updatePeer(view, peerId, { status: PeerStatus.ConnectionFailed }, getPing)
    }
}
