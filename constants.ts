export const maps: { [key: number]: string } = {
    1: `Old Summoner's Rift`,
    3: `Proving Grounds`,
    8: `Crystal Scar`,
    10: `Twisted Treeline`,
    11: `Summoner's Rift`,
    12: `Howling Abyss`,
    13: `Magma Chamber`,
    14: `Butcher's Bridge`,
    16: `Cosmic Ruins`,
    18: `Valoran City Park`,
    19: `Substructure 43`,
    20: `Crash Site`,
    21: `Temple of Lily and Lotus`,
    30: `Arena: Rings of Wrath`,
    35: `The Bandlewood`,
}
export const map2str = (num: number) => num ? maps[num] || `Map ${num}` : 'Unspecified'

export const modes: { [key: number]: string } = {
    1: 'CLASSIC',
    2: 'ARAM',
}
export const mode2str = (num: number) => num ? modes[num] || `Mode ${num}` : 'Unspecified'