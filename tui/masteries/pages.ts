import type { AbortOptions } from "@libp2p/interface";
import { downloads, fs_readFile } from "../../utils/data/fs";
import type { PageInfo, RuntimeMasteryInfo, RuntimePageInfo } from "./types";
import path from 'node:path'
import { byId, byPos } from "./trees";

export const MAX_POINTS = 30

let nextPageIndex = 0
export const pages: Map<number, RuntimePageInfo> = new Map()
for(let i = 0; i < 5; i++) createPage()
export let page: RuntimePageInfo = pages.values().next().value!
export function page_set(to: RuntimePageInfo){
    page = to
    byPos.forEach(tree => {
        tree.points = page.pointsPerTree[tree.index]!
    })
}

function createPage(){
    const page: RuntimePageInfo = {
        name: 'New Page',
        index: nextPageIndex++,
        points: MAX_POINTS,
        pointsPerTree: [0, 0, 0],
        talents: new Map(),
    }
    pages.set(page.index, page)
}

export function get_rank(info: RuntimeMasteryInfo){
    return page.talents.get(info.id) ?? 0
}
export function set_rank(info: RuntimeMasteryInfo, rank: number){
    if(rank === 0) page.talents.delete(info.id)
    else page.talents.set(info.id, rank)
}

export async function load(opts: Required<AbortOptions>){
    const saveFile = await fs_readFile(path.join(downloads, 'mastery-pages.json'), { ...opts, encoding: 'utf8' })
    const staticPages = saveFile ? JSON.parse(saveFile) as PageInfo[] : []
    if(staticPages.length > 0){
        //pages.clear()
        //staticPages.forEach(loadPage)
        //page_set(pages.values().next().value!)
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function loadPage(staticPage: PageInfo, index: number){
    const talents = new Map(Object.entries(staticPage.talents).map(([k, v]) => [ parseInt(k), v ]))
    const pointsPerTree = Array(byPos.length).fill(0) as number[]
    let points = MAX_POINTS
    for(const [id, rank] of talents){
        const info = byId.get(id)!
        pointsPerTree[info.tree.index]! += rank
        points -= rank
    }
    const page = {
        name: staticPage.name,
        pointsPerTree,
        talents,
        points,
        index,
    }
    pages.set(index, page)
}