export const magnet = (ihv1?: string, ihv2?: string, fname?: string, size?: number) => {
    const parts: string[] = []
    if(ihv1) parts.push(`xt=urn:btih:${ihv1}`)
    if(ihv2) parts.push(`xt=urn:btmh:${ihv2}`)
    if(fname) parts.push(`dn=${fname}`)
    if(size) parts.push(`xl=${size}`)
    return `magnet:?${parts.join('&')}`
}

export const gdrive = (id: string) => {
    return `https://drive.usercontent.google.com/download?id=${id}&export=download&authuser=0&confirm=t`
}

//TODO: PkgInfoDownloadable/Embedded
export abstract class PkgInfo {
    abstract name: string
    abstract dirName: string
    abstract makeDir: boolean
    
    abstract zipExt: string
    abstract zipName: string
    abstract zipInfoHashV1: string
    abstract zipInfoHashV2: string
    abstract zipSize: number
    //abstract zipHash: string

    abstract dir: string
    abstract zip: string
    abstract zipTorrentEmbedded: string
    abstract zipTorrent: string
    abstract zipMagnet: string
    
    abstract checkUnpackBy: string
    abstract topLevelEntries: string[]
    abstract topLevelEntriesOptional: string[]
    
    zipWebSeeds?: string[]
    zipEmbded?: string
    zipMega?: string
}

export abstract class PkgInfoExe extends PkgInfo {
    get checkUnpackBy(){ return this.exe }
    
    abstract exe: string
    abstract exeDir: string
}

export abstract class PkgInfoCSProj extends PkgInfo {
    get checkUnpackBy(){ return this.csProj }

    abstract target: string
    abstract netVer: string
    abstract csProj: string
    abstract csProjDir: string
    abstract dllDir: string
    abstract dllName: string
    abstract dll: string

    abstract program: string
}

export interface PkgInfoGit extends PkgInfo {
    gitRevision: string
    gitOriginURL: string
    gitBranchName: string
    gitRemoteName: string
}
