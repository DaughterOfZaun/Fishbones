import { arch, platform, HARDCODED_GH_RELEASE_URL, HARDCODED_HTTP_SERVER_URL, HARDCODED_GH_DOWNLOAD_URL } from "../../constants-build"
import { tr } from "../../translation"
import { downloads } from "../fs"
import { PkgInfo } from "./shared"
import path from 'node:path'

export class FBPkgInfo extends PkgInfo {
    
    /** @deprecated Property is not used and will be removed in the future. */
    releasesURL = HARDCODED_GH_RELEASE_URL

    readonly name = tr('Launcher')
    readonly dirName = 'Fishbones'
    readonly exeName =
        platform === 'Windows' ? 'Fishbones.exe' :
        platform === 'Linux' ? 'Fishbones' :
        undefined!
    readonly makeDir = true
    readonly zipExt = 'zip'

    // Mutable variables.
    version: string
    get zipName(){ return `${this.dirName}-${this.version}-${platform}-${arch}.${this.zipExt}` }
    get zipTorrentName() { return `${this.zipName}.torrent` }
    get zipTorrent(){ return path.join(downloads, this.zipTorrentName) }
    get zip(){ return path.join(downloads, this.zipName) }
    
    size = 0 //TODO:
    zipSize!: number
    zipWebSeeds: string[] = [
        `${HARDCODED_GH_DOWNLOAD_URL}/${this.zipName}`,
        `${HARDCODED_HTTP_SERVER_URL}/${this.zipName}`,
    ]
    
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

    versionFileName = 'version.bin'
    versionFile = path.join(downloads, this.versionFileName)
    vfWebSeeds: string[] = [
        `${HARDCODED_GH_DOWNLOAD_URL}/${this.versionFileName}`,
        `${HARDCODED_HTTP_SERVER_URL}/${this.versionFileName}`,
    ]

    constructor(version: string){
        super()
        this.version = version
    }
}
