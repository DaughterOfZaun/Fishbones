import path from 'node:path'
import { downloads } from '../fs'
import embedded from '../embedded/embedded'
import { gdrive, magnet, PkgInfoCSProj, type PkgInfoGit } from './shared'
import { HARDCODED_HTTP_SERVER_URL } from '../../constants-build'
import { tr } from '../../translation'
import { sdkPkg } from './sdk'

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
    zipWebSeeds = [
        gdrive(`1p9Dz1o_tUrML6a7KdyCeoXeIjyoZ5YhG`),
        `${HARDCODED_HTTP_SERVER_URL}/${this.zipName}`,
    ]
    zipEmbded = embedded.gsPkgZip

    gitRevision = '4592f1379ddaa972ce0b5dc6cebb9caf09c812ab'
    gitLabMRs = 'https://gitgud.io/api/v4/projects/40035/merge_requests?state=opened'
    gitOriginURL = 'https://gitgud.io/skelsoft/brokenwings.git'
    gitBranchName = 'master'
    gitRemoteName = 'skelsoft'

    projName = 'ChildrenOfTheGraveServerConsole'
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

    allCSProjs = [
        'ChildrenOfTheGraveEnumNetwork/ChildrenOfTheGraveEnumNetwork.csproj',
        'ChildrenOfTheGraveLibrary/ChildrenOfTheGraveLibrary.csproj',
        'ChildrenOfTheGraveServerConsole/ChildrenOfTheGraveServerConsole.csproj',
        'Content/AvCsharp-Scripts/AvCsharp-Scripts.csproj',
        'Content/AvLua-Converted/AvLua-Converted.csproj',
        'LENet/LENet/LENet.csproj',
        'MirrorImage/BloodBoil/BloodBoil.csproj',
        'MirrorImage/CrystalSlash/CrystalSlash.csproj',
        'MirrorImage/HeavenlyWave/HeavenlyWave.csproj',
        'MirrorImage/MirrorImage.csproj',
        'MirrorImage/SiphoningStrike/SiphoningStrike.csproj',
        'MirrorImage/TechmaturgicalRepairBot/TechmaturgicalRepairBot.csproj',
        'QuadTree/QuadTree.csproj',
    ]

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

    remotes = [
        {
            name: 'skelsoft',
            remoteName: 'origin',
            originURL: 'https://gitgud.io/skelsoft/brokenwings.git',
            gitLabMRs: 'https://gitgud.io/api/v4/projects/40035/merge_requests?state=opened',
            gitBranchName: 'master',
        },
        {
            name: 'ice-cream-man',
            remoteName: 'ice-cream-man',
            originURL: 'https://gitgud.io/IceCreamMan/CoTG.git',
            gitLabMRs: 'https://gitgud.io/api/v4/projects/43500/merge_requests?state=opened',
            gitBranchName: 'master',
        },
    ]

    setRemoteByIndex(index: number){
        const remote = this.remotes[index]
        if(remote){
            this.gitLabMRs = remote.gitLabMRs
            this.gitOriginURL = remote.originURL
            this.gitRemoteName = remote.remoteName
            this.gitBranchName = remote.gitBranchName
        }
    }
}()
