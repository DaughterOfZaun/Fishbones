import type { AbortOptions } from "@libp2p/interface";
import { downloads, fs_readFile, fs_writeFile } from "../../utils/data/fs";
import type { PageInfo, RuntimeMasteryInfo, RuntimePageInfo, RuntimeTreeInfo } from "./types";
import path from 'node:path'
import { byId, byPos } from "./trees";

export const MAX_POINTS = 30

let nextPageIndex = 0
export const pages: Map<number, RuntimePageInfo> = new Map()
for(let i = 0; i < 5; i++) createPage()
export let page: RuntimePageInfo = pages.values().next().value!
export function set_page(to: RuntimePageInfo){
    page = to
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

export function get_tree_points(info: RuntimeTreeInfo){
    return page.pointsPerTree[info.index]!
}
export function set_tree_points(info: RuntimeTreeInfo, points: number){
    return page.pointsPerTree[info.index] = points
}

const saveFileName = 'mastery-pages.json'
const saveFilePath = path.join(downloads, saveFileName)
export async function load(opts: Required<AbortOptions>){
    const saveFile = await fs_readFile(saveFilePath, { ...opts, encoding: 'utf8' })
    const staticPages = saveFile ? JSON.parse(saveFile) as PageInfo[] : []
    if(staticPages.length > 0){
        pages.clear()
        staticPages.forEach(loadPage)
        set_page(pages.values().next().value!)
    }
}

export async function save(opts: Required<AbortOptions>){
    const staticPages: PageInfo[] = [...pages.values()].map(page => {
        return {
            name: page.name,
            talents: Object.fromEntries(page.talents.entries())
        }
    })
    await fs_writeFile(saveFilePath, JSON.stringify(staticPages, null, 4) + '\n', { ...opts, encoding: 'utf8' })
}

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