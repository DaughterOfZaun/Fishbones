import { GossipSub, gossipsub, type GossipSubComponents } from '@chainsafe/libp2p-gossipsub'
import { yamux } from '@chainsafe/libp2p-yamux'
import { tcp } from '@libp2p/tcp'
import { createLibp2p } from 'libp2p'
//torrent-discovery: import { torrentPeerDiscovery } from './network/torrent-discovery'
import { pubsubPeerDiscovery as pubsubPeerWithDataDiscovery } from './network/pubsub-discovery'
import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery'
//torrent-discovery: import { hash } from 'uint8-util'
import { identify, identifyPush } from '@libp2p/identify'
import { ping } from '@libp2p/ping'
import { defaultLogger } from '@libp2p/logger'
import select, { type Choice } from './ui/dynamic-select'
import { type Game } from './game'
import color from 'yoctocolors-cjs'
import { noise } from '@chainsafe/libp2p-noise'
import { patchedCrypto } from './utils/crypto'
import { AbortPromptError } from '@inquirer/core'
import { RemoteGame } from './game-remote'
import { LocalGame } from './game-local'
import type { GamePlayer, PPP } from './game-player'
import { LocalServer, RemoteServer } from './server'
import spinner from './ui/spinner'
import * as Data from './data'
import type { Peer as PBPeer } from './message/peer'
import { circuitRelayServer, circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { dcutr } from '@libp2p/dcutr'
import { autoNAT } from '@libp2p/autonat'
import { uPnPNAT, type UPnPNAT } from '@libp2p/upnp-nat'
import { webRTC, webRTCDirect } from '@libp2p/webrtc'
import { kadDHT, removePrivateAddressesMapper, type KadDHT } from '@libp2p/kad-dht'
import { bootstrap } from '@libp2p/bootstrap'
//import { mdns } from '@libp2p/mdns'
import type { Libp2p, Logger, PeerData, PeerDiscoveryEvents, PeerInfo, PeerStore, Startable, TypedEventEmitter } from '@libp2p/interface'
import { contentPeerDiscovery } from './network/content-discovery'
import { CID } from 'multiformats/cid'
import * as json from 'multiformats/codecs/json'
import { sha256 } from 'multiformats/hashes/sha2'
import type { ConnectionManager } from '@libp2p/interface-internal'
import { autodial } from './network/autodial'
//import { webSockets } from '@libp2p/websockets'
//import { webTransport } from '@libp2p/webtransport'
//TODO: rendezvous

await Data.repair()

const ports = ((
    port = Number(process.argv[2]) || 5116
) => ({
    tcp: port + 0,
    kadDHT: port + 1,
    game: port + 2,
}))()

const appName = ['com', 'github', 'DaughterOfZaun', 'Fishbones']
//const cid = 'bagaaierawchtonvxlm4szp7txp5qtrp63ncsqygzqbd6kma65nwjqg4ltila'
const cid = CID.create(1, json.code,
    await sha256.digest(
        json.encode({ appName })
    )
)
const node = await createLibp2p({
    addresses: {
        listen: [
            `/ip4/0.0.0.0/tcp/${ports.tcp}`,
            //`/ip4/0.0.0.0/tcp/${0}/ws`,
            `/ip4/0.0.0.0/udp/${0}/webrtc-direct`,
            `/p2p-circuit`,
            `/webrtc`,
        ]
    },
    transports: [
        circuitRelayTransport(), // Default relay-tag.value = 1
        webRTCDirect(),
        webRTC(),
        tcp(),
        //webSockets(),
        //webTransport(),
    ],
    streamMuxers: [ yamux() ],
    connectionEncrypters: [ noise({
        // ChaCha20-Poly1305 is currently not supported in Bun.
        //crypto: pureJsCrypto //WALKAROUND:
        crypto: patchedCrypto //HACK:
    }) ],
    //peerDiscovery: [],
    services: {
        contentPeerDiscovery: contentPeerDiscovery({ cid }),
        bootstrap: bootstrap({
            list: [
                //src: https://github.com/ipfs/kubo/blob/master/config/bootstrap_peers.go
                //src: https://github.com/ipfs/helia/blob/main/packages/helia/src/utils/bootstrappers.ts
                //src: https://github.com/libp2p/js-libp2p/blob/main/packages/peer-discovery-bootstrap/src/index.ts
                //src: https://github.com/libp2p/cpp-libp2p/blob/master/example/02-kademlia/rendezvous_chat.cpp
                "/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN",
                "/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa", // rust-libp2p-server
                "/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb",
                "/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt",
                "/dnsaddr/va1.bootstrap.libp2p.io/p2p/12D3KooWKnDdG3iXw9eTFijk3EWSunZcFi54Zka4wmtqtt6rPxc8", // js-libp2p-amino-dht-bootstrapper
                // va1 is not in the TXT records for _dnsaddr.bootstrap.libp2p.io yet so use the host name directly
                "/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ",           // mars.i.ipfs.io
                "/ip4/104.131.131.82/udp/4001/quic-v1/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ",   // mars.i.ipfs.io
                
                "/dnsaddr/bootstrap.libp2p.io/ipfs/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN",
                "/dnsaddr/bootstrap.libp2p.io/ipfs/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa",
                "/dnsaddr/bootstrap.libp2p.io/ipfs/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb",
                "/dnsaddr/bootstrap.libp2p.io/ipfs/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt",
                "/ip4/104.131.131.82/tcp/4001/ipfs/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ",            // mars.i.ipfs.io
                "/ip4/104.236.179.241/tcp/4001/ipfs/QmSoLPppuBtQSGwKDZT2M73ULpjvfd3aZ6ha4oFGL1KrGM",           // pluto.i.ipfs.io
                "/ip4/128.199.219.111/tcp/4001/ipfs/QmSoLSafTMBsPKadTEgaXctDQVcqN88CNLHXMkTNwMKPnu",           // saturn.i.ipfs.io
                "/ip4/104.236.76.40/tcp/4001/ipfs/QmSoLV4Bbm51jM9C4gDYZQ9Cy3U6aXMJDAbzgu2fzaDs64",             // venus.i.ipfs.io
                "/ip4/178.62.158.247/tcp/4001/ipfs/QmSoLer265NRgSp2LA3dPaeykiS1J6DifTC88f5uVQKNAd",            // earth.i.ipfs.io
                "/ip6/2604:a880:1:20::203:d001/tcp/4001/ipfs/QmSoLPppuBtQSGwKDZT2M73ULpjvfd3aZ6ha4oFGL1KrGM",  // pluto.i.ipfs.io
                "/ip6/2400:6180:0:d0::151:6001/tcp/4001/ipfs/QmSoLSafTMBsPKadTEgaXctDQVcqN88CNLHXMkTNwMKPnu",  // saturn.i.ipfs.io
                "/ip6/2604:a880:800:10::4a:5001/tcp/4001/ipfs/QmSoLV4Bbm51jM9C4gDYZQ9Cy3U6aXMJDAbzgu2fzaDs64", // venus.i.ipfs.io
                "/ip6/2a03:b0c0:0:1010::23:1001/tcp/4001/ipfs/QmSoLer265NRgSp2LA3dPaeykiS1J6DifTC88f5uVQKNAd", // earth.i.ipfs.io
            ],
        }), // Default tag.value = 50
        //mdns: mdns(),
        ping: ping(),
        pubsub: gossipsub({
            tagMeshPeers: true, // Default [topic]tag.value = 100
            //batchPublish: true,
            //doPX: true,
        }) as (components: GossipSubComponents) => GossipSub,
        identify: identify(),
        identifyPush: identifyPush(),
        logger: defaultLogger,
        pubsubPeerDiscovery: pubsubPeerDiscovery(
            // Default values only.
        ),
        pubsubPeerWithDataDiscovery: pubsubPeerWithDataDiscovery({
            interval: 10000,
            enableBroadcast: false,
            topics: [ `${appName.join('.')}._peer-discovery._p2p._pubsub` ]
        }),
        /*
        //torrent-discovery: 
        torrentPeerDiscovery: torrentPeerDiscovery({
            infoHash: (await hash(`${appName.join('/')}/${0}`, 'hex', 'sha-1')) as string,
            port: ports.tcp,
            announce: await Data.getAnnounceAddrs(),
            dht: true,
            dhtPort: ports.kadDHT,
            tracker: true,
            lsd: false, // We use MDNS to search for peers on the local network.
        }),
        */
        dcutr: dcutr(),
        upnpNAT: uPnPNAT(),
        autoNAT: autoNAT(),
        //TODO: Run only if reported available from outside by autoNAT?
        relay: circuitRelayServer(), // Default relay+keepalive-tag.value = 1 + 1
        aminoDHT: kadDHT({
            protocol: '/ipfs/kad/1.0.0',
            peerInfoMapper: removePrivateAddressesMapper,
            //logPrefix: 'libp2p:dht-amino',
            //datastorePrefix: '/dht-amino',
            //metricsPrefix: 'libp2p_dht_amino',
            //validators: { ipns: ipnsValidator },
            //selectors: { ipns: ipnsSelector }
        }), // Default close-tag.value = 50; peer-tag.value = 1
        autodial: autodial({})
    },
    start: false,
})
await node.start()
//node.status = 'started'
//await node.stop()

const node_services_aminoDHT = node.services.aminoDHT as KadDHT & TypedEventEmitter<PeerDiscoveryEvents>
const node_services_upnpNAT = node.services.upnpNAT as (UPnPNAT & Startable)
const pspd = node.services.pubsubPeerWithDataDiscovery
const pubsub = node.services.pubsub as GossipSub
/*
const cm = (node as unknown as Libp2pClass).components.connectionManager
const cm_openConnection = cm.openConnection
cm.openConnection = function openConnection
(this: ConnectionManager, ...args: Parameters<ConnectionManager['openConnection']>):
ReturnType<ConnectionManager['openConnection']> {
    return cm_openConnection.call(this, ...args).catch()
}
*/

process.on('uncaughtException', () => {})

type Libp2pClass = Libp2p & {
    log: Logger,
    components: {
        peerStore: PeerStore
        connectionManager: ConnectionManager
    }
}
const node_onDiscoveryPeer = onDiscoveryPeer.bind(node as unknown as Libp2pClass)

node.services.contentPeerDiscovery.addEventListener('peer', evt => node_onDiscoveryPeer(evt, true))
node.services.bootstrap.addEventListener('peer', evt => node_onDiscoveryPeer(evt))
//node.services.mdns.addEventListener('peer', evt => node_onDiscoveryPeer(evt))
node.services.pubsubPeerDiscovery.addEventListener('peer', evt => node_onDiscoveryPeer(evt))
node.services.pubsubPeerWithDataDiscovery.addEventListener('peer', evt => node_onDiscoveryPeer(evt, true))
//torrent-discovery: node.services.torrentPeerDiscovery.addEventListener('peer', evt => node_onDiscoveryPeer(evt))
node_services_aminoDHT.addEventListener('peer', evt => node_onDiscoveryPeer(evt))

const SAME_APP_TAG_NAME = 'same-app'
const SAME_APP_TAG_VALUE = 1
//const SAME_APP_CONNECTION_PRIORTY = 51

function onDiscoveryPeer(this: Libp2pClass, evt: CustomEvent<PeerInfo>, sameApp = false): void {
    const { detail: peer } = evt

    if (peer.id.toString() === this.peerId.toString()) {
        this.log.error('peer discovery mechanism discovered self')
        return
    }

    const { multiaddrs } = peer
    const data: PeerData = { multiaddrs }
    if(sameApp) data.tags = {
        [SAME_APP_TAG_NAME]: {
            value: SAME_APP_TAG_VALUE
        }
    }
    void this.components.peerStore.merge(peer.id, data)
    /*
    .then(peer => {
        const opts: OpenConnectionOptions = {}
        if(sameApp) opts.priority = SAME_APP_CONNECTION_PRIORTY
        if(sameApp) this.components.connectionManager.openConnection(peer.id, opts)
        .catch(err => {
            this.log.error('could not dial discovered peer %p', peer.id, err)
        })
    })
    */
    .catch(err => { this.log.error(err) })
}

console.log('cid:', cid.toString())
console.log('peer:', node.peerId.toString())
//node.addEventListener('peer:connect', e => console.log('peer:connect', e.detail.toString(), e.detail))
//node.addEventListener('peer:discovery', e => console.log('peer:discovery', e.detail.toString(), e.detail))
//node.addEventListener('peer:disconnect', e => console.log('peer:disconnect', e.detail.toString(), e.detail))

const name = 'Player'
//const name = node.peerId.toString().slice(-8)

await main()

async function main(){
    type Action = ['join', RemoteGame] | ['host'] | ['exit'] | ['noop']
    
    const getChoices = () => {
        let ret = pspd.getPeersWithData()
        .filter(pwd => pwd.data?.serverSettings)
        //.filter(pwd => {
        //    const gi = pwd.data?.gameInfos[0]
        //    return gi && gi.players < 2 * gi.playersMax
        //})
        .flatMap(pwd => {
            const server = RemoteServer.create(node, pwd.id, pwd.data!.serverSettings!) //TODO: Cache
            
            if(!server.validate()) return []

            return pwd.data!.gameInfos.map(gameInfo => ({
                id: pwd.id,
                name: pwd.data!.name,
                server: server,
                game: RemoteGame.create(node, pwd.id, server, gameInfo) //TODO: Cache
            }))
        })
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .map(({ id, name, game, server }) => {
            //const ownerId = id.toString().slice(-8)
            //const gameName = game.name.toString()
            //const serverName = server.name.toString()
            const players = ('' + game.getPlayersCount()).padStart(2, ' ')
            const playersMax = ('' + 2 * (game.playersMax.value ?? 0)).padEnd(2, ' ')
            const mode = game.mode.toString()
            const map = game.map.toString()
            //const password = (game.password.isSet ? '[P] ' : '   ')
            const features = game.features.asString().replaceAll(' ', '_').replaceAll('][', ' ').replace(/\[|\]/g, '')
            //const ping = Math.min(100, 999).toString().padStart(3, ' ')
            
            let line = [
                `${players}/${playersMax}`,
                name.padEnd(16, ' '),
                map.padEnd(24, ' '),
                mode.padEnd(7, ' '),
                features
            ]
            //.map(segment => color.underline(segment))
            .join(' | ')

            if(game.password.isSet)
                line = color.gray(line)

            return ({
                value: ['join', game] as Action,
                name: line,
                
                // name: [
                //     `[${players}/${playersMax}] ${name}'s ${gameName} at ${serverName}`,
                //     [` `, password, `${mode} at ${map}`, features].join(' '),
                // ].join('\n')
            })
        })
        if(ret.length == 0){
            ret = pubsub.isStarted() ?
                [ { value: ['noop'], name: color.gray('Waiting for the servers to appear...') } ] :
                [ { value: ['noop'], name: color.red('Failed to initialize the network...') } ]
        }
        return ret.concat(defaultItems)
    }
    const defaultItems = [
        { value: ['host'] as Action, name: 'Create a custom game lobby' },
        { value: ['exit'] as Action, name: 'Quit' },
    ]
    loop: while(true){
        const [action, ...args] = await select<Action>({
            message: 'Select a custom game lobby',
            choices: getChoices(),
            cb(setItems) {
                const listener = () => setItems(getChoices())
                pspd.addEventListener('update', listener)
                return () => pspd.removeEventListener('update', listener)
            },
            pageSize: 20,
        }, {
            clearPromptOnDone: true,
        })
        if(action == 'host' && pubsub.isStarted() == false){
            const server = await LocalServer.create(node)
            const game = await LocalGame.create(node, server, ports.game)
            await game.join(name, undefined)
            await lobby(game)
        }
        if(action == 'host' && pubsub.isStarted() == true){
            const server = await LocalServer.create(node)
            const game = await LocalGame.create(node, server, ports.game)

            game.startListening()
            await game.join(name, undefined)

            const data = {
                name: name,
                serverSettings: server.encode(),
                gameInfos: [ game.encode() ],
            } as PBPeer.AdditionalData
            pspd.setData(data)
            
            broadcast(true)
            function broadcast(announce: boolean){
                if(announce || pspd.getBroadcastEnabled()){
                    pspd.setBroadcastEnabled(announce)
                    pspd.broadcast(announce)
                }
            }
            
            let prevPlayerCount = 0
            game.addEventListener('update', update)
            function update(){
                const gi = data.gameInfos[0]!
                gi.players = game.getPlayersCount()
                if(gi.players != prevPlayerCount){
                    prevPlayerCount = gi.players
                    broadcast(game.isJoinable())
                }
            }
            game.addEventListener('start', start)
            function start(){ broadcast(game.isJoinable()) }
            game.addEventListener('stop', stop)
            function stop(){ broadcast(game.isJoinable()) }
            
            await lobby(game)
            game.stopListening()

            game.removeEventListener('update', update)
            game.removeEventListener('start', start)
            game.removeEventListener('stop', stop)
            pspd.setData(null)
            broadcast(false)
        }
        if(action == 'join'){
            const game = args[0]!

            await game.connect()
            if(game.password.isSet)
                await game.password.uinput()
            await game.join(name, game.password.encode())
            await lobby(game)
            game.disconnect()
        }
        if(action == 'exit'){
            await node.services.pubsubPeerWithDataDiscovery?.beforeStop()
            //await node.services.pubsubPeerDiscovery?.stop()
            //torrent-discovery: await node.services.torrentPeerDiscovery?.beforeStop()
            //torrent-discovery: await node.services.torrentPeerDiscovery?.stop()
            await node_services_upnpNAT?.stop()
            await node.stop()
            break loop
        }
    }
}

function playerChoices<T>(game: Game, cb: (player: GamePlayer) => T){
    return game.getPlayers().map(player => {
        const colorFunc = color[player.team.color()]
        const playerId = player.id.toString(16).padStart(8, '0')
        const champion = player.champion.toString()
        const spell1 = player.spell1.toString()
        const spell2 = player.spell2.toString()
        const locked = player.lock.toString()
        return ({
            value: cb(player),
            name: colorFunc(
                [`[${playerId}] ${player.name}`, champion, spell1, spell2, locked].join(' - ')
            )
        })
    }) as Choice<T>[]
}

type Context = {
    signal: AbortSignal,
    clearPromptOnDone: boolean,
    controller: AbortController,
    game: Game,
}

async function lobby(game: Game){
    type View = null | ((opts: Context) => Promise<unknown>)

    let controller = new AbortController()
    const ctx: Context = {
        signal: controller.signal,
        clearPromptOnDone: true,
        controller,
        game,
    }
    const handlers = {
        kick: () => controller.abort(null),
        start: () => controller.abort(lobby_pick),
        wait: () => controller.abort(lobby_wait_for_start),
        crash: () => controller.abort(lobby_crash_report),
        launch: () => controller.abort(lobby_wait_for_end),
        stop: () => controller.abort(lobby_gather),
    }
    const handlers_keys = Object.keys(handlers) as (keyof typeof handlers)[]
    for(const name of handlers_keys)
        game.addEventListener(name, handlers[name])
    
    let view: View = lobby_gather
    while(view){
        try {
            await view(ctx)
            //break
        } catch(error) {
            if (error instanceof AbortPromptError){
                controller = new AbortController()
                ctx.signal = controller.signal
                view = error.cause as View
            } else throw error
        }
    }

    for(const name of handlers_keys)
        game.removeEventListener(name, handlers[name])
}

async function lobby_gather(ctx: Context){
    const { game } = ctx

    type Action = ['noop'] | ['start'] | ['exit']
    
    const getChoices = () => ([
        { value: ['start'] as Action, name: 'Start Game', disabled: !game.canStart },
        ...playerChoices<Action>(game, () => ['noop'] as Action),
        { value: ['exit'] as Action, name: 'Quit' },
    ])
    loop: while(true){
        const [action] = await select<Action>({
            message: 'Waiting for players...',
            choices: getChoices(),
            cb: (setItem) => {
                const listener = () => setItem(getChoices())
                game.addEventListener('update', listener)
                return () => game.removeEventListener('update', listener)
            },
            pageSize: 20,
        }, ctx)
        if(action == 'start'){
            /*await*/ game.start()
            break loop
        } else if(action == 'noop'){
            continue
        } else if(action == 'exit'){
            throw new AbortPromptError({ cause: null })
        }
    }
}

async function lobby_pick(ctx: Context){
    const { game } = ctx

    type Action = ['lock'] | ['pick', PPP] | ['noop'] | ['exit']

    const getChoices = () => {
        const player = game.getPlayer()!
        const disabled = !!player.lock.value
        return [
            { value: ['lock'] as Action, name: 'Lock In', disabled },
            ...(['champion', 'spell1', 'spell2'] as PPP[]).map(ppp => (
                { value: ['pick', ppp] as Action, name: `${player[ppp].name}: ${player[ppp].toString()}`, disabled }
            )),
            ...playerChoices<Action>(game, () => ['noop'] as Action),
            { value: ['exit'] as Action, name: 'Quit' },
        ]
    }

    for(const prop of ['champion', 'spell1', 'spell2'] as const){
        await game.pick(prop, ctx.signal)
    }

    /*loop:*/ while(true){
        const [action, ...args] = await select<Action>({
            message: 'Waiting for all players to lock their choice...',
            choices: getChoices(),
            cb: (setItem) => {
                const listener = () => setItem(getChoices())
                game.addEventListener('update', listener)
                return () => game.removeEventListener('update', listener)
            },
            pageSize: 20,
        }, ctx)
        if(action == 'lock'){
            await game.set('lock', +true)
            //break loop
        } else if(action == 'pick'){
            const prop = args[0]!
            await game.pick(prop, ctx.signal)
        } else if(action == 'noop'){
            continue
        } else if(action == 'exit'){
            throw new AbortPromptError({ cause: null })
        }
    }
}

async function lobby_wait_for_start(ctx: Context){
    const message = 'Waiting for the server to start...'
    await spinner({ message }, ctx)
}

async function lobby_wait_for_end(ctx: Context){
    const message = 'Waiting for the end of the game...'
    await spinner({ message }, ctx)
}

async function lobby_crash_report(ctx: Context){
    const { game } = ctx

    type Action = ['relaunch'] | ['exit']
    
    const [action] = await select({
        message: 'The client exited unexpectedly',
        choices: [
            { value: ['relaunch'] as Action, name: 'Restart the client' },
            { value: ['exit'] as Action, name: 'Leave' },
        ],
        pageSize: 20,
    }, ctx)
    if(action === 'relaunch'){
        /*await*/ game.relaunch()
        //return await lobby_wait_for_end(ctx)
        throw new AbortPromptError({ cause: lobby_wait_for_end })   
    } else if(action == 'exit'){
        throw new AbortPromptError({ cause: null })
    }
}
