import { GameMap as GameMap, GameMode as GameMode, Name, Password, PlayerCount, Team, type u } from './utils/constants'
import { TypedEventEmitter, type Libp2p, type PeerId, type Stream } from '@libp2p/interface'
import { PeerMap } from '@libp2p/peer-collections'
import { GamePlayer, type PPP } from './game-player'
import type { Peer as PBPeer } from './message/peer'
import type { Server } from './server'
import { LobbyNotificationMessage, PickRequest, type LobbyRequestMessage } from './message/lobby'
import { peerIdFromPublicKey } from '@libp2p/peer-id'
import { publicKeyFromProtobuf, publicKeyToProtobuf } from '@libp2p/crypto/keys'
import { pbStream } from 'it-protobuf-stream'

type GameEvents = {
    update: void,
    kick: void,
    pick: void,
}
/*
enum State {
    Disconnected,
    Connected,
    Joined,
    Started,
    Launched,
}
*/
export type BroadcastOpts = { to: Iterable<GamePlayer>, ignore?: GamePlayer }

export abstract class Game extends TypedEventEmitter<GameEvents> {
    
    protected readonly node: Libp2p
    public readonly server: Server
    public readonly ownerId: PeerId
    
    public readonly name = new Name(`Custom Game`)
    public readonly map = new GameMap(1, () => this.server.maps)
    public readonly mode = new GameMode(0, () => this.server.modes)
    public readonly playersMax = new PlayerCount(5)
    public readonly password = new Password()

    protected players: PeerMap<GamePlayer> = new PeerMap<GamePlayer>()
    protected players_size: number = 0
    protected players_add(id: PeerId): GamePlayer {
        let player = this.players.get(id)
        if(!player){
            player = new GamePlayer(this, id)
            this.players.set(id, player)
        }
        return player
    }
    public getPlayers(){
        return [...this.players.values()]
    }
    public getPlayer(){
        return this.players.get(this.node.peerId)
    }
    public getPlayersCount(){
        return this.joined ? this.players.size : this.players_size
    }

    protected constructor(node: Libp2p, ownerId: PeerId, server: Server){
        super()
        this.node = node
        this.server = server
        this.ownerId = ownerId
    }

    protected connected = false
    protected joined = false
    protected started = false
    protected launched = false
    
    public get isStarted(){ return this.started }

    public abstract get canStart(): boolean
    //public abstract get canKick(): boolean

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected stream_write(req: LobbyRequestMessage): Promise<boolean> {
        throw new Error("Method not implemented")
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected broadcast(msg: LobbyNotificationMessage & BroadcastOpts): void {
        throw new Error("Method not implemented")
    }

    public async join(name: string): Promise<boolean> {

        if(!this.connected) return false
        if(this.joined) return true

        return this.joined = await this.stream_write({
            joinRequest: { name },
        })
    }
    private handleJoinRequest(player: GamePlayer, { name }: LobbyRequestMessage.JoinRequest) {
        
        //console.assert(player.id.publicKey !== undefined)
        
        const playerCounts: number[] = Array(Team.count).fill(0)
        this.players.forEach(player => {
            const i = player.team.value
            if(i != undefined) playerCounts[i]!++
        })
        const minPlayers = playerCounts.reduce((a, c) => Math.min(a, c))
        const team = playerCounts.indexOf(minPlayers)

        player.name.decodeInplace(name)
        player.team.value = team

        this.broadcast({
            to: this.players.values(),
            ignore: player,
            peersRequests: [{
                publicKey: publicKeyToProtobuf(player.id.publicKey!),
                joinRequest: { name: player.name.encode(), },
                pickRequest: player.encode('team'),
            }]
        })
        
        this.broadcast({
            to: [ player ],
            peersRequests: [...this.players.values()].map(player => ({
                publicKey: publicKeyToProtobuf(player.id.publicKey!),
                joinRequest: { name: player.name.encode(), },
                pickRequest: player.encode(),
            }))
        })
    }
    private handleJoinResponse(player: GamePlayer, res: LobbyNotificationMessage.JoinRequest){
        player.name.decodeInplace(res.name)
        this.safeDispatchEvent('update')
    }

    public async start(){
        if(this.started) return true
        
        this.started = true
        this.broadcast({
            to: this.players.values(),
            startRequest: true,
            peersRequests: [],
        })
        return true
    }
    private handleStartResponse(){
        this.started = true
        this.safeDispatchEvent('pick')
    }
    
    public async pick(prop: PPP, controller: AbortController) {
        const player = this.getPlayer()
        if(!player) return false
        const pdesc = player[prop]
        await pdesc.uinput(controller)
        return await this.set(prop, pdesc.value)
    }
    public async set(prop: PPP, value: u|number){
        const player = this.getPlayer()
        if(!player) return false

        //if(value !== undefined)
        player[prop].value = value

        return await this.stream_write({
            pickRequest: player.encode(prop)
        })
    }
    private handlePickRequest({ id }: GamePlayer, req: PickRequest){
        //if(!this.started) return false
        this.broadcast({
            to: this.players.values(),
            peersRequests: [{
                publicKey: publicKeyToProtobuf(id.publicKey!),
                pickRequest: req
            }]
        })
    }
    private handlePickResponse(player: GamePlayer, res: PickRequest){
        player.decodeInplace(res)
        this.safeDispatchEvent('update')
    }

    private handleLeaveRequest(player: GamePlayer){
        
        //player?.stream?.unwrap().unwrap().close()
        //    .catch(err => this.log.error(err))
        
        this.players.delete(player.id)
        
        this.broadcast({
            to: this.players.values(),
            peersRequests: [{
                publicKey: publicKeyToProtobuf(player.id.publicKey!),
                leaveRequest: true,
            }]
        })
    }
    private handleLeaveResponse(player: GamePlayer){
        this.players.delete(player.id)
        this.safeDispatchEvent('update')
    }

    public encode() {
        return {
            id: 0,
            name: this.name.encode(),
            map: this.map.encode(),
            mode: this.mode.encode(),
            players: this.players.size,
            playersMax: this.playersMax.encode(),
            features: 0,
            passwordProtected: this.password.isSet(),
        }
    }
    public decodeInplace(gi: PBPeer.AdditionalData.GameInfo): boolean {
        let ret = true
            ret &&= this.name.decodeInplace(gi.name)
            ret &&= this.map.decodeInplace(gi.map)
            ret &&= this.mode.decodeInplace(gi.mode)
            this.players_size = gi.players
            ret &&= this.playersMax.decodeInplace(gi.playersMax)
        this.password.value = gi.passwordProtected ? '' : undefined
        return ret
    }

    protected handleRequest(peerId: PeerId, req: LobbyRequestMessage, stream: u|Stream){
        let player: u|GamePlayer
        if(req.joinRequest && (player = this.players_add(peerId))){
            if(stream)
                player.stream = pbStream(stream).pb(LobbyNotificationMessage)
            this.handleJoinRequest(player, req.joinRequest)
        }
        if(req.pickRequest && (player = this.players.get(peerId))){
            this.handlePickRequest(player, req.pickRequest)
        }
        if(req.leaveRequest && (player = this.players.get(peerId))){
            this.handleLeaveRequest(player)
        }
    }
    protected handleResponse(ress: LobbyNotificationMessage){
        if(ress.peersRequests.length){
            for(const res of ress.peersRequests){
                let player: u|GamePlayer
                const peerId = peerIdFromPublicKey(publicKeyFromProtobuf(res.publicKey))
                if(res.joinRequest && (player = this.players_add(peerId))){
                    this.handleJoinResponse(player, res.joinRequest)
                }
                if(res.pickRequest && (player = this.players.get(peerId))){
                    this.handlePickResponse(player, res.pickRequest)
                }
                if(res.leaveRequest && (player = this.players.get(peerId))){
                    this.handleLeaveResponse(player)
                }
            }
        }
        if(ress.startRequest){
            this.handleStartResponse()
        }
    }
}
