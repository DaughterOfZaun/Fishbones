import path from 'node:path'
import { downloads } from '../fs'
import embedded from '../embedded/embedded'
import { magnet, PkgInfoExe } from './shared'

export const gcPkg = new class extends PkgInfoExe {
    name = 'Game Client'
    dirName = 'playable_client_126'
    makeDir = false
    zipExt = '7z'
    zipName = `${this.dirName}.${this.zipExt}`
    zipInfoHashV1 = '875201f4a9920ffd7c9bff6c9a2ad59e28f041ae'
    zipInfoHashV2 = '6ccbb2911b07b2c084beb666d22018159845b3eae180b989d75b354af39c8af3'
    zipSize = 898175547

    release = '0.0.0.51' //TODO: Are you sure about that?
    dir = process.platform == 'win32' ?
        path.join('C:', 'Riot Games', 'League of Legends', 'RADS', 'solutions', 'lol_game_client_sln', 'releases', this.release) :
        path.join(downloads, this.dirName)
    
    zip = path.join(downloads, this.zipName)
    zipTorrentEmbedded = embedded.gcZipTorrent
    zipTorrent = `${this.zip}.torrent`
    zipMagnet = magnet(this.zipInfoHashV1, this.zipInfoHashV2, this.zipName, this.zipSize)
    zipMega = 'https://mega.nz/file/uqRmkCKC#nJFZ2hAYqTq5q-T1PExXPpu0aX4ALjjZj2SZ4q9yCpk'

    exeDir = this.dir
    exeName = 'League of Legends.exe'
    exe = path.join(this.exeDir, this.exeName)

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
        'd3dx9_39.dll',
    ]
}()
