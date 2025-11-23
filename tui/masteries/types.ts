import type { MastryInfo } from "../../utils/data/constants/masteries"

export type RuntimeMasteryInfo = MastryInfo & {
    parentInfo?: RuntimeMasteryInfo
    childInfo?: RuntimeMasteryInfo
    tree: RuntimeTreeInfo
    iconDisabled: string
    iconEnabled: string
}

export type RuntimeTreeInfo = {
    name: string
    index: number
    grid: (RuntimeMasteryInfo | undefined)[]
}

export type PageInfo = {
    name: string
    talents: Record<number, number>
}

export type RuntimePageInfo = {
    name: string
    index: number
    points: number
    pointsPerTree: number[]
    talents: Map<number, number>
}
