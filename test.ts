import type { Libp2p } from "@libp2p/interface"
import { LocalGame } from "./game-local"
import { LocalServer } from "./server"
import * as Data from './data'

await Data.repair()

const node = { peerId: { publicKey: {} } } as unknown as Libp2p
const server = LocalServer.create(node)
const game = await LocalGame.create(node, server)

await game.join('Player')
const player = game.getPlayer()!
player.champion.value = 0
player.spell1.value = 0
player.spell2.value = 1
player.lock.value = +true

//await game.start()
//await game.set('champion', 0)
//await game.set('spell1', 0)
//await game.set('spell2', 1)
//await game.set('lock', +true)
//await new Promise((resolve, /*reject*/) => {
//    game.addEventListener('stop', resolve, { once: true, passive: true })
//})

await Data.launchServer(5119, game.getGameInfo())
await Data.launchClient('127.0.0.1', 5119, '17BLOhi6KZsTtldTsizvHg==', 1)
