import { PickableValue } from "./values/pickable"
import { enabled } from "./values/enabled"

// short, name, enabled by default
const modesTable: [string, string, boolean][] = [
    ['CLASSIC', 'Classic', true],
    ['ARAM', 'ARAM', false],
    ['ODIN', 'ODIN', true],
]
export const modes = modesTable.map(([ short, name, enabled ], i) => ({ i, short, name, enabled }))
export class GameMode extends PickableValue {
    public static readonly name = 'Game Mode'
    public static readonly values = modes.map(({ short }) => short)
    public static readonly choices = modes.map(({ i, short, name }) => ({ value: i, short, name }))
}
export const GameModesEnabled = enabled(GameMode)
