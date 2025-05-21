import { LOBBY_PROTOCOL, Team, type u } from './utils/constants'
import select from './ui/dynamic-select'
import { Peer as PBPeer } from './message/peer'
import { type Libp2p, type PeerId, type StreamHandler } from '@libp2p/interface'
import * as lp from 'it-length-prefixed'
import { pbStream } from 'it-protobuf-stream'
import { pipe } from 'it-pipe'
import { LobbyRequestMessage, LobbyNotificationMessage, PickRequest } from './message/lobby'
import { publicKeyToProtobuf } from '@libp2p/crypto/keys'
import { Game } from './game'
import type { GamePlayer } from './game-player'

export class LocalGame extends Game {

    private static fieldsToFillOnCreation = ['name', 'map', 'mode', 'playersMax', 'password'] as const
    public static async create(node: Libp2p){
        const game = new LocalGame(node, node.peerId)
        const opts = { clearPromptOnDone: true }
        loop: while(true){
            type Action = ['edit', typeof LocalGame.fieldsToFillOnCreation[number]] | ['enter']
            const [action, key] = await select<Action>({
                message: 'Select property to edit',
                choices: [
                    ...LocalGame.fieldsToFillOnCreation.map(key => (
                        { value: ['edit', key] as Action, short: game[key].name, name: `${game[key].name}: ${game[key].toString()}` }
                    )),
                    { value: ['enter'], short: 'Enter', name: 'Enter' },
                ]
            }, opts)
            if(action == 'edit') await game[key].uinput()
            if(action == 'enter') break loop;
        }
        return game
    }

    public getData() {
        const data: PBPeer.AdditionalData = {
            name: 'Player',
            serverSettings: {
                name: 'Server',
                maps: 0,
                modes: 0,
                tickRate: 0,
                champions: []
            },
            gameInfos: [ this.encode() ],
        }
        return data
    }

    public async join(name: string){
        
        this.joinInternal(this.id, name)

        if(!this.joined){
            this.joined = true
            this.node.handle(LOBBY_PROTOCOL, this.handleProtocol)
        }

        return true
    }
    private handleProtocol: StreamHandler = async ({ stream, connection }) => {
        const peerId = connection.remotePeer
        try {
            await pipe(
                stream,
                (source) => lp.decode(source),
                async (source) => {
                    for await (const data of source) {
                        const req = LobbyRequestMessage.decode(data)
                        let player: u|GamePlayer
                        if(req.joinRequest && (player = this.players_get(peerId))){
                            player.stream = pbStream(stream).pb(LobbyNotificationMessage)
                            this.joinInternal(peerId, req.joinRequest.name)
                        }
                        //if(req.leaveRequest){
                        //    this.leaveInternal(peerId)
                        //}
                        if(req.pickRequests.length && (player = this.players.get(peerId))){
                            player.decodeAllInplace(req.pickRequests)
                            this.safeDispatchEvent('update')
                            this.broadcast({
                                to: this.players.values(),
                                startNotification: false,
                                peersRequests: [{
                                    publicKey: publicKeyToProtobuf(player.id.publicKey!),
                                    pickRequests: req.pickRequests,
                                    leaveNotification: false,
                                }],
                            })
                        }
                    }
                }
            )
            this.leaveInternal(peerId)
        } catch(err) {
            this.log.error(err)
        }
    }
    private joinInternal(id: PeerId, name: string){
        
        console.assert(id.publicKey !== undefined)
        
        const playerCounts: number[] = Array(Team.count).fill(0)
        this.players.forEach(player => {
            const i = player.team.value
            if(i != undefined) playerCounts[i]!++
        })
        const minPlayers = playerCounts.reduce((a, c) => Math.min(a, c))
        const team = playerCounts.indexOf(minPlayers)

        const player = this.players_get(id)!
        player.name.value = name //TODO:
        player.team.value = team //TODO:
        this.safeDispatchEvent('update')

        if(player.id.equals(this.id)) return

        this.broadcast({
            to: this.players.values(),
            ignore: player,
            startNotification: false,
            peersRequests: [{
                publicKey: publicKeyToProtobuf(player.id.publicKey!),
                leaveNotification: false,
                joinRequest: { name: player.name.encode(), },
                pickRequests: [ player.encode('team') ],
            }]
        })
        
        this.broadcast({
            to: [ player ],
            startNotification: false,
            peersRequests: [...this.players.values()].map(player => ({
                publicKey: publicKeyToProtobuf(player.id.publicKey!),
                //TODO: publicKey: new UInt8Array(),
                leaveNotification: false,
                joinRequest: { name: player.name.encode(), },
                pickRequests: player.encodeAll(),
            }))
        })
    }

    private broadcast(msg: LobbyNotificationMessage & { to: Iterable<GamePlayer>, ignore?: GamePlayer }){
        for(const player of msg.to){
            if(player.stream && player !== msg.ignore){
                /* await */ player.stream.write(msg)
                    .catch(err => this.log.error(err))
            }
        }
    }

    public async leave(){
        this.node.unhandle(LOBBY_PROTOCOL)
        for(const player of this.players.values()){
            /*await*/ player?.stream?.unwrap().unwrap().close()
            .catch(err => this.log.error(err))
        }
        this.players.clear()
        this.joined = false
        return true
    }
    private leaveInternal(id: PeerId){
        
        const player = this.players_get(id)!

        //player?.stream?.unwrap().unwrap().close()
        //    .catch(err => this.log.error(err))
        
        this.players.delete(id)
        this.safeDispatchEvent('update')
        
        this.broadcast({
            to: this.players.values(),
            startNotification: false,
            peersRequests: [{
                publicKey: publicKeyToProtobuf(player.id.publicKey!),
                leaveNotification: true,
                pickRequests: [],
            }]
        })
    }

    public get canStart(){ return true }
    public async start(){
        if(!this.started){
            this.started = true
            this.safeDispatchEvent('pick')

            this.broadcast({
                to: this.players.values(),
                startNotification: true,
                peersRequests: [],
            })
        }
        return true
    }

    public async pick(pr: PickRequest){
        const player = this.getPlayer()
        if(!player) return false //TODO:
        //player.decodeInplace(pr)
        this.safeDispatchEvent('update')
        this.broadcast({
            to: this.players.values(),
            startNotification: false,
            peersRequests: [{
                publicKey: publicKeyToProtobuf(player.id.publicKey!),
                leaveNotification: false,
                pickRequests: [ pr ]
            }]
        })
        return true
    }
}
