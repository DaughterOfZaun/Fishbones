import path from 'node:path'
import type { AbortOptions } from '@libp2p/interface'
import { console_log_fs_err, downloads, fs_exists, fs_moveFile } from './fs'
import { fs_copyFile } from '../../ui/remote/remote'
import embedded from './embedded/embedded'

const magnet = (ihv1?: string, ihv2?: string, fname?: string, size?: number) => {
    const parts: string[] = []
    if(ihv1) parts.push(`xt=urn:btih:${ihv1}`)
    if(ihv2) parts.push(`xt=urn:btmh:${ihv2}`)
    if(fname) parts.push(`dn=${fname}`)
    if(size) parts.push(`xl=${size}`)
    return `magnet:?${parts.join('&')}`
}

//TODO: PkgInfoDownloadable/Embedded
export abstract class PkgInfo {
    abstract dirName: string
    abstract noDedup: boolean
    
    abstract zipExt: string
    abstract zipName: string
    abstract zipInfoHashV1: string
    abstract zipInfoHashV2: string
    abstract zipSize: number
    //abstract zipHash: string

    abstract dir: string
    abstract zip: string
    abstract zipTorrentEmbedded: string
    abstract zipTorrent: string
    abstract zipMagnet: string
    
    abstract checkUnpackBy: string
    abstract topLevelEntries: string[]
    abstract topLevelEntriesOptional: string[]
    
    zipWebSeed?: string
    zipEmbded?: string
    zipMega?: string
}

export abstract class PkgInfoExe extends PkgInfo {
    get checkUnpackBy(){ return this.exe }
    
    abstract exe: string
    abstract exeDir: string
}

export abstract class PkgInfoCSProj extends PkgInfo {
    get checkUnpackBy(){ return this.csProj }

    abstract target: string
    abstract netVer: string
    abstract csProj: string
    abstract csProjDir: string
    abstract dllDir: string
    abstract dllName: string
    abstract dll: string

    abstract program: string
}

export const gc420Pkg = new class extends PkgInfoExe {
    dirName = 'League of Legends_UNPACKED'
    noDedup = false
    zipExt = '.7z'
    zipName = `League of Legends_UNPACKED${this.zipExt}`
    zipInfoHashV1 = '4bb197635194f4242d9f937f0f9225851786a0a8'
    zipInfoHashV2 = ''
    zipSize = 2171262108

    dir = path.join(downloads, this.dirName)
    zip = path.join(downloads, this.zipName)
    zipTorrentEmbedded = embedded.gc420ZipTorrent
    zipTorrent = `${this.zip}.torrent`
    zipMagnet = magnet(this.zipInfoHashV1, this.zipInfoHashV2, this.zipName, this.zipSize)
    zipMega = 'https://mega.nz/file/Hr5XEAqT#veo2lfRWK7RrLUdFBBqRdUvxwr_gd8UyUL0f6b4pHJ0'

    exeDir = path.join(this.dir, 'League-of-Legends-4-20', 'RADS', 'solutions', 'lol_game_client_sln', 'releases', '0.0.1.68', 'deploy')
    exe = path.join(this.exeDir, 'League of Legends.exe')

    topLevelEntries = [
        'League-of-Legends-4-20',
    ]
    topLevelEntriesOptional = [
        'Logs',
        'Config',
        '2018-07-07_19-01-05_League of Legends.log',
        '-000000000000001_crash.json',
        '2018-07-07_18-41-50_League of Legends.log',
        '2018-07-07_18-37-57_League of Legends.log',
        '2018-07-07_18-36-35_League of Legends.log',
    ]
}()

export const gcPkg = new class extends PkgInfoExe {
    dirName = 'playable_client_126'
    noDedup = false
    zipExt = '.7z'
    zipName = `${this.dirName}${this.zipExt}`
    zipInfoHashV1 = '875201f4a9920ffd7c9bff6c9a2ad59e28f041ae'
    zipInfoHashV2 = '6ccbb2911b07b2c084beb666d22018159845b3eae180b989d75b354af39c8af3'
    zipSize = 898175547

    dir = path.join(downloads, this.dirName)
    zip = path.join(downloads, this.zipName)
    zipTorrentEmbedded = embedded.gcZipTorrent
    zipTorrent = `${this.zip}.torrent`
    zipMagnet = magnet(this.zipInfoHashV1, this.zipInfoHashV2, this.zipName, this.zipSize)
    zipMega = 'https://mega.nz/file/uqRmkCKC#nJFZ2hAYqTq5q-T1PExXPpu0aX4ALjjZj2SZ4q9yCpk'

    exeDir = this.dir
    exeName = 'League of Legends.exe'
    exe = path.join(this.exeDir, this.exeName)

    release = '0.0.0.51' // Are you sure about that?

    topLevelEntries = [
        'LEVELS',
        'DATA',
        'util.dll',
        'tbb.dll',
        'rads.dll',
        'League of Legends.exe',
        'launcher.maestro.dll',
        'fmodex.dll',
        'fmod_event.dll',
        'dbghelp.dll',
        'client.ver',
        'bugsplatrc.dll',
        'bugsplat.dll',
        'BsSndRpt.exe',
    ]
    topLevelEntriesOptional = [
        'launch_client.bat',
    ]

    //FIXME: This has gone too far
    championsIcons = [
        "Akali/Info/Akali_Square_0.dds",
        "Alistar/Info/Minotaur_Square.dds",
        "Amumu/Info/SadMummy_Square.dds",
        "Anivia/Info/Cryophoenix_Square.dds",
        "Annie/Info/Annie_Square.dds",
        "Ashe/Info/Bowmaster_Square.dds",
        "Blitzcrank/Info/Steamgolem_Square.dds",
        "Brand/info/Brand_Square.dds",
        "Caitlyn/Info/Caitlyn_Square_0.dds",
        "Cassiopeia/Info/Cassiopeia_Square_0.dds",
        "Chogath/Info/GreenTerror_Square.dds",
        "Corki/Info/Corki_Square.dds",
        "DrMundo/Info/DrMundo_Square.dds",
        "Evelynn/Info/Evelynn_Square.dds",
        "Ezreal/Info/Ezreal_Square.dds",
        "FiddleSticks/info/Fiddlesticks_Square.dds",
        "Galio/info/Galio_Square.dds",
        "Gangplank/Info/Pirate_Square.dds",
        "Garen/Info/Garen_Square.dds",
        "Gragas/Info/Gragas_Square.dds",
        "Heimerdinger/info/Heimerdinger_Square.dds",
        "Irelia/Info/Irelia_Square_0.dds",
        "Janna/info/Janna_Square.dds",
        "JarvanIV/Info/JarvanIV_Square_0.dds",
        "Jax/info/Armsmaster_Square.dds",
        "Karma/Info/KarmaSquare.dds",
        "Karthus/Info/Lich_Square.dds",
        "Kassadin/Info/Kassadin_Square.dds",
        "Katarina/Info/Katarina_Square.dds",
        "Kayle/Info/Judicator_Square.dds",
        "Kennen/Info/Kennen_Square.dds",
        "KogMaw/Info/Kog'Maw_Square_0.dds",
        "Leblanc/Info/Leblanc_Square.dds",
        "LeeSin/info/LeeSin_Square.dds",
        "Leona/Info/Leona_Square.dds",
        "Lux/Info/Lux_Square.dds",
        "Malphite/info/Malphite_Square.dds",
        "Malzahar/info/Malzahar_Square.dds",
        "Maokai/Info/Maokai_Square.dds",
        "MasterYi/Info/MasterYi_Square.dds",
        "MissFortune/Info/MissFortune_Square.dds",
        "MonkeyKing/Info/MonkeyKing_Square.dds",
        "Mordekaiser/Info/Mordekaiser_Square.dds",
        "Morgana/Info/FallenAngel_Square.dds",
        "Nasus/Info/Nasus_Square.dds",
        "Nidalee/Info/Nidalee_Square.dds",
        "Nocturne/Info/Nocturne_Square_0.dds",
        "Nunu/Info/Yeti_Square.dds",
        "Olaf/Info/Olaf_Square.dds",
        "Orianna/Info/Oriana_Square.dds",
        "Pantheon/Info/Pantheon_Square.dds",
        "Poppy/info/Poppy_Square.dds",
        "Rammus/Info/Armordillo_Square.dds",
        "Renekton/Info/Renekton_Square_0.dds",
        "Riven/Info/Riven_Square.dds",
        "Rumble/Info/Rumble_Square.dds",
        "Ryze/Info/Ryze_Square.dds",
        "Shaco/Info/Jester_Square.dds",
        "Shen/info/Shen_Square.dds",
        "Singed/Info/ChemicalMan_Square.dds",
        "Sion/Info/Sion_Square.dds",
        "Sivir/Info/Sivir_Square.dds",
        "Skarner/Info/Skarner_Square.dds",
        "Sona/info/Sona_Square.dds",
        "Soraka/info/Soraka_Square.dds",
        "Swain/Info/Swain_Square_0.dds",
        "Talon/Info/Talon_Square_0.dds",
        "Taric/Info/GemKnight_Square.dds",
        "Teemo/Info/Teemo_Square.dds",
        "Tristana/Info/Tristana_Square.dds",
        "Trundle/Info/Trundle_Square.dds",
        "Tryndamere/Info/DarkChampion_Square.dds",
        "TwistedFate/Info/Cardmaster_Square.dds",
        "Twitch/Info/twitch_square.dds",
        "Udyr/Info/Udyr_Square.dds",
        "Urgot/Info/Urgot_Square_0.dds",
        "Vayne/Info/Vayne_Square.dds",
        "Veigar/Info/Veigar_Square.dds",
        "Vladimir/Info/Vladimir_Square_0.dds",
        "Warwick/Info/Warwick_Square.dds",
        "Xerath/info/Xerath_Square_0.dds",
        "XinZhao/Info/XenZhao_Square.dds",
        "Yorick/Info/Yorick_Square.dds",
        "Zilean/Info/Chronokeeper_Square.dds",
    ]
    
    charactersDirRelative = path.join(this.dirName, 'DATA', 'Characters')

    championsIconsCache = Object.fromEntries(
        this.championsIcons
        .map(shortUnixIconPath => {
            const m = /^(?<champion>.*?)\/Info\/(?<file>.*?)$/i.exec(shortUnixIconPath)
            const champion = m!.groups!.champion!.toLowerCase()
            const iconPathRelative = path.join(this.charactersDirRelative, ...shortUnixIconPath.split('/'))
            return [ champion, iconPathRelative ]
        })
    )

    getRelativeChampionIconPath(championName: string){
        return this.championsIconsCache[championName.toLowerCase()]
    }

    spellIcons = [
        "SummonerObserver.dds",
        "SummonerMana.dds",
        "SummonerIgnite.dds",
        "SummonerGarrison.dds",
        "SummonerCleanse.dds",
        "Summoner_teleport.dds",
        "Summoner_suppression.dds",
        "Summoner_smite.dds",
        "Summoner_revive.dds",
        "Summoner_rally.dds",
        "Summoner_promote.dds",
        "Summoner_heal.dds",
        "Summoner_haste.dds",
        "Summoner_fortify.dds",
        "Summoner_flash.dds",
        "Summoner_Exhaust.dds",
        "Summoner_Clairvoyance.dds",
        "Summoner_Boost.dds",
    ]

    spellsDirRelative = path.join(this.dirName, 'DATA', 'Spells', 'Icons2D')

    spellsIconsCache = Object.fromEntries(
        this.spellIcons
        .map(fileName => {
            const m = /^Summoner_?(?<spell>.*)\.dds$/i.exec(fileName)
            const shortSpellName = m!.groups!.spell!.toLowerCase()
            const relativeIconPath = path.join(this.spellsDirRelative, fileName)
            return [ shortSpellName, relativeIconPath ]
        })
    )

    getRelativeSummonerSpellIconPath(spellName: string){
        return this.spellsIconsCache[spellName.toLowerCase()]
    }
}()

const sdkVer = '9.0.300'

const sdkPlatformMap: Record<string, string> = {
    'win32': 'win',
    'linux': 'linux',
    'darwin': 'osx',
}
const sdkPlatform = sdkPlatformMap[process.platform]
if(!sdkPlatform) throw new Error(`Unsupported platform: ${process.platform}`)

const sdkArchMap: Record<string, string> = {
    'x64': 'x64',
    'ia32': 'x86',
    'arm': 'arm',
    'arm64': 'arm64',
}
const sdkArch = sdkArchMap[process.arch]
if(!sdkArch) throw new Error(`Unsupported arch: ${process.arch}`)

const sdkName = `dotnet-sdk-${sdkVer}-${sdkPlatform}-${sdkArch}`
const sdkZipExt = (sdkPlatform == 'win') ? '.zip' : '.tar.gz'
const sdkZipName = `${sdkName}${sdkZipExt}`
const sdkZipInfo = {
    'dotnet-sdk-9.0.300-win-x64.zip': {
        ihv1: '249a75bd3c8abba27b59fe42ab0771f77d6caee7',
        ihv2: '1220418d03e796bd159ed3ff24606a7b4948e520fbc4e93a172fc8a1798c51bc5647',
        embeddedTorrent: embedded.sdkForWinZipTorrent,
        size: 298580138,
    },
    'dotnet-sdk-9.0.300-linux-x64.tar.gz': {
        ihv1: 'f859eefcf797348b967220427a721655a9af0bc8',
        ihv2: '1220db828e2a00844b2ad1a457b03e521d24a0b03d4746b0e849bcf0ea1d2b34eb77',
        embeddedTorrent: embedded.sdkForLinuxZipTorrent,
        size: 217847129,
    },
}[sdkZipName]
if(!sdkZipInfo)
    throw new Error(`Unsupported dotnet-sdk-version-platform-arch.ext combination: ${sdkZipName}`)

export const sdkPkg = new class extends PkgInfoExe {
    dirName = sdkName
    noDedup = true
    zipExt = sdkZipExt
    zipName = sdkZipName
    zipInfoHashV1 = sdkZipInfo!.ihv1
    zipInfoHashV2 = sdkZipInfo!.ihv2
    zipSize = sdkZipInfo!.size
    
    dir = path.join(downloads, this.dirName)
    zip = path.join(downloads, this.zipName)
    zipTorrent = `${this.zip}.torrent`
    zipTorrentEmbedded = sdkZipInfo!.embeddedTorrent
    zipMagnet = magnet(this.zipInfoHashV1, this.zipInfoHashV2, this.zipName, this.zipSize)

    exeDir = this.dir
    exeExt = (sdkPlatform == 'win') ? '.exe' : ''
    exeName = `dotnet${this.exeExt}`
    exe = path.join(this.dir, this.exeName)

    zipWebSeed = `https://builds.dotnet.microsoft.com/dotnet/Sdk/${sdkVer}/${sdkZipName}`

    topLevelEntries = [
        this.exeName,
        'host',
        'packs',
        'sdk',
        'sdk-manifests',
        'shared',
        'templates',
    ]
    topLevelEntriesOptional = [
        'metadata',
        'LICENSE.txt',
        'ThirdPartyNotices.txt',
    ]
}()

export const gs420Pkg = new class extends PkgInfoCSProj {
    dirName = 'GameServer'
    noDedup = false
    zipExt = '.7z'
    zipName = `Chronobreak.GameServer${this.zipExt}`
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

export interface PkgInfoGit extends PkgInfo {
    gitRevision: string
    gitOrigin: string
    gitBranch: string
}

export const gsPkg = new class extends PkgInfoCSProj {
    dirName = 'ChildrenOfTheGrave-Gameserver'
    noDedup = false
    zipExt = '.7z'
    zipName = `${this.dirName}${this.zipExt}`
    zipInfoHashV1 = '83155823dd0deb73cab3127dfbcfeb4091050f4f'
    zipInfoHashV2 = 'b84a60529bca79815d8858ec6430d180590b37516a8a84af8d4c1c97a0ce7bfd'
    zipSize = 16682132
    
    dir = path.join(downloads, this.dirName)
    zip = path.join(downloads, this.zipName)
    zipTorrentEmbedded = embedded.gsPkgZipTorrent
    zipTorrent = `${this.zip}.torrent`
    zipMagnet = magnet(this.zipInfoHashV1, this.zipInfoHashV2, this.zipName, this.zipSize)
    zipMega = 'https://mega.nz/file/Oz5lDKiQ#RWwgpmkdUn1MrqLg8p8idkPj8Z0mxzFYgPzCmAi55Is'
    zipEmbded = embedded.gsPkgZip

    gitRevision = '4592f1379ddaa972ce0b5dc6cebb9caf09c812ab'
    gitOrigin = 'https://gitgud.io/skelsoft/brokenwings.git'
    gitBranch = 'master'

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

export const gitPkg = new class extends PkgInfoExe {
    dirName = 'PortableGit'
    
    zipExt = '.7z.exe'
    zipName = 'PortableGit-2.51.0.2-64-bit.7z.exe'
    zipWebSeed = `https://github.com/git-for-windows/git/releases/download/v2.51.0.windows.2/${this.zipName}`
    //zipEmbded = embedded.gitZip
    noDedup = true
    
    dir = path.join(downloads, this.dirName)
    zip = path.join(downloads, this.zipName)
    
    postInstallRelative = path.join(this.dirName, 'post-install.bat')
    postInstall = path.join(downloads, this.postInstallRelative)

    exeDir = path.join(this.dir, 'bin')
    exe = path.join(this.exeDir, 'git.exe')
    
    zipSize = 60539504
    zipInfoHashV1 = 'd8100b57f4aea2df80dbda17afbb58749dc259d9'
    zipInfoHashV2 = '02a56579cd8c21df86b44c6b28009a1a9b532b363081e520ef9043fb8d12a464'
    zipMagnet = magnet(this.zipInfoHashV1, this.zipInfoHashV2, this.zipName, this.zipSize)
    zipTorrentEmbedded = embedded.gitZipTorrent
    zipTorrent = `${this.zip}.torrent`

    topLevelEntries = [
        'cmd',
        'mingw64',
        'etc',
        'bin',
        'usr',
        'git-cmd.exe',
        'git-bash.exe',
    ]
    topLevelEntriesOptional = [
        'tmp',
        'dev',
        'LICENSE.txt',
        'README.portable',
        'post-install.bat',
    ]
}

export const packages = [ gsPkg, gcPkg, sdkPkg, gitPkg ]

for(const a of packages)
    for(const b of packages)
        if(a != b)
            console.assert(
                new Set(a.topLevelEntries).isDisjointFrom(new Set(b.topLevelEntries)),
                'Packages %s and %s intersecting at the top level',
                a.dirName, b.dirName
            )

export async function repairTorrents(opts: Required<AbortOptions>){
    return Promise.all(packages.filter(pkg => {
        return pkg.zipTorrent && pkg.zipTorrentEmbedded
    }).map(async pkg => {
        if(!await fs_exists(pkg.zipTorrent, opts)) try {
            await fs_copyFile(pkg.zipTorrentEmbedded, pkg.zipTorrent, opts)
        } catch(err) {
            console_log_fs_err('Extracting embedded torrent file', `${pkg.zipTorrentEmbedded} -> ${pkg.zipTorrent}`, err)
        }
        await fs_moveFile(path.join(downloads, `${pkg.zipInfoHashV1}.torrent`), pkg.zipTorrent, opts, false)
    }))
}
