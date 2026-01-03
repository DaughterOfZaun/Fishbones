import { PickableValue } from "./values/pickable"
import { champions } from "./champions"
import { modes } from "./modes"
import { enabled } from "./values/enabled"
import { tr } from "../../translation"

export type MapInfo = {
    i: number
    id: number
    name: string
    existsOnClient: boolean
    existsOnServer: boolean
    enabled: boolean
    modes: number[]
    bots: number[]
}

export type HardcodedMapInfo = {
    id: number
    client: boolean
    server: boolean
    modes: string[]
    bots: string[]
}

// short, name, enabled by default
const mapsTable: [number, string, boolean][] = [
    [0, tr(`Test`), false],
    [1, tr(`Old Summoner's Rift`), true],
    [2, tr(`Old Summoner's Rift Autumn`), true],
    [3, tr(`Proving Grounds`), false],
    [4, tr(`Twisted Treeline`), true],
    [5, tr(`Unknown (5)`), false],
    [6, tr(`Summoner's Rift Winter (2011)`), false],
    [7, tr(`Summoner's Rift Winter (2009)`), false],
    [8, tr(`Crystal Scar`), true],
    [9, tr(`Dominion Test`), false],
    [10, tr(`New Twisted Treeline`), false],
    [11, tr(`New Summoner's Rift`), false],
    [12, tr(`Howling Abyss`), false],
    [13, tr(`Magma Chamber`), false],
    [14, tr(`Butcher's Bridge`), false],
    [15, tr(`Unknown (15)`), false],
    [16, tr(`Cosmic Ruins`), false],
    [17, tr(`Unknown (17)`), false],
    [18, tr(`Valoran City Park`), false],
    [19, tr(`Substructure 43`), false],
    [20, tr(`Crash Site`), false],
    [21, tr(`Temple of Lily and Lotus`), false],
    //[22, tr(`Magma Chamber (recreated in Minecraft)`), false],
    //[30, tr(`Arena: Rings of Wrath`), false],
    [30, tr(`New Proving Grounds`), false],
    [35, tr(`The Bandlewood`), false],
]

export const hardcodedMaps: HardcodedMapInfo[] = [
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
    //{
    //    id: 3,
    //    client: true,
    //    server: true,
    //    modes: [ 'TUTORIAL' ],
    //    bots: [],
    //},
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
]

export let maps: MapInfo[]
const unhardcode = (map: HardcodedMapInfo) => {
    const [, name, ] = mapsTable.find(([ i ]) => i === map.id)!
    return {
        i: map.id,
        id: map.id,
        name: name,
        existsOnClient: map.client,
        existsOnServer: map.server,
        enabled: map.client && map.server,
        modes: map.modes.map(short => modes.find(mode => mode.short == short)!.i),
        bots: map.bots.map(short => champions.find(champion => champion.short === short)!.i),
    }
}

export let mapsById: Map<number, MapInfo>
export let mapsEnabled: number[]

export class GameMap extends PickableValue {
    public static readonly name = 'Game Map'
    public static values: { [k: string]: string }
    public static choices: { value: number, name: string }[]
}
export const GameMapsEnabled = enabled(GameMap)

export function init(){
    maps = hardcodedMaps.map(unhardcode)
    mapsById = new Map(maps.map(map => [ map.id, map ]))
    mapsEnabled = maps.filter(map => map.enabled).map(map => map.id)
    GameMap.values = Object.fromEntries(maps.map(({ i, name }) => ([i, name])))
    GameMap.choices = PickableValue.normalize(GameMap.values)
}

init()
