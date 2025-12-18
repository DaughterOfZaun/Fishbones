import path from 'node:path'
import { downloads } from '../fs'
import embedded from '../embedded/embedded'
import { magnet, PkgInfoExe } from './shared'

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
const sdkZipExt = (sdkPlatform == 'win') ? 'zip' : 'tar.gz'
const sdkZipName = `${sdkName}.${sdkZipExt}`
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
    name = '.NET SDK'
    dirName = sdkName
    makeDir = true
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
