import path from 'node:path'
import { downloads } from "../fs"
import { gdrive, magnet, PkgInfoExe } from "./shared"
import { tr } from "../../translation"
import embedded from "../embedded/embedded"
import { HARDCODED_HTTP_SERVER_URL } from '../../constants-build'

export const WINE_CMD_AUTO_IDX = 0
export const WINE_CMD_AUTO = 'auto'
export const WINE_CMD_CUSTOM_IDX = 1
export const WINE_CMD_CUSTOM = 'auto'
export const WINE_CMD_SYSTEM_IDX = 2
export const WINE_CMD_SYSTEM = 'system'
export const WINE_CMD_SYSTEM_TEMPLATE = 'wine {exe} {args}'
export const WINE_CMD_DOWNLOAD_IDX = 3
export const WINE_CMD_DOWNLOAD = 'download'

export const winePkg = new class WinePkg extends PkgInfoExe {

    name = tr('Wine')
    
    exeName = 'wine-stable_11.0-x86_64.appimage'
    exeDir = downloads
    size = 0
    
    zipName = this.exeName
    zipSize = this.size
    zipExt = 'none'
    
    dir = this.exeDir
    makeDir = false
    dirName = ''

    zip = path.join(this.dir, this.zipName)
    exe = path.join(this.dir, this.exeName)
    
    zipInfoHashV1 = ''
    zipInfoHashV2 = ''
    zipMagnet = magnet(this.zipInfoHashV1, this.zipInfoHashV2, this.zipName, this.zipSize)
    zipTorrentEmbedded = embedded.wineZipTorrent
    zipTorrentName = `${this.zipName}.torrent`
    zipTorrent = `${this.zip}.torrent`

    zipMega = ''
    zipWebSeeds = [
        gdrive(``),
        `${HARDCODED_HTTP_SERVER_URL}/${this.zipName}`,
    ]
    
    topLevelEntries = []
    topLevelEntriesOptional = []
}

export const winePkgUnpacked = new class WinePkg extends PkgInfoExe {

    name = tr('Wine')
    dirName = 'AppDir'
    zipRoot = [ this.dirName ]
    zipHasSingleRootEntry = true
    dir = path.join(downloads, this.dirName)
    makeDir = false
    size = 366285447
    
    exeDir = this.dir
    exe = path.join(this.exeDir, 'wine-stable_11.0-x86_64.appimage')
    
    zipName = 'wine-stable_11.0-x86_64.appimage'
    zip = path.join(downloads, this.zipName)
    zipExt = '.appimage'
    zipSize = 0

    zipInfoHashV1 = ''
    zipInfoHashV2 = ''
    zipTorrentEmbedded = embedded.wineZipTorrent
    zipTorrentName = `${this.zipName}.torrent`
    zipTorrent = `${this.zip}.torrent`
    zipMagnet = ''
    
    topLevelEntries = [
        'AppRun',
        'AppRun.env',
        'bin',
        'etc',
        'lib',
        'opt',
        'org.winehq.wine.desktop',
        'runtime',
        'usr',
        'wine.svg',
        'wrapper',
    ]
    topLevelEntriesOptional = [
        'prefix',
    ]
}
