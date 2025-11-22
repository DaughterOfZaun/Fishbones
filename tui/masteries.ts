import type { AbortOptions } from "@libp2p/interface";
import { render, View } from "../ui/remote/view";
import { button, form, label, list, type Form } from "../ui/remote/types";
import { data, type MastryInfo } from "../utils/data/constants/masteries";

type RuntimeMasteryInfo = MastryInfo & {
    parentInfo?: RuntimeMasteryInfo
    childInfo?: RuntimeMasteryInfo
    tree: RuntimeTreeInfo
    iconDisabled: string
    iconEnabled: string
}

type RuntimeTreeInfo = {
    name: string
    index: number
    points: number
    grid: (RuntimeMasteryInfo | undefined)[]
}

const maxPoints = 30
let points = maxPoints

const page = new Map<number, number>()
const get_rank = (info: RuntimeMasteryInfo) => {
    return page.get(info.id) ?? 0
}
const set_rank = (info: RuntimeMasteryInfo, rank: number) => {
    if(rank === 0) page.delete(info.id)
    else page.set(info.id, rank)
}

const byId = new Map<number, RuntimeMasteryInfo>()
const byPos: RuntimeTreeInfo[] = data.map((staticTree, index) => {
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
        return label(`${get_rank(info)}/${info.ranks}`)
    }

    const cell_tooltip = (info: RuntimeMasteryInfo) => {
        const clampedRankMinusOne = Math.max(0, get_rank(info) - 1)
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
        const req = Math.floor((info.index - 1) / cols) * cols
        const parent = info.parentInfo
        if(tree.points >= req && (!parent || get_rank(parent) === parent.ranks))
            return info.iconEnabled
        return info.iconDisabled
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
                Handle: {
                    $type: 'base',
                    visible: info.parentInfo ? true : undefined,
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
            Return: button(() => {
                setPoints(view, points + tree.points)
                setTreePoints(tree, 0)
                for(const id of [...page.keys()]){
                    const info = byId.get(id)!
                    if(info.tree === tree)
                        setRank(info, 0)
                }
            }),
            Grid: list(Object.fromEntries(entries)),
        })
    }

    const view = render('Masteries', form({
        Play: button(() => view.resolve()),
        Points: label(points.toString()),
        Return: button(() => {
            setPoints(view, maxPoints)
            for(const tree of byPos)
                setTreePoints(tree, 0)
            for(const id of [...page.keys()]){
                const info = byId.get(id)!
                setRank(info, 0)
            }
        }),
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
                //const cellPath = m.groups!.cellPath!
                //const treePath = m.groups!.treePath!
                
                const delta = +1
                const newTreePoints = tree.points + delta
                const newRank = get_rank(info) + delta
                const newPoints = points - delta
                const req = Math.floor((info.index - 1) / cols) * cols
                
                if(tree.points >= req && (!parent || get_rank(parent) === parent.ranks))
                if(newPoints >= 0 && newPoints <= maxPoints)
                if(newRank >= 0 && newRank <= info.ranks){
                    setRank(info, newRank)
                    setPoints(view, newPoints)
                    setTreePoints(tree, newTreePoints)
                }
            },
        }
    ])

    const getTreeElement = (tree: RuntimeTreeInfo) => {
        return view.get(`Trees/${tree.index}_${tree.name}`)
    }
    const getCellElement = (treeElement: View, info: RuntimeMasteryInfo) => {
        return treeElement.get(`Grid/${(info.index - 1)}_${info.id}`)
    }

    function setPoints(_: unknown, newPoints: number){
        points = newPoints
        view.get('Points').update(label(points.toString()))
    }

    function setRank(info: RuntimeMasteryInfo, newRank: number){
        const treeElement = getTreeElement(info.tree)
        const cellElement = getCellElement(treeElement, info)

        set_rank(info, newRank)
        cellElement.update(form({
            Icon: {
                $type: 'button',
                //icon: cell_icon(info, tree),
                tooltip_text: cell_tooltip(info),
            },
            Label: cell_label(info),
        }))
    }

    function setTreePoints(tree: RuntimeTreeInfo, newTreePoints: number){
        const treeElement = getTreeElement(tree)

        const prevTreePoints = tree.points
        tree.points = newTreePoints
        treeElement.get('Points').update(label(tree.points.toString()))

        for(const info of tree.grid){
            if(!info) continue
            const req = Math.floor((info.index - 1) / cols) * cols
            if(
                prevTreePoints < req && newTreePoints >= req ||
                prevTreePoints >= req && newTreePoints < req
            ){
                const cellElement = getCellElement(treeElement, info)

                cellElement.get('Icon').update({
                    $type: 'button',
                    icon: cell_icon(info, tree),
                })
            }
        }
    }

    return view.promise
}
