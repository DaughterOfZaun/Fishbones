import path from 'node:path'
import { downloads } from '../fs'
import embedded from '../embedded/embedded'
import { gdrive, magnet, PkgInfoExe } from './shared'
import { tr } from '../../translation'
import { HARDCODED_HTTP_SERVER_URL } from '../../constants-build'

const sdkVer = '10.0.103'
const target = 'net10.0'

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
        //embeddedTorrent: embedded.sdkForWinZipTorrent,
        gdriveID: '1R5LNFJku72cIA2doBY712lKYoY_2-PQN',
        size: 298580138,
    },
    'dotnet-sdk-9.0.300-linux-x64.tar.gz': {
        ihv1: 'f859eefcf797348b967220427a721655a9af0bc8',
        ihv2: '1220db828e2a00844b2ad1a457b03e521d24a0b03d4746b0e849bcf0ea1d2b34eb77',
        //embeddedTorrent: embedded.sdkForLinuxZipTorrent,
        gdriveID: '1bSG-7_awXjHxmPWvH7C5Nk8Lvfe69hGj',
        size: 217847129,
    },
    'dotnet-sdk-10.0.103-win-x64.zip': {
        ihv1: '2d1e3ff1337aa28c33294e2cb452ee25228d38d1',
        ihv2: 'f9c5e1f3877b4cd822a3b55049296aa9f65660ecd5c554aceed8995bac05a1d0',
        embeddedTorrent: embedded.sdkForWinZipTorrent,
        gdriveID: '19ysy1IKE7neHGFzuIJjX_lpvD85q5k73',
        size: 302919366,
    },
    'dotnet-sdk-10.0.103-linux-x64.tar.gz': {
        ihv1: '8d43fe66baa0f7075b9ea2c073575fb7bc4bc1d1',
        ihv2: 'ed666364147bb55b58b03412b57f04575611d80a741fbb25537db8fa1e06269d',
        embeddedTorrent: embedded.sdkForLinuxZipTorrent,
        gdriveID: '1poxpDDCmcmJ09AT0NFiVaF6UgWpTeGFJ',
        size: 240189641,
    },
}[sdkZipName]
if(!sdkZipInfo)
    throw new Error(`Unsupported dotnet-sdk-version-platform-arch.ext combination: ${sdkZipName}`)

export const sdkPkg = new class extends PkgInfoExe {
    name = tr('.NET SDK')
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
    zipTorrentEmbedded = sdkZipInfo!.embeddedTorrent!
    zipMagnet = magnet(this.zipInfoHashV1, this.zipInfoHashV2, this.zipName, this.zipSize)

    exeDir = this.dir
    exeExt = (sdkPlatform == 'win') ? '.exe' : ''
    exeName = `dotnet${this.exeExt}`
    exe = path.join(this.dir, this.exeName)

    zipWebSeeds = [
        `https://builds.dotnet.microsoft.com/dotnet/Sdk/${sdkVer}/${sdkZipName}`,
        gdrive(sdkZipInfo!.gdriveID),
        `${HARDCODED_HTTP_SERVER_URL}/${this.zipName}`,
    ]

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
        'dnx',
        'metadata',
        'LICENSE.txt',
        'ThirdPartyNotices.txt',
    ]
    pathsToCheck = [
        `sdk/${sdkVer}`,
    ]

    target = target
}()
