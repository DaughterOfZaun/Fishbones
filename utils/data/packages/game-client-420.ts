import path from 'node:path'
import { downloads } from '../fs'
import embedded from '../embedded/embedded'
import { magnet, PkgInfoExe } from './shared'
import { tr } from '../../translation'

export const gc420Pkg = new class extends PkgInfoExe {
    name = tr('Game Client')
    dirName = 'League of Legends_UNPACKED'
    makeDir = false
    zipExt = '7z'
    zipName = `League of Legends_UNPACKED.${this.zipExt}`
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
