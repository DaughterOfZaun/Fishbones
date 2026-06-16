import { arch, platform, HARDCODED_RELEASE_URL } from "../../constants-build"
import { tr } from "../../translation"
import { downloads } from "../fs"
import { PkgInfo } from "./shared"
import path from 'node:path'

export class FBPkgInfo extends PkgInfo {
    
    releasesURL = HARDCODED_RELEASE_URL

    readonly name = tr('Launcher')
    readonly dirName = 'Fishbones'
    readonly exeName =
        platform === 'Windows' ? 'Fishbones.exe' :
        platform === 'Linux' ? 'Fishbones' :
        undefined!
    readonly makeDir = true
    readonly zipExt = 'zip'

    // Mutable variables.
    private _version!: string
    get version(){ return this._version }
    set version(version: string){
        this._version = version
        this.zipName = `${this.dirName}-${this.version}-${platform}-${arch}.${this.zipExt}`
        this.zipTorrentName = `${this.zipName}.torrent`
        this.zipTorrent = path.join(downloads, this.zipTorrentName)
        this.zip = path.join(downloads, this.zipName)
    }
    zipName!: string
    zipTorrentName!: string
    zipTorrent!: string
    zip!: string
    
    size = 0 //TODO:
    zipSize!: number
    zipWebSeeds: string[] = []
    
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

    constructor(version: string){
        super()
        this.version = version
    }
}
