import path from 'node:path'
import { downloads } from '../fs'
//import embedded from '../embedded/embedded'
import type { ServerDataInfo } from '../constants/client-server-combinations'
import { gdrive, magnet, PkgInfoCSProj, type PkgInfoGit } from './shared'
//import { HARDCODED_HTTP_SERVER_URL } from '../../constants-build'
import { tr } from '../../translation'
import { sdkPkg } from './sdk'
import embedded from '../embedded/embedded'

export const tgPkg = new class extends PkgInfoCSProj implements PkgInfoGit {

    name = tr('TestGrounds') + ' ' + tr('Game Server')

    gitRevision = '35cf3aba0de48d1afad6dfeb7c15f706ff05d643'
    gitOriginURL = 'https://github.com/PatateslerinAdami/TestGrounds.git'
    gitBranchName = 'master'
    gitRemoteName = 'origin'

    dirName = 'TestGrounds-GameServer'
    makeDir = false
    
    zipExt = '7z'
    zipRootDirName = 'TestGrounds-master'
    zipName = `${this.zipRootDirName}-${this.gitRevision.slice(0, 8)}.${this.zipExt}`
    zipRoot = [ this.zipRootDirName ]
    zipHasSingleRootEntry = true
    zipSize = 7729508
    size = 236270130

    dir = path.join(downloads, this.dirName)
    zip = path.join(downloads, this.zipName)

    zipEmbded = embedded.tgPkgZip
    
    zipTorrentEmbedded = ''
    zipTorrentName = '' //`${this.zipName}.torrent`
    zipTorrent = '' //`${this.zip}.torrent`
    zipInfoHashV1 = ''
    zipInfoHashV2 = ''
    zipMagnet = '' //magnet(this.zipInfoHashV1, this.zipInfoHashV2, this.zipName, this.zipSize)
    zipMega = ''
    zipWebSeeds = [
        //gdrive(``),
        //`${HARDCODED_HTTP_SERVER_URL}/${this.zipName}`,
    ]

    projName = 'GameServerConsole'
    csProjDir = path.join(this.dir, this.projName)
    
    target = 'Debug'
    netVer = sdkPkg.target
    csProj = path.join(this.csProjDir, `${this.projName}.csproj`)
    dllDir = path.join(this.csProjDir, 'bin', this.target, this.netVer)
    dllName = `${this.projName}.dll`
    dll = path.join(this.dllDir, this.dllName)
    
    infoDir = path.join(this.dllDir, 'Settings')
    program = path.join(this.csProjDir, 'Program.cs')

    allCSProjs = [
        'Content/LeagueSandbox-Scripts/LeagueSandbox-Scripts.csproj',
        'GameMaths/GameMaths.csproj',
        'GameServerConsole/GameServerConsole.csproj',
        'GameServerCore/GameServerCore.csproj',
        'GameServerLib/GameServerLib.csproj',
        'LeaguePackets/LeaguePackets.csproj',
        'QuadTree/QuadTree.csproj',
    ]

    topLevelEntries = [
        'Content',
        'GameMaths',
        'GameServerConsole',
        'GameServerCore',
        'GameServerLib',
        'LeaguePackets',
        'QuadTree',
    ]
    topLevelEntriesOptional = [
        '.git',
        'bin', 'obj',
        'TestGrounds.sln',
    ]
}

export class TestGroundsDataInfo implements ServerDataInfo {

    constructor(
        public dir: string
    ){}

    maps = {
        1: { bots: [], modes: [ 'CLASSIC', /*'URF'*/ ] },
        8: { bots: [], modes: [ 'ODIN', 'ASCENSION' ] },
        10: { bots: [], modes: [ 'CLASSIC' ] },
        11: { bots: [], modes: [ 'CLASSIC' ] },
        12: { bots: [], modes: [ 'ARAM' ] },
        16: { bots: [], modes: [ 'CLASSIC' ] },
        31: { bots: [], modes: [ 'CLASSIC', /*'URF'*/ ] },
    }

    spells = {
        'SummonerBarrier': {},
        'SummonerDot': {},
        'SummonerExhaust': {},
        'SummonerFlash': {},
        'SummonerHaste': {},
        'SummonerHeal': {},
        'SummonerMana': {},
        'SummonerRevive': {},
        'SummonerSmite': {},
    }

    champions = {
        'Aatrox': {},
        'Akali': {},
        'Annie': {},
        'Ashe': {},
        'Evelynn': {},
        'Ezreal': {},
        'Fiddlesticks': {},
        'Irelia': {},
        'Jax': {},
        'Jinx': {},
        'Karma': {},
        'Katarina': {},
        'Kayle': {},
        'Malphite': {},
        'Mordekaiser': {},
        'Morgana': {},
        'Nami': {},
        'Pantheon': {},
        'Rammus': {},
        'Ryze': {},
        'Swain': {},
        'Talon': {},
        'Taric': {},
        'Thresh': {},
        'Trundle': {},
        'Udyr': {},
        'Vayne': {},
        'Velkoz': {},
        'Zed': {},
    }

    bots = [
        'Ezreal',
    ]
}
