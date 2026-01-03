import { PickableValue } from "./values/pickable"
import { enabled } from "./values/enabled"
import { tr } from "../../translation"

// short, name, enabled by default
const modesTable: [string, string, boolean][] = [
    ['CLASSIC', tr('Classic'), true],
    ['ARAM', tr('ARAM'), false],
    ['ODIN', tr('ODIN'), true],
    ['TUTORIAL', tr('Tutorial'), false],
]
export const modes = modesTable.map(([ short, name, enabled ], i) => ({ i, short, name, enabled }))
export class GameMode extends PickableValue {
    public static readonly name = tr('Game Mode')
    public static readonly values = modes.map(({ short }) => short)
    public static readonly choices = modes.map(({ i, short, name }) => ({ value: i, short, name }))
}
export const GameModesEnabled = enabled(GameMode)
