import { PickableValue } from "./values/pickable"
import { champions } from "./champions"
import { modes } from "./modes"
import { enabled } from "./values/enabled"

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
    [0, `Test`, false],
    [1, `Old Summoner's Rift`, true],
    [2, `Old Summoner's Rift Autumn`, true],
    [3, `Proving Grounds`, false],
    [4, `Twisted Treeline`, true],
    [5, `Unknown (5)`, false],
    [6, `Summoner's Rift Winter (2011)`, false],
    [7, `Summoner's Rift Winter (2009)`, false],
    [8, `Crystal Scar`, true],
    [9, `Dominion Test`, false],
    [10, `New Twisted Treeline`, false],
    [11, `New Summoner's Rift`, false],
    [12, `Howling Abyss`, false],
    [13, `Magma Chamber`, false],
    [14, `Butcher's Bridge`, false],
    [15, `Unknown (15)`, false],
    [16, `Cosmic Ruins`, false],
    [17, `Unknown (17)`, false],
    [18, `Valoran City Park`, false],
    [19, `Substructure 43`, false],
    [20, `Crash Site`, false],
    [21, `Temple of Lily and Lotus`, false],
    [30, `Arena: Rings of Wrath`, false],
    [35, `The Bandlewood`, false],
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
