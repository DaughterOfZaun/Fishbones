import type { RuntimeMasteryInfo, RuntimeTreeInfo } from "../masteries/types";
import { data } from "../../utils/data/constants/masteries";

export const byId = new Map<number, RuntimeMasteryInfo>()
export const byPos: RuntimeTreeInfo[] = data.map((staticTree, index) => {
    const grid = Array(staticTree.at(-1)?.index ?? 0).fill(undefined)
    return { index, name: '', grid, points: 0 }
})

byPos[0]!.name = 'Offense'
byPos[1]!.name = 'Defense'
byPos[2]!.name = 'Utility'

let infoIndex = 0
let treeIndex = 0
for(const staticTree of data){
    const tree = byPos[treeIndex]!
    for(const staticInfo of staticTree){
        
        const icons = 'res://images/mastery-icons.png'
        const info: RuntimeMasteryInfo = Object.assign({
            iconEnabled: `${icons}:${infoIndex * 2}`,
            iconDisabled: `${icons}:${infoIndex * 2 + 1}`,
            parentInfo: undefined,
            tree,
        }, staticInfo)
        
        if(info.parent !== undefined){
            const parentID = staticTree[info.parent]!.id
            const parent = byId.get(parentID)!
            info.parentInfo = parent
            parent.childInfo = info
        }
        
        tree.grid[info.index - 1] = info
        byId.set(info.id, info)

        infoIndex++
    }
    treeIndex++
}

export const COLS = 4
export const MAX_ELEMENTS = byPos.reduce((a, tree) => Math.max(a, tree.grid.length), 0)
export const ROWS = Math.ceil(MAX_ELEMENTS / COLS)
