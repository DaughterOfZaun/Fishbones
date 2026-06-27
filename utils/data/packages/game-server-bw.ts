import path from 'node:path'
import { downloads } from '../fs'
import embedded from '../embedded/embedded'
import type { ServerDataInfo } from '../constants/client-server-combinations'
import { gdrive, magnet, PkgInfoCSProj, type PkgInfoGit } from './shared'
import { HARDCODED_HTTP_SERVER_URL } from '../../constants-build'
import { args } from '../../args'
import { tr } from '../../translation'
import { sdkPkg } from './sdk'

args.remoteIdx.on('change', index => bwPkg.setRemoteByIndex(index))

export const bwPkg = new class extends PkgInfoCSProj implements PkgInfoGit {
    
    name = tr('BrokenWings') + ' ' + tr('Game Server')
    
    //gitRevision = '4592f1379ddaa972ce0b5dc6cebb9caf09c812ab'
    gitRevision = 'ea2c203afb329360c8ea81b084aab55fca6b48af'
    
    dirName = 'ChildrenOfTheGrave-GameServer'
    zipRoot = [ 'brokenwings-master' ] // New.
    zipHasSingleRootEntry = true // New.
    makeDir = false
    zipExt = '7z'
    //zipName = `${this.dirName}.${this.zipExt}`
    zipName = `${this.zipRoot[0]!}-${this.gitRevision.slice(0, 8)}.${this.zipExt}`
    //zipSize = 16682132
    zipSize = 14091932
    //size = 356730226
    size = 193269646

    dir = path.join(downloads, this.dirName)
    zip = path.join(downloads, this.zipName)

    // The file is embedded now, no need to download.
    zipEmbded = embedded.bwPkgZip
    
    //zipTorrentEmbedded = embedded.bwPkgZipTorrent
    //zipTorrentName = `${this.zipName}.torrent`
    //zipTorrent = `${this.zip}.torrent`
    //zipInfoHashV1 = '83155823dd0deb73cab3127dfbcfeb4091050f4f'
    //zipInfoHashV2 = 'b84a60529bca79815d8858ec6430d180590b37516a8a84af8d4c1c97a0ce7bfd'
    //zipMagnet = magnet(this.zipInfoHashV1, this.zipInfoHashV2, this.zipName, this.zipSize)
    //zipMega = 'https://mega.nz/file/Oz5lDKiQ#RWwgpmkdUn1MrqLg8p8idkPj8Z0mxzFYgPzCmAi55Is'
    //zipWebSeeds = [
    //    gdrive(`1p9Dz1o_tUrML6a7KdyCeoXeIjyoZ5YhG`),
    //    `${HARDCODED_HTTP_SERVER_URL}/${this.zipName}`,
    //]

    zipTorrentEmbedded = ''
    zipTorrentName = ''
    zipTorrent = ''
    zipInfoHashV1 = ''
    zipInfoHashV2 = ''
    zipMagnet = ''
    zipMega = ''
    zipWebSeeds = []

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

    gitLabMRs = ''
    gitOriginURL = ''
    gitBranchName = ''
    gitRemoteName = ''
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

    constructor(){
        super()
        this.setRemoteByIndex(0)
    }

    setRemoteByIndex(index: number){
        const remote = this.remotes[index]
        if(remote){
            this.gitLabMRs = remote.gitLabMRs
            this.gitOriginURL = remote.originURL
            this.gitRemoteName = remote.remoteName
            this.gitBranchName = remote.gitBranchName
        }
    }
}

export class BrokenWingsDataInfo implements ServerDataInfo {

    constructor(
        public dir: string
    ){}

    maps = {
        1: {
            modes: [ 'CLASSIC' ],
            bots: [
                'Soraka',
                'Sivir',
                'Shen',
                'Ryze',
                'Nasus',
                'MasterYi',
                'Malphite',
                'Garen',
                'Annie',
                'Alistar',
            ],
        },
        2: {
            modes: [ 'CLASSIC' ],
            bots: [
                'Soraka',
                'Sivir',
                'Shen',
                'Ryze',
                'Nasus',
                'MasterYi',
                'Malphite',
                'Garen',
                'Annie',
                'Alistar',
            ],
        },
        4: {
            modes: [ 'CLASSIC' ],
            bots: [
                'Soraka',
                'Sivir',
                'Shen',
                'Ryze',
                'Nasus',
                'MasterYi',
                'Malphite',
                'Garen',
                'Annie',
                'Alistar',
            ],
        },
        6: {
            modes: [ 'CLASSIC' ],
            bots: [
                'Soraka',
                'Sivir',
                'Shen',
                'Ryze',
                'Nasus',
                'MasterYi',
                'Malphite',
                'Garen',
                'Annie',
                'Alistar',
            ],
        },
        8: {
            modes: [ 'ODIN' ],
            bots: [],
        },
        30: {
            modes: [ 'CLASSIC' ],
            bots: [],
        },
    }

    spells = {
        "SummonerBattleCry": {},
        //"SummonerBattleCryBuff": {},
        "SummonerBoost": {},
        //"SummonerBoostSpellShield": {},
        "SummonerClairvoyance": {},
        "SummonerDot": {},
        "SummonerExhaust": {},
        "SummonerFlash": {},
        "SummonerFortify": {},
        "SummonerHaste": {},
        "SummonerHeal": {},
        //"SummonerHealCheck": {},
        "SummonerMana": {},
        //"SummonerOdinGarrison": {},
        //"SummonerOdinGarrisonDebuff": {},
        //"SummonerPromoteSR": {},
        "SummonerRally": {},
        "SummonerRevive": {},
        //"SummonerReviveSpeedBoost": {},
        "SummonerSmite": {},
        "SummonerTeleport": {},
        //"SummonerTestForceSpell": {},
    }

    champions = {
        "Alistar": {},
        "Annie": {},
        "Ashe": {},
        "FiddleSticks": {},
        "Jax": {},
        "Kayle": {},
        "MasterYi": {},
        "Morgana": {},
        "Nunu": {},
        "Ryze": {},
        "Sion": {},
        "Sivir": {},
        "Soraka": {},
        "Teemo": {},
        "Tristana": {},
        "TwistedFate": {},
        "Warwick": {},
        "Singed": {},
        "Zilean": {},
        "Evelynn": {},
        "Tryndamere": {},
        "Twitch": {},
        "Karthus": {},
        "Amumu": {},
        "Chogath": {},
        "Anivia": {},
        "Rammus": {},
        "Veigar": {},
        "Kassadin": {},
        "Gangplank": {},
        "Taric": {},
        "Blitzcrank": {},
        "DrMundo": {},
        "Janna": {},
        "Malphite": {},
        "Corki": {},
        "Katarina": {},
        "Nasus": {},
        "Heimerdinger": {},
        "Shaco": {},
        "Udyr": {},
        "Nidalee": {},
        "Poppy": {},
        "Gragas": {},
        "Pantheon": {},
        "Mordekaiser": {},
        "Ezreal": {},
        "Shen": {},
        "Kennen": {},
        "Garen": {},
        "Akali": {},
        "Malzahar": {},
        "Olaf": {},
        "KogMaw": {},
        "XinZhao": {},
        "Vladimir": {},
        "Galio": {},
        "Urgot": {},
        "MissFortune": {},
        "Sona": {},
        "Swain": {},
        "Lux": {},
        "Leblanc": {},
        "Irelia": {},
        "Trundle": {},
        "Cassiopeia": {},
        "Caitlyn": {},
        "Renekton": {},
        "Karma": {},
        "Maokai": {},
        "JarvanIV": {},
        "Nocturne": {},
        "LeeSin": {},
        "Brand": {},
        "Rumble": {},
        "Vayne": {},
        "Orianna": {},
        "Yorick": {},
        "Leona": {},
        "MonkeyKing": {},
        "Skarner": {},
        "Talon": {},
        "Riven": {},
        "Xerath": {},
        "Graves": {},
        "Shyvana": {},
        "Fizz": {},
        "Volibear": {},
        "Ahri": {},
        "Viktor": {},
        "Sejuani": {},
    }

    bots = [
        'Alistar',
        'Amumu',
        'Annie',
        'Ashe',
        'Blitzcrank',
        'Brand',
        'Caitlyn',
        'Cassiopeia',
        'Chogath',
        'Common',
        'DrMundo',
        'Ezreal',
        'Fiddlesticks',
        'Galio',
        'Garen',
        'Graves',
        'Irelia',
        'Jax',
        'Karthus',
        'Kayle',
        'KogMaw',
        'Leona',
        'Lux',
        'Malphite',
        'Malzahar',
        'Maokai',
        'MasterYi',
        'MissFortune',
        'MonkeyKing',
        'Mordekaiser',
        'Morgana',
        'Nasus',
        'Nidalee',
        'Nunu',
        'Pantheon',
        'Poppy',
        'Rammus',
        'Renekton',
        'Ryze',
        'Shen',
        'Shyvana',
        'Sion',
        'Sivir',
        'Sona',
        'Soraka',
        'Swain',
        'Taric',
        'Tristana',
        'Trundle',
        'Udyr',
        'Veigar',
        'Vladimir',
        'Warwick',
        'XinZhao',
        'Yorick',
        'Ziggs',
        'Zilean',
    ]
}
