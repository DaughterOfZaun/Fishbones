import { show } from './ui/remote'
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

interface CacheEntry {
    server: RemoteServer
    games: Map<number, {
        game: RemoteGame
        choice: Record<string, number | Record<string, string | number | boolean>>
        //choice: Partial<GameDesc>
    }>
}
/*
interface GameDesc {
    name: string
    owner: string
    slots: string
    map: string
    mode: string
    
    password: boolean
    manacosts: boolean
    minions: boolean
    cooldowns: boolean
    cheats: boolean

    value: number
}
*/
const cache = new PeerMap<CacheEntry>()
const objs = new Map<number, RemoteGame>()
let objId = 0

type Lobby = (game: Game, opts: Required<AbortOptions>) => Promise<void>
type Setup = (game: LocalGame, server: LocalServer, opts: Required<AbortOptions>) => Promise<void>
export async function browser(node: LibP2PNode, lobby: Lobby, setup: Setup, opts: Required<AbortOptions>){

    const ps = node.services.pubsub
    const name = node.peerId.toString().slice(-8)
    const pspd = node.services.pubsubPeerWithDataDiscovery

    type Action = ['join', RemoteGame] | ['host'] | ['quit']

    loop: while(true){
        const view = show<Action>('CustomsBrowser', {
            Rooms: {
                choices: getChoices(node),
                default: args.allowInternet.enabled ?
                    'Waiting for the servers to appear...' :
                    'Waiting for the servers to appear on the local network...',
            }
        }, {
            'Join.pressed': (objId: number) => view.resolve(['join', objs.get(objId)!]),
            'Host.pressed': () => view.resolve(['host']),
            'Quit.pressed': () => view.resolve(['quit']),
        }, opts)

        view.addEventListener(pspd, 'update', () => {
            view.call('update', {
                Rooms: {
                    choices: getChoices(node),
                }
            })
        })

        const { 0: action, 1: param } = await view.promise
        if(action == 'host' && ps.isStarted() == false){
            await hostLocal(node, name, lobby, setup, opts)
        }
        if(action == 'host' && ps.isStarted() == true){
            await hostRemote(node, name, lobby, setup, opts)
        }
        if(action == 'join'){
            await join(param, name, lobby, opts)
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

async function join(game: RemoteGame, name: string, lobby: Lobby, opts: Required<AbortOptions>){
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

    return pspd.getPeersWithData()
        .filter(pwd => !!pwd.data?.serverSettings)
        .flatMap(pwd => {
            return peerInfoToChoices(node, pwd)
        })
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
        return gameInfoToChoices(node, pwd, server, games, gameInfo)
    })
}

function gameInfoToChoices(
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
        choice = {}
        cacheEntry = { game, choice }
        games.set(gameInfo.id, cacheEntry)
    } else {
        game.decodeInplace(gameInfo)
    }

    const players = game.getPlayersCount()
    const playersMax = 2 * (game.playersMax.value ?? 0)

    choice.Owner = { text: pwd.id.toString().slice(-8) }
    //gameDesc.server = server.name.toString()
    choice.Name = { text: game.name.toString() }
    choice.Slots = { text: `${players}/${playersMax}` }
    choice.Mode = { text: game.mode.toString() }
    choice.Map = { text: game.map.toString() }
    
    choice.Password = { button_pressed: game.password.isSet }
    choice.Manacosts = { button_pressed: game.features.isManacostsEnabled }
    choice.Cooldowns = { button_pressed: game.features.isCooldownsEnabled }
    choice.Minions = { button_pressed: game.features.isMinionsEnabled }
    choice.Cheats = { button_pressed: game.features.isCheatsEnabled }
    
    //gameDesc.ping = Math.min(100, 999)

    if(!choice.id){
        objs.set(objId, game)
        choice.id = objId
        objId++
    }
    return choice as Record<string, string | number>
}
