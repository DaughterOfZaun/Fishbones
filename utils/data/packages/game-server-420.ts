import path from 'node:path'
import { downloads } from '../fs'
import embedded from '../embedded/embedded'
import { magnet, PkgInfoCSProj } from './shared'
import { tr } from '../../translation'
import { sdkPkg } from './sdk'

export const gs420Pkg = new class extends PkgInfoCSProj {
    name = tr('Game Server')
    dirName = 'GameServer'
    makeDir = false
    zipExt = '7z'
    zipName = `Chronobreak.GameServer.${this.zipExt}`
    zipInfoHashV1 = 'e4043fdc210a896470d662933f7829ccf3ed781b'
    zipInfoHashV2 = 'cf9bfaba0f9653255ff5b19820ea4c01ac8484d0f8407b109ca358236d4f4abc'
    zipSize = 21309506
    
    dir = path.join(downloads, this.dirName)
    zip = path.join(downloads, this.zipName)
    zipTorrentEmbedded = embedded.gs420PkgZipTorrent
    zipTorrent = `${this.zip}.torrent`
    zipMagnet = magnet(this.zipInfoHashV1, this.zipInfoHashV2, this.zipName, this.zipSize)
    zipMega = 'https://mega.nz/file/D35i0YaD#P08udvnbUByZHGBvCTbC1XDPkKdUGgp4xtravAlECbU'

    projName = 'GameServerConsole'
    csProjDir = path.join(this.dir, this.projName)
    
    target = 'Debug'
    netVer = sdkPkg.target
    csProj = path.join(this.csProjDir, `${this.projName}.csproj`)
    dllDir = path.join(this.csProjDir, 'bin', this.target, this.netVer)
    dllName = `${this.projName}.dll`
    dll = path.join(this.dllDir, this.dllName)
    
    infoDir = path.join(this.dllDir, 'Settings')
    gcDir = path.join(this.dir, 'Content', 'GameClient')

    program = path.join(this.csProjDir, 'Program.cs')
    allCSProjs = []

    topLevelEntries = [
        'QuadTree',
        'ScriptsCore',
        'ScriptPackage-Template',
        'GameServerLib',
        'GameServerCore',
        'GameServerConsole',
        'Content',
        'LeaguePackets',
        'LENet',
    ]
    topLevelEntriesOptional = [
        'GameServer.sln',
        'README.md',
        'LICENSE',
        'GameServer.sln.DotSettings',
    ]
}()
