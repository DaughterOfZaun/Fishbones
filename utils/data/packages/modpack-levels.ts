import type { HardcodedMapInfo } from "../constants/maps"
import embedded from "../embedded/embedded"
import { downloads } from "../fs"
import { gcPkg } from "./game-client"
import { magnet, PkgInfo } from "./shared"
import path from 'node:path'

export const modPck1 = new class ModPackOne extends PkgInfo {
    id = 'modded_levels_1'
    name = 'Additional Maps Modpack'
    dirName = 'modded_levels_paste_on_client'
    makeDir = false

    zipExt = '7z'
    zipName = 'modded_levels_paste_on_client.7z'
    zipInfoHashV1 = '986b97c5128d152e2ee2b4017eb72cdb6bcfb028'
    zipInfoHashV2 = '0b5d812062a7bfc045d6e0dba9e2259c9839643e1d9781bf235599c4b33fff20'
    zipSize = 180297724

    zip = path.join(downloads, this.zipName)
    dir = path.join(path.dirname(gcPkg.dir), this.dirName)

    zipTorrentEmbedded = embedded.modPck1ZipTorrent
    zipTorrent = `${this.zip}.torrent`
    zipMagnet = magnet(this.zipInfoHashV1, this.zipInfoHashV2, this.zipName, this.zipSize)
    zipMega = 'https://mega.nz/file/ruZDDKTB#XNxrd3gr2GdxhqYPdgAWG2dT4sxBv9Q1mzMT1M-rjLc'

    //TODO: Set meaningful value.
    checkUnpackBy = path.join(this.dir, 'LEVELS', 'Map6', 'Scene', 'room.nvr')
    lockFile = path.join(gcPkg.dir, 'MODS', `${this.id}.installed`)

    topLevelEntries = []
    topLevelEntriesOptional = []

    hardcodedMaps: HardcodedMapInfo[] = [
        {
            id: 6,
            client: true,
            server: true,
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
        {
            id: 10,
            client: true,
            server: true,
            modes: [ 'CLASSIC' ],
            bots: [],
        },
    ]
}
