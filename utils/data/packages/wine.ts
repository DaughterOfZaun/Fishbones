import path from 'node:path'
import { downloads } from '../../log'
import { HARDCODED_HTTP_SERVER_URL } from '../../constants-build'
import { gdrive, magnet, PkgInfoExe } from "./shared"
import embedded from "../embedded/embedded"
import { tr } from "../../translation"

export enum WineCMD {
    Download = 1,
    System = 2,
    Custom = 3,
    Auto = 0,
}
export namespace WineCMD {
    export function classify(cmd: WineCMD | string): WineCMD {
        if(typeof cmd === 'number') return cmd
        switch(cmd){
            case 'download': return WineCMD.Download
            case 'system': return WineCMD.System
            case 'auto': return WineCMD.Auto
            default: return WineCMD.Custom
        }
    }
    export function stringify(cmd: WineCMD | string): string {
        if(typeof cmd === 'string') return cmd
        switch(cmd){
            case WineCMD.Download: return 'download'
            case WineCMD.System: return 'system'
            default: return 'auto'
        }
    }
    export function resolve(arg: WineCMD | string): WineCMD {
        const cmd = classify(arg)
        switch(cmd){
            case WineCMD.Auto: return WineCMD.Download
            default: return cmd
        }
    }
    export function template(arg: string): string
    export function template(arg: WineCMD): string | undefined
    export function template(arg: WineCMD | string): string | undefined {
        const cmd = resolve(arg)
        switch(cmd){
            case WineCMD.System: return 'wine {exe} {args}'
            case WineCMD.Download: return `${winePkg.exe} {exe} {args}`
            default: return (typeof arg === 'string') ? arg : undefined
        }
    }
}

export const winePkg = new class WinePkg extends PkgInfoExe {

    name = tr('Wine')
    
    exeName = 'wine-11.9-1-anylinux-x86_64.AppImage'
    exeDir = downloads
    size = 146564893
    
    zipName = this.exeName
    zipSize = this.size
    zipExt = 'none'
    
    dir = this.exeDir
    makeDir = false
    dirName = ''

    zip = path.join(this.dir, this.zipName)
    exe = path.join(this.dir, this.exeName)
    
    zipInfoHashV1 = '9a7e382d6a9fc1926d080300af26eafdf0607d67'
    zipInfoHashV2 = ''
    zipMagnet = magnet(this.zipInfoHashV1, this.zipInfoHashV2, this.zipName, this.zipSize)
    zipTorrentEmbedded = embedded.wineZipTorrent
    zipTorrentName = `${this.zipName}.torrent`
    zipTorrent = `${this.zip}.torrent`

    //zipMega = ''
    zipWebSeeds = [
        `https://github.com/pkgforge-dev/wine-AppImage/releases/download/11.9-1%402026-05-22_1779458719/${this.zipName}`,
        `${HARDCODED_HTTP_SERVER_URL}/${this.zipName}`,
        //gdrive(``),
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
