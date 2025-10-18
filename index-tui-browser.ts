import { RemoteGame } from './game-remote'
import { LocalServer, RemoteServer } from './server'
import { type LibP2PNode } from './index-node-simple'
import type { AbortOptions } from '@libp2p/interface'
import { args } from './utils/args'
import { PeerMap } from '@libp2p/peer-collections'
import type { PeerIdWithData } from './network/pubsub-discovery'
import type { Peer } from './message/peer'
import { LocalGame } from './game-local'
import type { Game } from './game'
import { render } from './ui/remote-view'
import { button, checkbox, form, label, list, type Checkbox, type Form, type Label } from './ui/remote-types'

interface CacheEntry {
    server: RemoteServer
    games: Map<number, {
        game: RemoteGame
        choice: Form
    }>
}

const cache = new PeerMap<CacheEntry>()
const objs = new Map<string, RemoteGame>()
let nextObjId = 0

type Lobby = (game: Game, opts: Required<AbortOptions>) => Promise<void>
type Setup = (game: LocalGame, server: LocalServer, opts: Required<AbortOptions>) => Promise<void>
export async function browser(node: LibP2PNode, lobby: Lobby, setup: Setup, opts: Required<AbortOptions>){

    const ps = node.services.pubsub
    const name = node.peerId.toString().slice(-8)
    const pspd = node.services.pubsubPeerWithDataDiscovery

    type Action = ['join', RemoteGame] | ['host'] | ['quit']

    loop: while(true){
        const view = render<Action>('CustomsBrowser', form({
            Rooms: list(
                getChoices(node),
                args.allowInternet.enabled ?
                    'Waiting for the servers to appear...' :
                    'Waiting for the servers to appear on the local network...',
            ),
            Host: button(() => view.resolve(['host'])),
            Quit: button(() => view.resolve(['quit'])),
        }), opts, [
            {
                regex: /^\.\/Rooms\/(?<objId>\d+)\/Join:pressed$/,
                listener: (m) => {
                    const objId = m.groups!.objId!
                    view.resolve(['join', objs.get(objId)!])
                }
            }
        ])

        view.addEventListener(pspd, 'update', () => {
            view.get('Rooms').setItems(getChoices(node))
        })

        const { 0: action, 1: param } = await view.promise
        if(action == 'host' && ps.isStarted() == false){
            await hostLocal(node, name, lobby, setup, opts)
        }
        if(action == 'host' && ps.isStarted() == true){
            await hostRemote(node, name, lobby, setup, opts)
        }
        if(action == 'join'){
            await joinRemote(param, name, lobby, opts)
        }
        if(action == 'quit'){
            break loop
        }
    }
}

async function hostLocal(node: LibP2PNode, name: string, lobby: Lobby, setup: Setup, opts: Required<AbortOptions>){
    const server = new LocalServer(node)
    const game = new LocalGame(node, server)
    await setup(game, server, opts)
    try {
        await game.startListening(opts)
        game.join(name, undefined)
        await lobby(game, opts)
    } finally {
        game.stopListening()
    }
}

async function hostRemote(node: LibP2PNode, name: string, lobby: Lobby, setup: Setup, opts: Required<AbortOptions>){
    const pspd = node.services.pubsubPeerWithDataDiscovery

    const server = new LocalServer(node)
    const game = new LocalGame(node, server)
    await setup(game, server, opts)
    
    let data: Peer.AdditionalData
    let prevPlayerCount = 0
    try {
        await game.startListening(opts)
        game.join(name, undefined)
        data = {
            name: name,
            serverSettings: server.encode(),
            gameInfos: [ game.encode() ],
        }
        pspd.setData(data)
        pspd_broadcast(true)

        game.addEventListener('update', update)
        game.addEventListener('start', start)
        game.addEventListener('stop', stop)
        
        await lobby(game, opts)

    } finally {
        game.stopListening()

        game.removeEventListener('update', update)
        game.removeEventListener('start', start)
        game.removeEventListener('stop', stop)
        
        pspd.setData(null)
        pspd_broadcast(false)
    }

    function pspd_broadcast(announce: boolean){
        if(announce || pspd.getBroadcastEnabled()){
            pspd.setBroadcastEnabled(announce)
            pspd.broadcast(announce)
        }
    }

    function update(){
        const gi = data.gameInfos[0]!
        gi.players = game.getPlayersCount()
        if(gi.players != prevPlayerCount){
            prevPlayerCount = gi.players
            pspd_broadcast(game.isJoinable())
        }
    }

    function start(){ pspd_broadcast(game.isJoinable()) }
    function stop(){ pspd_broadcast(game.isJoinable()) }
}

async function joinRemote(game: RemoteGame, name: string, lobby: Lobby, opts: Required<AbortOptions>){
    try {
        await game.connect(opts)
        if(game.password.isSet)
            await game.password.uinput(opts)
        game.join(name, game.password.encode())
        await lobby(game, opts)
    } finally {
        game.disconnect()
    }
}

function getChoices(node: LibP2PNode){
    const pspd = node.services.pubsubPeerWithDataDiscovery

    return Object.fromEntries(
        pspd.getPeersWithData()
            .filter(pwd => !!pwd.data?.serverSettings)
            .flatMap(pwd => {
                return peerInfoToChoices(node, pwd)
            })
            .map(choice => [ choice.$id!, choice ])
    )
}

function peerInfoToChoices(node: LibP2PNode, pwd: PeerIdWithData){
    const settings = pwd.data!.serverSettings!

    let cacheEntry = cache.get(pwd.id)
    let server = cacheEntry?.server
    let games = cacheEntry?.games
    if(!cacheEntry || !server || !games){
        server = RemoteServer.create(node, pwd.id, settings)
        games = new Map()
        cacheEntry = { server, games }
        cache.set(pwd.id, cacheEntry)
    } else {
        server.decodeInplace(settings)
    }

    if(!server.validate()) return []

    return pwd.data!.gameInfos.map((gameInfo) => {
        return gameInfoToChoice(node, pwd, server, games, gameInfo)
    })
}

function gameInfoToChoice(
    node: LibP2PNode,
    pwd: PeerIdWithData,
    server: RemoteServer,
    games: CacheEntry['games'],
    gameInfo: Peer.AdditionalData.GameInfo,
){

    let cacheEntry = games.get(gameInfo.id)
    let game = cacheEntry?.game
    let choice = cacheEntry?.choice
    if(!cacheEntry || !game || !choice){
        game = RemoteGame.create(node, server, gameInfo)
        choice = form({
            Owner: label(),
            Name: label(),
            Slots: label(),
            Mode: label(),
            Map: label(),

            Password: checkbox(),
            Manacosts: checkbox(),
            Cooldowns: checkbox(),
            Minions: checkbox(),
            Cheats: checkbox(),

            Join: button(),
        })
        cacheEntry = { game, choice }
        games.set(gameInfo.id, cacheEntry)
    } else {
        game.decodeInplace(gameInfo)
    }

    const players = game.getPlayersCount()
    const playersMax = 2 * (game.playersMax.value ?? 0)

    if(!choice.$id){
        //TODO: game.ownerId + game.index
        const objId = (nextObjId++).toString()
        objs.set(objId, game)
        choice.$id = objId
    }

    (choice.fields!.Owner as Label).text = pwd.id.toString().slice(-8);
    (choice.fields!.Name as Label).text = game.name.toString();
    (choice.fields!.Slots as Label).text = `${players}/${playersMax}`;
    (choice.fields!.Mode as Label).text = game.mode.toString();
    (choice.fields!.Map as Label).text = game.map.toString();
    
    (choice.fields!.Password as Checkbox).button_pressed = game.password.isSet;
    (choice.fields!.Manacosts as Checkbox).button_pressed = game.features.isManacostsEnabled;
    (choice.fields!.Cooldowns as Checkbox).button_pressed = game.features.isCooldownsEnabled;
    (choice.fields!.Minions as Checkbox).button_pressed = game.features.isMinionsEnabled;
    (choice.fields!.Cheats as Checkbox).button_pressed = game.features.isCheatsEnabled;

    return choice
}
