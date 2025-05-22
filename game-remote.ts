import { LOBBY_PROTOCOL } from './utils/constants'
import { Peer as PBPeer } from './message/peer'
import { type Libp2p, type Stream, type StreamHandler } from '@libp2p/interface'
import * as lp from 'it-length-prefixed'
import { pbStream, type MessageStream } from 'it-protobuf-stream'
import { pipe } from 'it-pipe'
import { LobbyRequestMessage, LobbyNotificationMessage, PickRequest } from './message/lobby'
import { publicKeyFromProtobuf } from '@libp2p/crypto/keys'
import { peerIdFromPublicKey } from '@libp2p/peer-id'
import { Game } from './game'
import type { Server } from './server'
import { logger } from '@libp2p/logger'

export class RemoteGame extends Game {
    private log = logger('launcher:game-remote')

    public static create(node: Libp2p, server: Server, gameInfo: PBPeer.AdditionalData.GameInfo){
        const game = new RemoteGame(node, server)
        game.decodeInplace(gameInfo)
        return game
    }

    private stream?: MessageStream<LobbyRequestMessage, Stream>
    public async join(name: string) {
        if(this.joined) return true
        try {
            const connection = await this.node.dial(this.id)
            const stream = await connection.newStream([ LOBBY_PROTOCOL ])
            
            this.stream = pbStream(stream).pb(LobbyRequestMessage)
            await this.stream.write({
                joinRequest: { name, roomId: 0 },
            })
            
            this.handleProtocol({ stream, connection })

            return this.joined = true
        } catch(err) {
            this.log.error(err)
            return false
        }
    }
    
    private handleProtocol: StreamHandler = async ({ stream /*, connection*/ }) => {
        
        //if(!connection.remotePeer.equals(this.id)) return
        
        try {
            await pipe(
                stream,
                (source) => lp.decode(source),
                async (source) => {
                    for await (const data of source) {
                        const req = LobbyNotificationMessage.decode(data)

                        if(req.startNotification){
                            this.started = true
                            this.safeDispatchEvent('pick')
                        }
                        if(req.peersRequests.length){
                            for(const r of req.peersRequests){
                                const id = r.publicKey ? peerIdFromPublicKey(publicKeyFromProtobuf(r.publicKey)) : this.node.peerId
                                if(r.joinRequest){
                                    const player = this.players_add(id)
                                    player.name.decodeInplace(r.joinRequest.name)
                                }
                                if(r.leaveNotification){
                                    this.players.delete(id)
                                }
                                if(r.pickRequest){
                                    this.players.get(id)?.decodeInplace(r.pickRequest)
                                }
                            }
                            this.safeDispatchEvent('update')
                        }
                    }
                }
            )
            this.stream = undefined
            this.players.clear()
            this.joined = false
            this.safeDispatchEvent('kick')
        } catch(err) {
            this.log.error(err)
        }
    }
    
    public async leave() {
        //try {
            //await this.stream?.write({ ...lmDefaults, leaveRequest: {} })
            /*await*/ this.stream?.unwrap().unwrap().close()
                .catch(err => this.log.error(err))
            this.stream = undefined
            this.players.clear()
            this.joined = false
        //} catch(err) {
        //    this.log.error(err)
        //}
        return true
    }

    public get canStart(): boolean { return false }
    public async start() { return true }
    public async pick(pr: PickRequest) {
        try {
            await this.stream?.write({
                pickRequest: pr
            })
            return true
        } catch(err) {
            this.log.error(err)
            return false
        }
    }
}
