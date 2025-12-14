import { RemoteGame } from '../game/game-remote'
import { LocalServer, RemoteServer } from '../game/server'
import { type LibP2PNode } from '../node/node'
import { AbortError, type AbortOptions } from '@libp2p/interface'
import { args } from '../utils/args'
import { PeerMap } from '@libp2p/peer-collections'
import type { PeerIdWithData } from '../network/libp2p/discovery/pubsub-discovery'
import type { Peer } from '../message/peer'
import { LocalGame } from '../game/game-local'
import type { Game } from '../game/game'
import { render } from '../ui/remote/view'
import { button, checkbox, form, label, list, type Checkbox, type Form, type Label } from '../ui/remote/types'
import { getUsername } from '../utils/namegen/namegen'
import type { PingResult } from '../network/libp2p/ping'
import { spinner, AbortPromptError, popup } from '../ui/remote/remote'

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
    const name = '' //getUsername(node.peerId.toString())
    const pspd = node.services.pubsubPeerDiscovery

    pspd.addEventListener('add', notifyRoomAdded)
    function notifyRoomAdded(event: CustomEvent<PeerIdWithData>){
        const pwd = event.detail
        
        if(pwd.id.toString() === node.peerId.toString()) return

        const choices = peerInfoToChoices(node, pwd)
        for(const choice of choices){
            //const objId = choice.$id!
            //const game = objs.get(objId)
            popup({
                message: (choice.fields!.Map as Label).text!,
                title: 'New game found',
                sound: 'air_event_invited_1',
            })
        }
    }

    type Action = ['join', RemoteGame] | ['host'] | ['quit']

    loop: while(true){
        const view = render<Action>('CustomsBrowser', form({
            Rooms: list(
                {}, //getChoices(node),
                args.allowInternet.enabled ?
                    'No games\nWait longer or host your own' :
                    'No games on local network\nWait longer or host your own',
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

        let choices: ReturnType<typeof getChoices>
        updateDynamicElements()
        view.addEventListener(pspd, 'update', updateDynamicElements)
        function updateDynamicElements(){
            choices = getChoices(node)
            view.get('Rooms').setItems(choices)
        }
        view.addEventListener(node.services.ping, 'ping', (event: CustomEvent<PingResult>) => {
            const { peerId, ms } = event.detail
            const id = Object.keys(choices).find((id) => {
                return objs.get(id)?.ownerId.toString() === peerId.toString()
            })
            if(id !== undefined){
                view.get(`Rooms/${id}/Ping`)
                    .update(label(ms?.toFixed()?.concat(' ms') ?? ''))
            }
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

    try {
        await setup(game, server, opts)
    } catch(error) {
        if(error instanceof AbortPromptError) return
        throw error
    }
    
    try {
        await game.startListening(opts)
        await game.join(name, undefined, opts)
        await lobby(game, opts)
    } finally {
        game.stopListening()
    }
}

async function hostRemote(node: LibP2PNode, name: string, lobby: Lobby, setup: Setup, opts: Required<AbortOptions>){
    const pspd = node.services.pubsubPeerDiscovery

    const server = new LocalServer(node)
    const game = new LocalGame(node, server)

    try {
        await setup(game, server, opts)
    } catch(error) {
        if(error instanceof AbortPromptError) return
        throw error
    }
    
    let data: Peer.AdditionalData
    let prevPlayerCount = 0
    try {
        await game.startListening(opts)
        await game.join(name, undefined, opts)
        data = {
            name: name,
            serverSettings: server.encode(),
            gameInfos: [ game.encode() ],
        }
        pspd.setData(data)

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
    }

    function update(){
        const gi = data.gameInfos[0]!
        gi.players = game.getPlayersCount()
        if(gi.players != prevPlayerCount){
            prevPlayerCount = gi.players
            pspd.setData(game.isJoinable() ? data : null)
        }
    }
    function start(){ pspd.setData(game.isJoinable() ? data: null) }
    function stop(){ pspd.setData(game.isJoinable() ? data : null) }
}

async function deadlyRace(cbs: ((opts: Required<AbortOptions>) => Promise<unknown>)[], opts: Required<AbortOptions>){
    return new Promise((resolve, reject) => {
        const controller = new AbortController()
        const signal = AbortSignal.any([ controller.signal, opts.signal ])
        void Promise.race(cbs.map(async cb => {
            return cb({ signal }).catch((reason: Error) => {
                if(controller.signal.aborted) return // Ignore.
                controller.abort(reason)
                reject(reason)
            })
        })).then((result) => {
            controller.abort(new AbortError())
            resolve(result)
        })
    })
}

async function joinRemote(game: RemoteGame, name: string, lobby: Lobby, opts: Required<AbortOptions>){
    try {
        await deadlyRace([
            async (opts) => spinner({ message: 'Connecting to host...' }, opts),
            async (opts) => game.connect(opts),
        ], opts)
        if(game.password.isSet)
            await game.password.uinput(opts)
        await deadlyRace([
            async (opts) => spinner({ message: 'Joining the game...' }, opts),
            async (opts) => game.join(name, game.password.encode(), opts)
        ], opts)
        await lobby(game, opts)
    } catch(err) {
        if(err instanceof AbortPromptError){ /* Ignore. */ }
        else throw err
    } finally {
        game.disconnect()
    }
}

function getChoices(node: LibP2PNode){
    const pspd = node.services.pubsubPeerDiscovery

    return Object.fromEntries(
        pspd.getPeersWithData()
            .flatMap(pwd => peerInfoToChoices(node, pwd))
            .map(choice => [ choice.$id!, choice ])
    )
}

function peerInfoToChoices(node: LibP2PNode, pwd: PeerIdWithData){
    const settings = pwd.data.serverSettings
    if(!settings) return []

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

    return pwd.data.gameInfos.map((gameInfo) => {
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
            Ping: label(),
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

    const getPing = game.node.services.ping.getPing.bind(game.node.services.ping);

    (choice.fields!.Owner as Label).text = getUsername(pwd.id);
    (choice.fields!.Ping as Label).text = (getPing(pwd.id)?.toFixed()?.concat(' ms') ?? '');
    (choice.fields!.Name as Label).text = game.name.toString();
    (choice.fields!.Slots as Label).text = `${players}/${playersMax}`;
    (choice.fields!.Mode as Label).text = game.mode.toString();
    (choice.fields!.Map as Label).text = game.map.toString();
    
    (choice.fields!.Password as Checkbox).button_pressed = game.password.isSet;
    (choice.fields!.Manacosts as Checkbox).button_pressed = game.features.isManacostsEnabled;
    (choice.fields!.Cooldowns as Checkbox).button_pressed = game.features.isCooldownsEnabled;
    (choice.fields!.Minions as Checkbox).button_pressed = game.features.isMinionsEnabled;
    (choice.fields!.Cheats as Checkbox).button_pressed = game.features.isCheatsEnabled;

    //TODO: (choice.fields!.Join as Button).disabled = !localClientMaps.includes(game.map.value!);

    return choice
}
