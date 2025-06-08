import type { Libp2p } from "@libp2p/interface"
import { LocalGame } from "./game-local"
import { LocalServer } from "./server"
import * as Data from './data'
import { ufill } from "./utils/constants"
/*
import { multibar } from "./utils/data-shared"
let current = 0
const bar = multibar.create(10000, 0)
const int = setInterval(() => {
    if(current === 10000)
        clearInterval(int)
    bar.update(++current)
}, 1)
*/
await Data.repair()

const node = { peerId: { publicKey: {} } } as unknown as Libp2p
const server = await LocalServer.create(node)
const game = await LocalGame.create(node, server)

await game.join('Player', undefined)
const player = game.getPlayer()!
await ufill(player)

//await game.start()
//await game.set('champion', 0)
//await game.set('spell1', 0)
//await game.set('spell2', 1)
//await game.set('lock', +true)
//await new Promise((resolve, reject) => {
//    game.addEventListener('stop', resolve, { once: true, passive: true })
//})

await Data.launchServer(5119, game.getGameInfo())
await Data.launchClient('127.0.0.1', 5119, '17BLOhi6KZsTtldTsizvHg==', 1)
//await Data.stopClient()
//await Data.stopServer()
