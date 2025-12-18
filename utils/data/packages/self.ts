import { arch, platform } from "../../constants-build"
import { downloads } from "../fs"
import { PkgInfo } from "./shared"
import path from 'node:path'

export class FBPkgInfo extends PkgInfo {
    
    readonly releasesURL = 'https://api.github.com/repos/DaughterOfZaun/Fishbones/releases'

    readonly name = 'Launcher'
    readonly dirName = 'Fishbones'
    readonly exeName =
        platform === 'Windows' ? 'Fishbones.exe' :
        platform === 'Linux' ? 'Fishbones' :
        undefined!
    readonly makeDir = true
    readonly zipExt = 'zip'

    // Mutable variables.
    readonly version: string
    readonly zipTorrentName: string
    readonly zipName: string
    readonly zip: string
    
    zipSize!: number
    zipTorrent: string
    zipWebSeed = ''
    
    zipTorrentEmbedded = ''
    zipInfoHashV1 = ''
    zipInfoHashV2 = ''
    zipMagnet = ''
    
    dir = path.join(downloads, this.dirName)
    exe = path.join(this.dir, this.exeName)
    topLevelEntriesOptional = []
    topLevelEntries = [
        this.exeName,
    ]

    checkUnpackBy = this.exe

    constructor(version: string){
        super()
        this.version = version
        this.zipName = `${this.dirName}-${this.version}-${platform}-${arch}.${this.zipExt}`
        this.zipTorrentName = `${this.zipName}.torrent`
        this.zipTorrent = path.join(downloads, this.zipTorrentName)
        this.zip = path.join(downloads, this.zipName)
    }
}
