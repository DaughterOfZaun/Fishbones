import { input } from '@inquirer/prompts'
import { maps, map2str, modes, mode2str } from './constants'
import select from './dynamic-select'
import { Peer as PBPeer } from './peer'
import { TypedEventEmitter, type Libp2p, type PeerId, type Stream } from '@libp2p/interface'
import { PeerMap, PeerSet } from '@libp2p/peer-collections'
import * as lp from 'it-length-prefixed'
import { pbStream, type MessageStream } from 'it-protobuf-stream'
import { pipe } from 'it-pipe'
import { LobbyMessage } from './lobby'
import { logger, type Logger } from '@libp2p/logger'

const PROTOCOL = `/lobby/${0}`

type TeamId = number & { readonly brand: unique symbol };
const TEAM_COUNT = 2

type GameEvents = { update: void }

export abstract class Game extends TypedEventEmitter<GameEvents> {
    protected id: PeerId
    protected node: Libp2p
    protected log: Logger

    protected name: string = `Custom game`
    protected map: number = 1
    protected mode: number = 1
    protected playersMax: number = 5
    //TODO: protected features: number[] = []
    protected password: undefined|boolean|string = undefined

    protected teams: Array<PeerSet> & { [key: TeamId]: PeerSet } = [new PeerSet(), new PeerSet()]
    protected streams = new PeerMap<MessageStream<LobbyMessage, Stream>>

    protected constructor(node: Libp2p, id: PeerId){
        super()
        this.id = id
        this.node = node
        this.log = logger('launcher:game')
    }

    public abstract join(team?: TeamId): void
    public abstract leave(): void
}

export class LocalGame extends Game {

    public static async create(node: Libp2p){
        const opts = new LocalGame(node, node.peerId)
        loop: while(true){
            switch(await select({
                message: 'Select property to edit',
                choices: [
                    { value: 'name', short: 'Name', name: `Name: ${opts.name}` },
                    { value: 'map', short: 'Map', name: `Map: ${map2str(opts.map)}` },
                    { value: 'mode', short: 'Mode', name: `Mode: ${mode2str(opts.mode)}` },
                    { value: 'players', short: 'Players', name: `Players: ${opts.playersMax}v${opts.playersMax}` },
                    //TODO: { value: 'features', short: 'Features', name: `Features: ${opts.features}` },
                    { value: 'password', short: 'Password', name: `Password: ${opts.password}` },
                    { value: 'enter', short: 'Enter', name: 'Enter' }
                ]
            })){
                case 'name': opts.name = await input({ message: 'Enter custom game name', default: opts.name }); break;
                case 'map': opts.map = await select({ message: 'Select custom game map', choices: Object.entries(maps).map(([key, value]) => ({ value: Number(key), name: value })), default: opts.map }); break;
                case 'mode': opts.mode = await select({ message: 'Select custom game mode', choices: Object.entries(modes).map(([key, value]) => ({ value: Number(key), name: value })), default: opts.mode }); break;
                case 'players': opts.playersMax = await select({ message: 'Select custom game players', choices: [1, 2, 3, 4, 5, 6].map(v => ({ value: v, name: `${v}v${v}` })), default: opts.playersMax }); break;
                //TODO: case 'features': opts.name = await input({ message: 'Enter custom game features', default: opts.name }); break;
                case 'password': opts.name = await input({ message: 'Enter custom game password', default: opts.name }); break;
                case 'enter': break loop;
            }
        }
        return opts
    }

    public getData() {
        const opts = this
        let data: PBPeer.AdditionalData = {
            name: opts.name,
            serverSettings: {
                name: 'Server',
                maps: 0,
                modes: 0,
                tickRate: 0,
                champions: []
            },
            gameInfos: [
                {
                    name: opts.name,
                    map: opts.map,
                    mode: opts.mode,
                    players: 1,
                    playersMax: opts.playersMax,
                    features: 0,
                    passwordProtected: !!opts.password
                }
            ],
        }
        return data
    }

    private joined = false
    public join(team?: TeamId){
        this.joinInternal(this.id, team)
        if(!this.joined){
            this.joined = true
            this.node.handle(PROTOCOL, async ({ stream, connection }) => {

                const pbs = pbStream(stream).pb(LobbyMessage)
                this.streams.set(connection.remotePeer, pbs)
                
                try {
                    await pipe(
                        stream,
                        (source) => lp.decode(source),
                        async (source) => {
                            for await (const data of source) {
                                let req = LobbyMessage.decode(data)
                                if(req.join) this.joinInternal(connection.remotePeer)
                                if(req.leave) this.leaveInternal(connection.remotePeer)
                            }
                        }
                    )
                } catch(err: any) {
                    //this.log('connection ended %p', peerId)
                    //this._removePeer(peerId)
                    //stream.abort(err)
                    this.log(err)
                }
            }, /*{ force: true }*/)
        }
    }
    private joinInternal(id: PeerId, team?: TeamId){
        
        console.assert(team === undefined || (team >= 0 && team <= TEAM_COUNT))

        this.remove(id)

        if(team === undefined){
            let playerCounts = this.teams.map(peerIds => peerIds.size)
            //let maxPlayers = playerCounts.reduce((a, c) => Math.max(a, c))
            let minPlayers = playerCounts.reduce((a, c) => Math.min(a, c))
            team = playerCounts.indexOf(minPlayers) as TeamId
        }

        this.teams[team]!.add(id)

        this.streams.forEach((stream, peerId) =>
            /* await */ stream.write({ join: { team } })
            .catch(err => this.log(err))
        )
    }

    public leave(){
        this.leaveInternal(this.id)
        this.node.unhandle(PROTOCOL)
    }
    private leaveInternal(id: PeerId){
        this.remove(id)
    }

    private remove(id: PeerId){
        for(let teamId = 0 as TeamId; teamId < TEAM_COUNT; teamId++){
            let peerIds = this.teams[teamId]!
            peerIds.delete(id)
        }
    }
}

export class RemoteGame extends Game {

    public static async create(node: Libp2p, id: PeerId, gameInfo: PBPeer.AdditionalData.GameInfo){
        let opts = new RemoteGame(node, id)
        opts.name = gameInfo.name
        opts.map = gameInfo.map
        opts.mode = gameInfo.mode
        opts.playersMax = gameInfo.playersMax
        //TODO: opts.features = gameInfo.features
        opts.password = gameInfo.passwordProtected
    }

    public join(team?: TeamId): void {
        throw new Error('Method not implemented.')
    }
    
    public leave(): void {
        throw new Error('Method not implemented.')
    }
}