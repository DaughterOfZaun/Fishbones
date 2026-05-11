import { downloads } from "../fs"
import path from 'node:path'
import { PkgInfoExe } from "./shared"
import { tr } from "../../translation"

export const WINE_CMD_AUTO = 'auto'
export const WINE_CMD_CUSTOM = 'auto'
export const WINE_CMD_AUTO_IDX = 0
export const WINE_CMD_CUSTOM_IDX = 1
export const WINE_CMD_AUTO_TEMPLATE = 'wine {exe} {args}'

export const winePkg = new class WinePkg extends PkgInfoExe {

    name = tr('Wine')
    dirName = 'AppDir'
    dir = path.join(downloads, this.dirName)
    makeDir = false
    size = 366285447
    
    exeDir = this.dir
    exe = path.join(this.exeDir, 'wine-stable_11.0-x86_64.appimage')
    
    zipName = 'wine-stable_11.0-x86_64.appimage'
    zip = path.join(downloads, this.zipName)
    zipExt = '.appimage'

    zipInfoHashV1 = ''
    zipInfoHashV2 = ''
    zipSize = 0
    zipTorrentName = `${this.zipName}.torrent`
    zipTorrent = `${this.zip}.torrent`
    zipTorrentEmbedded = ''
    zipMagnet = ''
    
    topLevelEntriesOptional = []
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
}
