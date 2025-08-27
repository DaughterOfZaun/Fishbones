import path from 'node:path'
import { promises as fs } from "node:fs"
import { downloads, fs_copyFile, fs_exists } from './data-shared'

const magnet = (ihv1?: string, ihv2?: string, fname?: string, size?: number) => {
    const parts: string[] = []
    if(ihv1) parts.push(`xt=urn:btih:${ihv1}`)
    if(ihv2) parts.push(`xt=urn:btmh:${ihv2}`)
    if(fname) parts.push(`dn=${fname}`)
    if(size) parts.push(`xl=${size}`)
    return `magnet:?${parts.join('&')}`
}

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
    abstract zipTorrentEmbded: string
    abstract zipTorrent: string
    abstract zipMagnet: string
    
    abstract checkUnpackBy: string
    
    zipWebSeed?: string
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
    abstract dllDir: string
    abstract dllName: string
    abstract dll: string

    abstract program: string
}

//@ts-expect-error: Cannot find module or its corresponding type declarations.
import gcZipTorrent from '../Fishbones_Data/League of Legends_UNPACKED.7z.torrent' with { type: 'file' }
export const gcPkg = new class extends PkgInfoExe {
    dirName = 'League of Legends_UNPACKED'
    noDedup = false
    zipExt = '.7z'
    zipName = `League of Legends_UNPACKED${this.zipExt}`
    zipInfoHashV1 = '4bb197635194f4242d9f937f0f9225851786a0a8'
    zipInfoHashV2 = ''
    zipSize = 2171262108

    dir = path.join(downloads, this.dirName)
    zip = path.join(downloads, this.zipName)
    zipTorrentEmbded = gcZipTorrent
    zipTorrent = `${this.zip}.torrent`
    zipMagnet = magnet(this.zipInfoHashV1, this.zipInfoHashV2, this.zipName, this.zipSize)
    zipMega = 'https://mega.nz/file/Hr5XEAqT#veo2lfRWK7RrLUdFBBqRdUvxwr_gd8UyUL0f6b4pHJ0'

    exeDir = path.join(this.dir, 'League-of-Legends-4-20', 'RADS', 'solutions', 'lol_game_client_sln', 'releases', '0.0.1.68', 'deploy')
    exe = path.join(this.exeDir, 'League of Legends.exe')
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
if(!sdkArchMap) throw new Error(`Unsupported arch: ${process.arch}`)

//@ts-expect-error: Cannot find module or its corresponding type declarations.
import sdkForLinuxZipTorrent from '../Fishbones_Data/dotnet-sdk-9.0.300-linux-x64.tar.gz.torrent' with { type: 'file' }
//@ts-expect-error: Cannot find module or its corresponding type declarations.
import sdkForWinZipTorrent from '../Fishbones_Data/dotnet-sdk-9.0.300-win-x64.zip.torrent' with { type: 'file' }

const sdkName = `dotnet-sdk-${sdkVer}-${sdkPlatform}-${sdkArch}`
const sdkZipExt = (sdkPlatform == 'win') ? '.zip' : '.tar.gz'
const sdkZipName = `${sdkName}${sdkZipExt}`
const sdkZipInfo = {
    'dotnet-sdk-9.0.300-win-x64.zip': {
        ihv1: '249a75bd3c8abba27b59fe42ab0771f77d6caee7',
        ihv2: '1220418d03e796bd159ed3ff24606a7b4948e520fbc4e93a172fc8a1798c51bc5647',
        embdedTorrent: sdkForWinZipTorrent,
        size: 298580138,
    },
    'dotnet-sdk-9.0.300-linux-x64.tar.gz': {
        ihv1: 'f859eefcf797348b967220427a721655a9af0bc8',
        ihv2: '1220db828e2a00844b2ad1a457b03e521d24a0b03d4746b0e849bcf0ea1d2b34eb77',
        embdedTorrent: sdkForLinuxZipTorrent,
        size: 217847129,
    },
}[sdkZipName]!
if(!sdkZipInfo)
    throw new Error(`Unsupported dotnet-sdk-version-platform-arch.ext combination: ${sdkZipName}`)

export const sdkPkg = new class extends PkgInfoExe {
    dirName = sdkName
    noDedup = true
    zipExt = sdkZipExt
    zipName = sdkZipName
    zipInfoHashV1 = sdkZipInfo.ihv1
    zipInfoHashV2 = sdkZipInfo.ihv2
    zipSize = sdkZipInfo.size
    
    dir = path.join(downloads, this.dirName)
    zip = path.join(downloads, this.zipName)
    zipTorrent = `${this.zip}.torrent`
    zipTorrentEmbded = sdkZipInfo.embdedTorrent
    zipMagnet = magnet(this.zipInfoHashV1, this.zipInfoHashV2, this.zipName, this.zipSize)

    exeDir = this.dir
    exeExt = (sdkPlatform == 'win') ? '.exe' : ''
    exe = path.join(this.dir, `dotnet${this.exeExt}`)

    zipWebSeed = `https://builds.dotnet.microsoft.com/dotnet/Sdk/${sdkVer}/${sdkZipName}`
}()

//@ts-expect-error: Cannot find module or its corresponding type declarations.
import gsPkgZipTorrent from '../Fishbones_Data/Chronobreak.GameServer.7z.torrent' with { type: 'file' }
export const gsPkg = new class extends PkgInfoCSProj {
    dirName = 'GameServer'
    noDedup = false
    zipExt = '.7z'
    zipName = `Chronobreak.GameServer${this.zipExt}`
    zipInfoHashV1 = 'e4043fdc210a896470d662933f7829ccf3ed781b'
    zipInfoHashV2 = 'cf9bfaba0f9653255ff5b19820ea4c01ac8484d0f8407b109ca358236d4f4abc'
    zipSize = 21309506
    
    dir = path.join(downloads, this.dirName)
    zip = path.join(downloads, this.zipName)
    zipTorrentEmbded = gsPkgZipTorrent
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
}()

export const packages = [gsPkg, gcPkg, sdkPkg]
export function repairTorrents(){
    return Promise.all(packages.map(async pkg => {
        if(!await fs_exists(pkg.zipTorrent, false)) try {
            await fs_copyFile(pkg.zipTorrentEmbded, pkg.zipTorrent)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-empty
        } catch(err) {}
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-empty
        try { await fs.rename(path.join(downloads, `${pkg.zipInfoHashV1}.torrent`), pkg.zipTorrent) } catch(err) {}
    }))
}
