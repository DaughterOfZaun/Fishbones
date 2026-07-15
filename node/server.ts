import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { identify, identifyPush } from '@libp2p/identify'
import { customPing } from '../network/libp2p/ping'
import { webRTCDirect } from '@libp2p/webrtc'
import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { patchedCrypto as crypto } from '../utils/crypto'
//import { defaultLogger } from '@libp2p/logger'
import { GossipSub, gossipsub, type GossipSubComponents } from '@chainsafe/libp2p-gossipsub'
import { appDiscoveryTopic, rtcConfiguration } from '../utils/constants-build'
//import { rendezvousServer } from "@canvas-js/libp2p-rendezvous/server"
import { circuitRelayServer } from '@libp2p/circuit-relay-v2'
import fs from 'node:fs/promises'
import { generateKeyPair, privateKeyFromRaw } from '@libp2p/crypto/keys'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { pubsubPeerDiscovery } from '../network/libp2p/discovery/pubsub-discovery'
import { pinning } from '../network/libp2p/pinning'
import { time } from '../utils/proxy/time'
import type { AbortOptions, PrivateKey } from '@libp2p/interface'
import { LocalGame } from '../game/game-local'
import { proxy } from '../utils/proxy/strategy-libp2p'
import { probe } from '../network/libp2p/probe'
import type { LibP2PNode } from './node'
import { hostLocal } from '../tui/browser'
import { safeOptions, shutdownOptions } from '../utils/process/process'
import type { Game } from '../game/game'
import { Features } from '../utils/constants'
import { KnownClients, KnownServers } from '../utils/data/constants/client-server-combinations'
import { Deferred } from '../utils/promises'
import { stopServer } from '../utils/process/server'
import { logger } from '../utils/log'
import { inspect } from 'node:util'
//import { peerIdFromPrivateKey } from '@libp2p/peer-id'

const UDP_PORT = 42451
const TCP_PORT = 41463

const KEY_FILE = './keys/server-key-1.txt'
const KEY_ENCODING = 'base64pad'

let keyString: string
let privateKey: PrivateKey
try {
    keyString = await fs.readFile(KEY_FILE, 'utf8')
    privateKey = privateKeyFromRaw(uint8ArrayFromString(keyString, KEY_ENCODING))
} catch {
    privateKey = await generateKeyPair('Ed25519')
    keyString = uint8ArrayToString(privateKey.raw, KEY_ENCODING)
    await fs.writeFile(KEY_FILE, keyString, 'utf8')
}

//console.log(uint8ArrayToString(privateKey.publicKey.raw, KEY_ENCODING))
//console.log(peerIdFromPrivateKey(privateKey).toString())
//process.exit()

const node = await createLibp2p({
    privateKey,
    nodeInfo: {
        //name: NAME,
        //version: VERSION,
        //userAgent: `${NAME}/${VERSION}`
    },
    addresses: {
        listen: [
            `/ip4/0.0.0.0/udp/${UDP_PORT}/webrtc-direct`,
            `/ip4/0.0.0.0/tcp/${TCP_PORT}`,
        ]
    },
    transports: [
        webRTCDirect({ rtcConfiguration }),
        tcp(),
    ],
    connectionEncrypters: [
        noise({ crypto }),
    ],
    streamMuxers: [
        yamux(),
    ],
    connectionGater: {
        denyDialMultiaddr: () => false,
    },
    services: {
        identify: identify(),
        identifyPush: identifyPush(),

        //logger: defaultLogger,
        
        ping: customPing(),
        probe: probe({
            port: 5119
        }),

        relay: circuitRelayServer(),
        
        //rendezvous: rendezvousServer({}),

        //@ts-expect-error Property '[symbol]' is missing in type 'Uint8ArrayList'
        pubsub: gossipsub({
            allowedTopics: [ appDiscoveryTopic ],
            allowPublishToZeroTopicPeers: true,
            emitSelf: true,
            doPX: true,
        }) as (components: GossipSubComponents) => GossipSub,
        pubsubPeerDiscovery: pubsubPeerDiscovery({
            topic: appDiscoveryTopic,
        }),
        pinning: pinning(),

        //mdns: mdns(),

        proxy: proxy(),
        time: time({
            enableSync: false,
        }),
    }
})

console.log(node.getMultiaddrs().map(ma => ma.toString()))

interface Timeout {
    id: ReturnType<typeof setTimeout>
    startedAt: number
}

const SEC = 1000
const MIN = 60 * SEC
const GATHER_TIMEOUT = 60 * SEC
const START_TIMEOUT = 5 * SEC
const PICK_TIMEOUT = 60 * SEC
const PLAY_TIMEOUT = 60 * MIN
const ZERO_PLAYERS = 1

const opts = shutdownOptions
const name = 'Manager Bot', icon = 0
await hostLocal(node as unknown as LibP2PNode, name, icon, setup, lobby, opts)

// eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
async function setup(game: Game, opts: Required<AbortOptions>){

    game.features.set(Features.SPELLS_DISABLED, true)
    game.features.set(Features.BYPASS_ENABLED, true)

    game.name.value = 'Automatic Game'
    game.map.value = 4 //HACK: Twisted Threeline
    game.mode.value = 0 //HACK: Classic
    game.playersMax.value = 3
    game.serverVersion = KnownServers.BrokenWings
    game.clientVersion = KnownClients.v126
}

async function lobby(game: LocalGame, opts: Required<AbortOptions>){

    const maxPlayers = 2 * game.playersMax.value!
    let prevPlayerCount = game.getPlayersCount()
    let playerCount = ZERO_PLAYERS

    let deferred: Deferred<void>

    function createTimeout(ms: number){
        return {
            startedAt: Date.now(),
            id: setTimeout(() => deferred!.resolve(), ms),
        }
    }
    function removeTimeout(timeout?: Timeout){
        clearTimeout(timeout?.id)
        return undefined
    }

    for(;;){

        deferred = new Deferred(opts)

        let gatherTimeout: Timeout | undefined
        let startTimeout: Timeout | undefined
        deferred.addCleanupCallback(() => {
            removeTimeout(gatherTimeout)
            removeTimeout(startTimeout)
        })

        deferred.addEventListener(game, 'update', () => checkPlayerCount())
        prevPlayerCount = ZERO_PLAYERS
        checkPlayerCount()

        function checkPlayerCount(){
            
            prevPlayerCount = playerCount
            playerCount = game.getPlayersCount()
            
            if(prevPlayerCount <= ZERO_PLAYERS && playerCount > ZERO_PLAYERS)
                gatherTimeout = createTimeout(GATHER_TIMEOUT)
            if(prevPlayerCount > ZERO_PLAYERS && playerCount <= ZERO_PLAYERS)
                gatherTimeout = removeTimeout(gatherTimeout)
            
            if(playerCount >= maxPlayers && prevPlayerCount < maxPlayers)
                startTimeout = createTimeout(START_TIMEOUT)
            if(playerCount < maxPlayers && prevPlayerCount >= maxPlayers)
                startTimeout = removeTimeout(startTimeout)
            
            const timeout = startTimeout ?? gatherTimeout
            if(timeout && playerCount != prevPlayerCount){
                let msg = ''
                if(startTimeout){
                    msg += `Waiting for the game to start...`
                } else if(gatherTimeout){
                    msg += `Waiting for the players to gather...`
                    msg += ` (${playerCount}/${maxPlayers})`
                }
                const sec = Math.round((Date.now() - timeout.startedAt) / SEC)
                msg += ` (${sec} sec remain)`
                game.appendToChat(msg)
            }
        }

        await deferred.promise
        
        game.autofill()
        game.start()

        game.set('lock', +true)

        deferred = new Deferred(opts)
        deferred.setTimeout(() => game.forceLaunch(), PICK_TIMEOUT)
        deferred.addEventListener(game, 'launch', () => deferred.resolve())
        {
            const sec = Math.round(PICK_TIMEOUT / SEC)
            const msg = `Waiting for the players to lock... (${sec} sec remain)`
            game.appendToChat(msg)
        }

        await deferred.promise

        deferred = new Deferred(opts)
        deferred.setTimeout(() => {
            stopServer(safeOptions).catch(err => {
                logger.log('An error occurred when stopping the server:', inspect(err))
            })
        }, PLAY_TIMEOUT)
        deferred.addEventListener(game, 'stop', () => deferred.resolve)
        {
            const sec = Math.round(PLAY_TIMEOUT / SEC)
            const msg = `Waiting for the game to end... (${sec} sec remain)`
            game.appendToChat(msg)
        }

        await deferred.promise
    }
}
