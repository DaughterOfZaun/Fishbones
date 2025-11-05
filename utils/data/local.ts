//import { fs_readdir } from "./data/fs"
//import { gcPkg } from "./data/packages"
//import path from 'node:path'

import { champions, modes } from "../constants"

//TODO: Unhardcode
type MapInfo = {
    id: number
    client: boolean,
    server: boolean,
    modes: number[]
    bots: number[]
}
const hardcodedMaps = [
    {
        id: 1,
        client: true,
        server: true,
        modes: [ 'CLASSIC' ],
        bots: [
            'Soraka',
            'Sivir',
            'Shen',
            'Ryze',
            'Nasus',
            'MasterYi',
            'Malphite',
            'Garen',
            'Annie',
            'Alistar',
        ],
    },
    {
        id: 2,
        client: true,
        server: true,
        modes: [ 'CLASSIC' ],
        bots: [
            'Alistar',
        ],
    },
    {
        id: 4,
        client: true,
        server: true,
        modes: [ 'CLASSIC' ],
        bots: [
            'Soraka',
            'Sivir',
            'Shen',
            'Ryze',
            'Nasus',
            'MasterYi',
            'Malphite',
            'Garen',
            'Annie',
            'Alistar',
        ],
    },
    {
        id: 4,
        client: true,
        server: true,
        modes: [ 'CLASSIC' ],
        bots: [
            'Soraka',
            'Sivir',
            'Shen',
            'Ryze',
            'Nasus',
            'MasterYi',
            'Malphite',
            'Garen',
            'Annie',
            'Alistar',
        ],
    },
    {
        id: 8,
        client: true,
        server: true,
        modes: [ 'ODIN' ],
        bots: [],
    },
].map(map => ({
    id: map.id,
    client: map.client,
    server: map.server,
    modes: map.modes.map(short => modes.find(mode => mode.short == short)!.i),
    bots: map.bots.map(short => champions.find(champion => champion.short === short)!.i),
}))
export const localMaps: Record<number, MapInfo> =
    Object.fromEntries(hardcodedMaps.map(map => [ map.id, map ]))
export const localClientMaps = hardcodedMaps.filter(map => map.client).map(map => map.id)
export const localServerMaps = hardcodedMaps.filter(map => map.server).map(map => map.id)
export const localClientServerMaps = hardcodedMaps.filter(map => map.client && map.server).map(map => map.id)

//export async function readLocalFiles(opts: Required<AbortOptions>) {
//    const dirnames = await fs_readdir(path.join(gcPkg.exeDir, 'LEVELS'), opts)
//    localClientMaps = dirnames.map(dirname => /./.exec(dirname))
//}
