import { versionFromString } from "../../constants-build"
import { modes, type ModeInfo } from "./modes"
import { champions } from "./champions"
import { spells } from "./spells"
import { maps } from "./maps"
import { tr } from "../../translation"

export type ClientVersion = number & { readonly brand: unique symbol }
const V126 = versionFromString('1.0.0.126')
const V420 = versionFromString('4.20.0.315')
export const KnownClients = {
    Unknown: 0 as ClientVersion,
    "v126": V126 as ClientVersion,
    "v420": V420 as ClientVersion,
    Default: V126 as ClientVersion,
}

export type ServerVersion = number & { readonly brand: unique symbol }
export const KnownServers = {
    Unknown: 0 as ServerVersion,
    "BrokenWings": 1 as ServerVersion,
    "ChronoBreak": 2 as ServerVersion,
    "TestGrounds": 3 as ServerVersion,
    Default: 1 as ServerVersion,
}

export interface Combination {
    client: ClientInfo
    server: ServerInfo
    maps: Map<number, MapInfo>
    spells: Map<number, SpellInfo>
    champions: Map<number, ChampionInfo>
    bots: Map<number, ChampionInfo>
}
export interface ClientInfo extends ClientVersionInfo, ClientExeInfo, ClientDataInfo {}
interface ClientVersionInfo {
    name: string
    version: ClientVersion
}
export interface ClientExeInfo {
    exeDir: string
    exe: string
}
export interface ClientDataInfo {
    maps: Record<number, {}>
    spells: Record<string, { icon: string }>
    champions: Record<string, {
        icon: string,
        skins: Record<number, { image: string }>
    }>
}
export interface ServerInfo extends ServerVersionInfo, ServerExeInfo, ServerDataInfo {}
interface ServerVersionInfo {
    name: string
    version: ServerVersion
}
export interface ServerExeInfo {
    infoDir: string
    dllDir: string
    dll: string
}
export interface ServerDataInfo {
    maps: Record<number, {
        modes: string[],
        bots: string[],
    }>
    spells: Record<string, {}>
    champions: Record<string, {}>
    bots: string[]
}
interface MapInfo {
    i: number
    id: number
    name: string
    modes: Map<number, ModeInfo>
    bots: Map<number, ChampionInfo>
}
interface SpellInfo {
    i: number
    name: string
    short: string
    icon: string
}
interface ChampionInfo {
    i: number
    name: string
    short: string
    icon: string
    skins: Map<number, SkinInfo>
}
interface SkinInfo {
    i: number
    image: string
}

export const clients: Record<ClientVersion, ClientInfo> = {}
export function clients_push(exeInfo: ClientExeInfo, dataInfo: ClientDataInfo, version: ClientVersion, name: string){
    const { exe, exeDir } = exeInfo
    const { maps, spells, champions } = dataInfo
    const client: ClientInfo = {
        exe, exeDir,
        name, version,
        maps: Object.assign({}, maps),
        spells: Object.assign({}, spells),
        champions: Object.assign({}, champions),
    }
    clients[version] = client
    return client
}

export const servers: Record<ServerVersion, ServerInfo> = {}
export function servers_push(exeInfo: ServerExeInfo, dataInfo: ServerDataInfo, version: ServerVersion, name: string){
    const { dll, dllDir, infoDir } = exeInfo
    const { maps, spells, champions, bots } = dataInfo
    const server: ServerInfo = {
        name, version,
        dll, dllDir, infoDir,
        maps: Object.assign({}, maps),
        spells: Object.assign({}, spells),
        champions: Object.assign({}, champions),
        bots: [...bots],
    }
    servers[version] = server
    return server
}

export const combinations: Combination[] = []
export function combinations_push(client: ClientInfo, server: ServerInfo){
    const combo = { client, server, maps: new Map(), spells: new Map(), champions: new Map(), bots: new Map() }
    combinations.push(combo)
    return combo
}

export function combinations_findIndex(client: ClientVersion, server: ServerVersion){
    return combinations.findIndex(combo => combo.client.version == client && combo.server.version == server)
}
export function combinations_find(client: ClientVersion, server: ServerVersion){
    const index = combinations_findIndex(client, server)
    return combinations[index]
}

export function combinations_merge(){

    //HACK:
    const superServer: ServerInfo = {
        name: tr("Unknown"),
        version: KnownServers.Unknown,
        infoDir: "",
        dllDir: "",
        dll: "",
        maps: Object.fromEntries(maps.map(map => {
            const info = {
                modes: modes.map(mode => mode.short),
                bots: champions.map(champ => champ.short),
            }
            return [ map.id, info ]
        })),
        spells: Object.fromEntries(spells.map(spell => [ spell.short, {} ])),
        champions: Object.fromEntries(champions.map(champ => [ champ.short, {} ])),
        bots: champions.map(champ => champ.short)
    }
    for(const client of Object.values(clients))
        combinations_push(client, superServer)

    for(const combo of combinations){
        const { client, server } = combo

        combo.champions = new Map(
            Object.entries(server.champions)
            .filter(([ k, v ]) => k in client.champions)
            .map(([ k, v ]) => {
                const champ = champions.find(champ => champ.short == k)!
                const champion = client.champions[k]!
                const r = {
                    i: champ.i,
                    name: champ.name,
                    short: champ.short,
                    icon: champion.icon,
                    skins: new Map(
                        Object.entries(champion.skins)
                        .map(([ k, v ]) => {
                            const r = {
                                i: Number(k),
                                image: v.image,
                            }
                            return [ r.i, r ]
                        })
                    ),
                }
                return [ r.i, r ] 
            })
        )

        combo.spells = new Map(
            Object.entries(server.spells)
            .filter(([ k, v ]) => k in client.spells)
            .map(([ k, v ]) => {
                const spell = spells.find(spell => spell.short == k)!
                const spe11 = client.spells[k]!
                const r = {
                    i: spell.i,
                    name: spell.name,
                    short: spell.short,
                    icon: spe11.icon,
                }
                return [ r.i, r ]
            })
        )

        combo.maps = new Map(
            Object.entries(server.maps)
            .filter(([ k, v ]) => k in client.maps)
            .map(([ k, server_map ]) => {
                const map = maps.find(map => map.id == Number(k))!
                const champions = [...combo.champions.values()]
                const r = {
                    i: map.i,
                    id: map.id,
                    name: map.name,
                    modes: new Map(
                        server_map.modes
                        .map(short => {
                            const r = modes.find(mode => mode.short == short)!
                            return [ r.i, r ]
                        })
                    ),
                    bots: new Map(
                        server_map.bots
                        .filter(short => short in client.champions)
                        .map(short => {
                            const r = champions.find(champ => champ.short == short)!
                            return [ r.i, r ]
                        })
                    ),
                }
                return [ r.i, r ]
            })
        )

        combo.bots = new Map(
            combo.champions.values()
            .filter(({ short }) => server.bots.includes(short))
            .map((info) => [ info.i, info ])
        )
    }
}
