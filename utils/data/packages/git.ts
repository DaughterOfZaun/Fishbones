import path from 'node:path'
import { downloads } from '../fs'
import embedded from '../embedded/embedded'
import { magnet, PkgInfoExe } from './shared'
import { tr } from '../../translation'

export const gitPkg = new class extends PkgInfoExe {
    name = tr('Git')
    dirName = 'PortableGit'

    zipExt = '7z.exe'
    version = '2.52.0'; subversion = 1
    zipName = `PortableGit-${this.version}-64-bit.${this.zipExt}`
    zipWebSeed = `https://github.com/git-for-windows/git/releases/download/v${this.version}.windows.${this.subversion}/${this.zipName}`
    //zipEmbded = embedded.gitZip
    makeDir = true

    dir = path.join(downloads, this.dirName)
    zip = path.join(downloads, this.zipName)

    postInstallName = 'post-install.bat'
    postInstallRelative = path.join(this.dirName, this.postInstallName)
    postInstall = path.join(downloads, this.postInstallRelative)

    exeDir = path.join(this.dir, 'bin')
    exe = path.join(this.exeDir, 'git.exe')

    zipSize = 60238232
    zipInfoHashV1 = '8d7c5f9f582510706226509d0e44fb0045b0caaf'
    zipInfoHashV2 = '5a23f2797b1993e221b348749a23a54cc84be1969a03aed63add65eb7e30670c'
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
        'post-install.bat',
    ]
    topLevelEntriesOptional = [
        'tmp',
        'dev',
        'LICENSE.txt',
        'README.portable',
    ]
}
