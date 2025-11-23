import type { AbortOptions } from "@libp2p/interface";
import { DeferredView, render, View } from "../ui/remote/view";
import { button, form, label, line, list, MouseButton, option, type Form } from "../ui/remote/types";
import type { RuntimeMasteryInfo, RuntimePageInfo, RuntimeTreeInfo } from "./masteries/types";
import { MAX_POINTS, page, get_rank, set_rank, pages, page_set } from "./masteries/pages";
import { COLS, ROWS, byId, byPos } from "./masteries/trees";
import { console_log } from "../ui/remote/remote";

const emptyCell = form({
    Inner: {
        $type: 'base',
        visible: false,  
    },
})

function cell_label(info: RuntimeMasteryInfo){
    return label(`${get_rank(info)}/${info.ranks}`)
}

function cell_tooltip(info: RuntimeMasteryInfo){
    const clampedRankMinusOne = Math.max(0, get_rank(info) - 1)
    return info.desc
        .replace(/\|(.+?):?\|/g, "[$1]")
        .replace(/#/g, () => {
            const value = info.rankInfo[clampedRankMinusOne]
            //console.assert(value !== undefined)
            return value?.toString() ?? '??'
        })
}

function cell_icon(info: RuntimeMasteryInfo){
    //return info.rank ? '#ffffff' : '#626262' // Color(0.1, 0.1, 0.1, 0.3)
    const req = Math.floor((info.index - 1) / COLS) * COLS
    const parent = info.parentInfo
    if(info.tree.points >= req && (!parent || get_rank(parent) === parent.ranks))
        return info.iconEnabled
    return info.iconDisabled
}

function tree(tree: RuntimeTreeInfo){
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
                visible: info.childInfo ? true : undefined,
            },
            Icon: {
                $type: 'button',
                icon: cell_icon(info),
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
            setPoints(page, page.points + tree.points)
            setTreePoints(tree, 0)
            for(const id of [...page.talents.keys()]){
                const info = byId.get(id)!
                if(info.tree === tree)
                    setRank(info, 0)
            }
        }),
        Grid: list(Object.fromEntries(entries)),
    })
}

let view: DeferredView<void>
export function prerender(opts: Required<AbortOptions>){
    view = render('Masteries', form({
        //Play: button(() => view.resolve()),
        Play: button(() => view.hide()),
        Points: label(page.points.toString()),
        Return: button(() => {
            setPoints(page, MAX_POINTS)
            for(const tree of byPos)
                setTreePoints(tree, 0)
            for(const id of [...page.talents.keys()]){
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
                Array(ROWS).fill(0).map((e, i) => [ i, form({ Label: label(`${i * COLS}`) }) ])
            )
        ),
        Name: line(page.name, (text) => { page.name = text }),
        Pages: option([...pages.values()].map(page => {
            return {
                id: page.index,
                text: page.name,
            }
        }), page.index, (index) => {
            setPage(index)
        }),
    }), opts, [
        {
            regex: /^\.\/Trees\/(?<treeIndex>\d+)_(?<treeName>\w+)\/Grid\/(?<cellIndex>\d+)_(?<masteryID>\d+)\/Icon:pressed/,
            listener: onCellPressed
        }
    ], true)
}

//TODO: getTreeName
//TODO: getInfoName

function setPage(index: number){
    const prevPage = page
    page_set(pages.get(index)!)

    view.update(form({
        Name: line(page.name),
        Points: label(page.points.toString()),
        Trees: list(
            Object.fromEntries(
                byPos.map((info, i) => [ `${i}_${info.name}`, tree(info) ])
            )
        ),
    }))

    function tree(tree: RuntimeTreeInfo){
        const entries = tree.grid.flatMap(info => {
            if(!info) return []
            if(!page.talents.has(info.index))
            if(!prevPage.talents.has(info.index))
                return []
            const cell = form({
                Icon: {
                    $type: 'button',
                    icon: cell_icon(info),
                    tooltip_text: cell_tooltip(info),
                },
                Label: cell_label(info),
            })
            const entry = [ `${(info.index - 1)}_${info.id}`, cell ]
            return [ entry ] as [ string, Form ][]
        })
        return form({
            Points: label(tree.points.toString()),
            Grid: list(Object.fromEntries(entries))
        })
    }
}

function onCellPressed(m: RegExpMatchArray, button: MouseButton){
    //if(![MouseButton.Left, MouseButton.Right].includes(button)) return

    const treeIndex = parseInt(m.groups!.treeIndex!)
    const masteryID = parseInt(m.groups!.masteryID!)
    const info = byId.get(masteryID)!
    const parent = info.parentInfo
    const tree = byPos[treeIndex]!
    
    const delta =
        (button == MouseButton.Left) ? 1 :
        (button == MouseButton.Right) ? -1 :
        0
    
    const newTreePoints = tree.points + delta
    const newRank = get_rank(info) + delta
    const newPoints = page.points - delta
    const req = Math.floor((info.index - 1) / COLS) * COLS
    
    if(tree.points >= req && (!parent || get_rank(parent) === parent.ranks))
    if(newPoints >= 0 && newPoints <= MAX_POINTS)
    if(newRank >= 0 && newRank <= info.ranks){
        setRank(info, newRank)
        setPoints(page, newPoints)
        setTreePoints(tree, newTreePoints)
        if(info.childInfo){
            updateIcon(info.childInfo)
        }
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function show(opts: Required<AbortOptions>){
    view.show()
}

function getTreeElement(tree: RuntimeTreeInfo){
    return view.get(`Trees/${tree.index}_${tree.name}`)
}
function getCellElement(treeElement: View, info: RuntimeMasteryInfo){
    return treeElement.get(`Grid/${(info.index - 1)}_${info.id}`)
}

function setPoints(page: RuntimePageInfo, newPoints: number){
    page.points = newPoints
    view.get('Points').update(label(page.points.toString()))
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

function updateIcon(info: RuntimeMasteryInfo){
    const treeElement = getTreeElement(info.tree)
    const cellElement = getCellElement(treeElement, info)

    cellElement.update(form({
        Icon: {
            $type: 'button',
            icon: cell_icon(info),
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
        const req = Math.floor((info.index - 1) / COLS) * COLS
        if(
            prevTreePoints < req && newTreePoints >= req ||
            prevTreePoints >= req && newTreePoints < req
        ){
            const cellElement = getCellElement(treeElement, info)

            cellElement.get('Icon').update({
                $type: 'button',
                icon: cell_icon(info),
            })
        }
    }
}
