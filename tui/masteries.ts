import type { AbortOptions } from "@libp2p/interface";
import { render } from "../ui/remote/view";
import { button, form, label, list, type Form } from "../ui/remote/types";
import { data, type MastryInfo } from "../utils/data/constants/masteries";

type RuntimeMasteryInfo = MastryInfo & {
    parentInfo?: RuntimeMasteryInfo
    icon_disabled: string
    icon_enabled: string
    rank: number
}

type RuntimeTreeInfo = {
    name: string
    points: number
    grid: (RuntimeMasteryInfo | undefined)[]
}

const maxPoints = 30
let points = maxPoints

const byId = new Map<number, RuntimeMasteryInfo>()
const byPos: RuntimeTreeInfo[] = data.map(staticTree => {
    const grid = Array(staticTree.at(-1)?.index ?? 0).fill(undefined)
    return { name: '', grid, points: 0 }
})

byPos[0]!.name = 'Offense'
byPos[1]!.name = 'Defense'
byPos[2]!.name = 'Utility'

let infoIndex = 0
let treeIndex = 0
for(const staticTree of data){
    const byPos_treeIndex_grid = byPos[treeIndex]!.grid
    for(const staticInfo of staticTree){
        
        const icons = 'res://images/mastery-icons.png'
        const info: RuntimeMasteryInfo = Object.assign({
            icon_enabled: `${icons}:${infoIndex * 2}`,
            icon_disabled: `${icons}:${infoIndex * 2 + 1}`,
            parentInfo: undefined,
            rank: 0,
        }, staticInfo)
        
        if(staticInfo.parent !== undefined)
            info.parentInfo = byPos_treeIndex_grid[staticInfo.parent - 1]
        
        byPos_treeIndex_grid[info.index - 1] = info
        byId.set(info.id, info)

        infoIndex++
    }
    treeIndex++
}

const cols = 4
const maxElements = byPos.reduce((a, tree) => Math.max(a, tree.grid.length), 0)
const rows = Math.ceil(maxElements / cols)

export async function masteries(opts: Required<AbortOptions>){

    const emptyCell = form({
        Inner: {
            $type: 'base',
            visible: false,  
        },
    })

    const cell_label = (info: RuntimeMasteryInfo) => {
        return label(`${info.rank}/${info.ranks}`)
    }

    const cell_tooltip = (info: RuntimeMasteryInfo) => {
        const clampedRankMinusOne = Math.max(0, info.rank - 1)
        return info.desc
            .replace(/\|(.+?):?\|/g, "[$1]")
            .replace(/#/g, () => {
                const value = info.rankInfo[clampedRankMinusOne]
                //console.assert(value !== undefined)
                return value?.toString() ?? '??'
            })
    }

    const cell_icon = (info: RuntimeMasteryInfo, tree: RuntimeTreeInfo) => {
        //return info.rank ? '#ffffff' : '#626262' // Color(0.1, 0.1, 0.1, 0.3)
        return (tree.points >= Math.floor(info.index / 4) * cols) ? info.icon_enabled : info.icon_disabled
    }

    const tree = (tree: RuntimeTreeInfo) => {
        let i = 0
        const entries = tree.grid.map(info => {
            if(!info) return [ `${i++}_empty`, emptyCell ]
            const cell = form({
                Inner: {
                  $type: 'base',
                  visible: true,  
                },
                Icon: {
                    $type: 'button',
                    icon: cell_icon(info, tree),
                    tooltip_text: cell_tooltip(info),
                },
                Label: cell_label(info),
            })
            return [ `${i++}_${info.id}`, cell ]
        }) as [ string, Form ][]
        return form({
            Name: label(tree.name),
            Points: label(tree.points.toString()),
            Grid: list(Object.fromEntries(entries))
        })
    }

    const view = render('Masteries', form({
        Play: button(() => view.resolve()),
        Points: label(points.toString()),
        Trees: list(
            Object.fromEntries(
                byPos.map((info, i) => [ `${i}_${info.name}`, tree(info) ])
            )
        ),
        Requirements: list(
            Object.fromEntries(
                Array(rows).fill(0).map((e, i) => [ i, form({ Label: label(`${i * cols}`) }) ])
            )
        ),
    }), opts, [
        {
            regex: /^\.\/(?<cellPath>(?<treePath>Trees\/(?<treeIndex>\d+)_(?<treeName>\w+))\/Grid\/(?<cellIndex>\d+)_(?<masteryID>\d+))\/Icon:pressed/,
            listener: (m) => {

                const treeIndex = parseInt(m.groups!.treeIndex!)
                //const cellIndex = parseInt(m.groups!.cellIndex!)
                const masteryID = parseInt(m.groups!.masteryID!)
                const info = byId.get(masteryID)!
                const parent = info.parentInfo
                const tree = byPos[treeIndex]!
                const cellPath = m.groups!.cellPath!
                const treePath = m.groups!.treePath!
                
                const delta = +1
                const newRank = info.rank + delta
                const newPoints = points - delta
                const req = Math.floor((info.index - 1) / 4) * 4
                
                if(tree.points >= req && (!parent || parent.rank === parent.ranks))
                if(newRank >= 0 && newRank <= info.ranks && newPoints >= 0 && newPoints <= maxPoints){
                    tree.points += delta
                    info.rank += delta
                    points -= delta

                    view.get(treePath).get('Points').update(label(tree.points.toString()))
                    view.get('Points').update(label(points.toString()))
                    view.get(cellPath).update(form({
                        Icon: {
                            $type: 'button',
                            icon: cell_icon(info, tree),
                            tooltip_text: cell_tooltip(info),
                        },
                        Label: cell_label(info),
                    }))
                }
            },
        }
    ])
    return view.promise
}
