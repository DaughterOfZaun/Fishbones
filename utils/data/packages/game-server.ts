import path from 'node:path'
import { downloads } from '../fs'
import embedded from '../embedded/embedded'
import { magnet, PkgInfoCSProj, type PkgInfoGit } from './shared'
import { HARDCODED_HTTP_SERVER_URL } from '../../constants-build'
import { tr } from '../../translation'

export const gsPkg = new class extends PkgInfoCSProj implements PkgInfoGit {
    name = tr('Game Server')
    dirName = 'ChildrenOfTheGrave-Gameserver'
    makeDir = false
    zipExt = '7z'
    zipName = `${this.dirName}.${this.zipExt}`
    zipInfoHashV1 = '83155823dd0deb73cab3127dfbcfeb4091050f4f'
    zipInfoHashV2 = 'b84a60529bca79815d8858ec6430d180590b37516a8a84af8d4c1c97a0ce7bfd'
    zipSize = 16682132
    
    dir = path.join(downloads, this.dirName)
    zip = path.join(downloads, this.zipName)
    zipTorrentEmbedded = embedded.gsPkgZipTorrent
    zipTorrent = `${this.zip}.torrent`
    zipMagnet = magnet(this.zipInfoHashV1, this.zipInfoHashV2, this.zipName, this.zipSize)
    zipMega = 'https://mega.nz/file/Oz5lDKiQ#RWwgpmkdUn1MrqLg8p8idkPj8Z0mxzFYgPzCmAi55Is'
    zipWebSeed = `${HARDCODED_HTTP_SERVER_URL}/${this.zipName}`
    zipEmbded = embedded.gsPkgZip

    gitRevision = '4592f1379ddaa972ce0b5dc6cebb9caf09c812ab'
    gitLabMRs = 'https://gitgud.io/api/v4/projects/40035/merge_requests?state=opened'
    gitOriginURL = 'https://gitgud.io/skelsoft/brokenwings.git'
    gitBranchName = 'master'
    gitRemoteName = 'skelsoft'

    projName = 'ChildrenOfTheGraveServerConsole'
    csProjDir = path.join(this.dir, this.projName)
    
    target = 'Debug'
    netVer = 'net9.0'
    csProj = path.join(this.csProjDir, `${this.projName}.csproj`)
    dllDir = path.join(this.csProjDir, 'bin', this.target, this.netVer)
    dllName = `${this.projName}.dll`
    dll = path.join(this.dllDir, this.dllName)
    
    infoDir = path.join(this.dllDir, 'Settings')
    gcDir = path.join(this.dir, 'Content', 'GameClient')

    program = path.join(this.csProjDir, 'Program.cs')

    topLevelEntries = [
        'QuadTree',
        'MirrorImage',
        'LENet',
        'Content',
        'ChildrenOfTheGraveServerConsole',
        'ChildrenOfTheGraveLibrary',
        'ChildrenOfTheGraveEnumNetwork',
    ]
    topLevelEntriesOptional = [
        'bin',
        'obj',
        'doc',
        'ChildrenOfTheGraveServer.sln.DotSettings',
        'ChildrenOfTheGraveServer.sln',
        
        '.git',
        'cotg_docs',
        '.vscode',
        '.gitlab',
        '.gitignore',
        'README.md',
        'LICENSE',
        'FAQ.md',
    ]
}()
