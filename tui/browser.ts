import { RemoteGame } from '../game/game-remote'
import { combinations, combinations_find, KnownServers } from '../utils/data/constants/client-server-combinations'
import { type LibP2PNode } from '../node/node'
import { type AbortOptions } from '@libp2p/interface'
import { args } from '../utils/args'
import { PeerMap } from '@libp2p/peer-collections'
import type { PeerIdWithData } from '../network/libp2p/discovery/pubsub-discovery'
import type { Peer } from '../message/peer'
import { LocalGame } from '../game/game-local'
import { type Game } from '../game/game'
import { render } from '../ui/remote/view'
import { button, form, label, list, type Base, type Button, type Checkbox, type Form, type Label } from '../ui/remote/types'
import { getCustomUsername, getUsername } from '../utils/namegen/namegen'
import type { PingResult } from '../network/libp2p/ping'
import { spinner, AbortPromptError, popup } from '../ui/remote/remote'
import { deadlyRace } from '../utils/promises'
import { bwPkg } from '../utils/data/packages' //TODO: Unhardcode.
import { tr } from '../utils/translation'

interface CacheEntry {
    games: Map<number, {
        game: RemoteGame
        choice: Form
    }>
}

const cache = new PeerMap<CacheEntry>()
const objs = new Map<string, RemoteGame>()
let nextObjId = 0

type Lobby = (game: Game, opts: Required<AbortOptions>) => Promise<void>
type Setup = (game: LocalGame, opts: Required<AbortOptions>) => Promise<void>
export async function browser(node: LibP2PNode, lobby: Lobby, setup: Setup, opts: Required<AbortOptions>){

    //const name = getUsername(node.peerId)
    const name = args.username.value
    const icon = args.usericon.value
    const pspd = node.services.pubsubPeerDiscovery

    let notificationsEnabled = true
    pspd.addEventListener('add', notifyRoomAdded)
    function notifyRoomAdded(event: CustomEvent<PeerIdWithData>){
        const pwd = event.detail
        
        if(!notificationsEnabled) return
        if(pwd.id.toString() === node.peerId.toString()) return

        const choices = peerInfoToChoices(node, pwd)
        for(const choice of choices){
            //const objId = choice.$id!
            //const game = objs.get(objId)
            popup({
                message: (choice.fields!.Map as Label).text!,
                title: tr('New game found'),
                sound: 'air_event_invited_1',
            })
        }
    }

    loop: while(true){
        type Action = ['join', RemoteGame] | ['host'] | ['quit']
        const view = render<Action>('CustomsBrowser', form({
            Rooms: list(
                {}, //getChoices(node),
                args.allowInternet.value ?
                    tr('No games') + '\n' + tr('Wait longer or host your own') :
                    tr('No games on local network') + '\n' + tr('Wait longer or host your own'),
            ),
            HostWarning: label(tr('No servers with suitable clients are installed'), combinations.length == 0),
            Host: button(() => view.resolve(['host']), combinations.length == 0),
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

        notificationsEnabled = true
        const { 0: action, 1: param } = await view.promise
        notificationsEnabled = false

        if(action == 'host'){
            await hostLocal(node, name, icon, lobby, setup, opts)
        }
        if(action == 'join'){
            await joinRemote(param, name, icon, lobby, opts)
        }
        if(action == 'quit'){
            break loop
        }
    }
}

export async function hostLocal(node: LibP2PNode, name: string, icon: number, lobby: Lobby, setup: Setup, opts: Required<AbortOptions>){
    const pspd = node.services.pubsubPeerDiscovery
    const ps = node.services.pubsub

    const game = new LocalGame(node)

    try {
        await setup(game, opts)
    } catch(error) {
        if(error instanceof AbortPromptError) return
        throw error
    }
    
    let prevPlayerCount = 0
    const { gameInfo, serverSettings } = game.encode()
    const data: PartialAdditionalData = {
        serverSettings,
        gameInfos: [ gameInfo ],
    }
    try {
        await game.startListening(opts)
        await game.join(name, icon, undefined, opts)

        if(ps.isStarted() && !game.isPrivate){
            game.addEventListener('update', update)
            game.addEventListener('start', start)
            game.addEventListener('stop', stop)
            pspd_setData(data)
        }

        await lobby(game, opts)

    } finally {
        game.stopListening()

        if(ps.isStarted() && !game.isPrivate){
            game.removeEventListener('update', update)
            game.removeEventListener('start', start)
            game.removeEventListener('stop', stop)
            pspd_setData(null)
        }
    }

    function update(){
        const gi = data.gameInfos[0]!
        gi.players = game.getPlayersCount()
        if(gi.players != prevPlayerCount){
            prevPlayerCount = gi.players
            pspd_setData(game.isJoinable() ? data : null)
        }
    }
    function start(){ pspd_setData(game.isJoinable() ? data: null) }
    function stop(){ pspd_setData(game.isJoinable() ? data : null) }

    type PartialAdditionalData = Pick<Peer.AdditionalData, 'serverSettings' | 'gameInfos'>
    function pspd_setData(data: PartialAdditionalData | null){
        if(data == null)
            data = { serverSettings: undefined, gameInfos: [] }
        const existingData = pspd.getData()
        Object.assign(existingData!, data)
        pspd.setData(existingData)
    }
}

async function joinRemote(game: RemoteGame, name: string, icon: number, lobby: Lobby, opts: Required<AbortOptions>){
    try {
        const isConnected = await deadlyRace([
            async (opts) => spinner({ message: tr('Connecting to host...') }, opts),
            async (opts) => game.connect(opts),
        ], opts)
        if(isConnected){
            if(game.password.isSet)
                await game.password.uinput(opts)
            await deadlyRace([
                async (opts) => spinner({ message: tr('Joining the game...') }, opts),
                async (opts) => game.join(name, icon, game.password.encode(), opts)
            ], opts)
            await lobby(game, opts)
        }
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
        pspd.getListOfReachablePeersWithData()
            .filter(pwd => pwd.data?.serverSettings && pwd.data?.gameInfos && pwd.data?.gameInfos.length > 0)
            .flatMap(pwd => peerInfoToChoices(node, pwd))
            .map(choice => [ choice.$id!, choice ])
    )
}

function peerInfoToChoices(node: LibP2PNode, pwd: PeerIdWithData){
    const { gameInfos, serverSettings } = pwd.data
    if(!serverSettings || !gameInfos || gameInfos.length == 0) return []

    let cacheEntry = cache.get(pwd.id)
    let games = cacheEntry?.games
    if(!cacheEntry || !games){
        games = new Map()
        cacheEntry = { games }
        cache.set(pwd.id, cacheEntry)
    }

    return gameInfos.map((gameInfo) => {
        return gameInfoToChoice(node, pwd, games, gameInfo, serverSettings)
    })
}

function gameInfoToChoice(
    node: LibP2PNode,
    pwd: PeerIdWithData,
    games: CacheEntry['games'],
    gameInfo: Peer.AdditionalData.GameInfo,
    serverSettings: Peer.AdditionalData.ServerSettings,
){

    let cacheEntry = games.get(gameInfo.id)
    let game = cacheEntry?.game
    let choice = cacheEntry?.choice
    if(!cacheEntry || !game || !choice){
        game = new RemoteGame(node, pwd.id)
        choice = form({
            Username: label(),
            Owner: label(),
            Name: label(),
            Ping: label(),
            Slots: label(),
            Mode: label(),
            Map: label(),

            Password: label(),
            Manacosts: label(),
            Cooldowns: label(),
            Minions: label(),
            Cheats: label(),

            Join: button(),
            Explanation: label(),
        })
        cacheEntry = { game, choice }
        games.set(gameInfo.id, cacheEntry)
    }
    try {
        game.decodeInplace(gameInfo, serverSettings)
    } catch(err) {
        //TODO: Handle.
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

    ;(choice.fields!.Username as Label).text = getCustomUsername({ name: { value: pwd.data?.name } })
    ;(choice.fields!.Owner as Label).text = getUsername(pwd.id, true)
    ;(choice.fields!.Ping as Label).text = getPing(pwd.id)?.toFixed()?.concat(' ' + tr('ms')) ?? ''
    ;(choice.fields!.Name as Label).text = game.name.toString()
    ;(choice.fields!.Slots as Label).text = `${players}/${playersMax}`
    ;(choice.fields!.Mode as Label).text = game.mode.toString()
    ;(choice.fields!.Map as Label).text = game.map.toString()
    
    ;(choice.fields!.Password as Checkbox).visible = game.password.isSet
    ;(choice.fields!.Manacosts as Checkbox).visible = game.features.isManacostsEnabled
    ;(choice.fields!.Cooldowns as Checkbox).visible = game.features.isCooldownsEnabled
    ;(choice.fields!.Minions as Checkbox).visible = game.features.isMinionsEnabled
    ;(choice.fields!.Cheats as Checkbox).visible = game.features.isCheatsEnabled

    const commitHashMismatch = game.features.isHalfPingEnabled && game.commit.value != bwPkg.gitRevision
    const dangerOfCrash = game.features.isSpellsEnabled && game.spells.value.length > 0 && args.spellCrashDetected.value
    const clientUnavaible = combinations_find(game.clientVersion, KnownServers.Unknown) == undefined

    let explanation = ''
    if(commitHashMismatch) explanation += tr('The commit (version) of the remote server does not match the commit (version) of your local server') + '\n'
    if(clientUnavaible) explanation += tr('You do not have the client version required to play on this server') + '\n'
    if(dangerOfCrash) explanation += tr('The game client will crash at the beginning of the game') + '\n'

    ;(choice.fields!.Explanation as Base).visible = explanation != ''
    ;(choice.fields!.Explanation as Base).tooltip_text = explanation.trim()
    ;(choice.fields!.Join as Button).disabled = commitHashMismatch || clientUnavaible

    //TODO: ;(choice.fields!.Join as Button).disabled = !localClientMaps.includes(game.map.value!)

    return choice
}
