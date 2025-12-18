import path from 'node:path'
import { downloads } from '../fs'
import embedded from '../embedded/embedded'
import { magnet, PkgInfoExe } from './shared'

export const gitPkg = new class extends PkgInfoExe {
    name = 'Git'
    dirName = 'PortableGit'
    
    zipExt = '7z.exe'
    zipName = 'PortableGit-2.51.0.2-64-bit.7z.exe'
    zipWebSeed = `https://github.com/git-for-windows/git/releases/download/v2.51.0.windows.2/${this.zipName}`
    //zipEmbded = embedded.gitZip
    makeDir = true
    
    dir = path.join(downloads, this.dirName)
    zip = path.join(downloads, this.zipName)
    
    postInstallName = 'post-install.bat'
    postInstallRelative = path.join(this.dirName, this.postInstallName)
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
        'post-install.bat',
    ]
    topLevelEntriesOptional = [
        'tmp',
        'dev',
        'LICENSE.txt',
        'README.portable',
    ]
}
