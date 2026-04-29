import embedded from "../embedded/embedded"
import { downloads } from "../fs"
import { gc126Pkg } from "./game-client-126"
import { gdrive, magnet, PkgInfo } from "./shared"
import { HARDCODED_HTTP_SERVER_URL } from '../../constants-build'
import { tr } from "../../translation"
import path from 'node:path'

export const modPck1 = new class ModPackOne extends PkgInfo {
    id = 'modded_levels_1'
    name = tr('Additional Maps Modpack')
    dirName = 'modded_levels_paste_on_client'
    makeDir = false

    zipExt = '7z'
    zipName = 'modded_levels_paste_on_client.7z'
    zipInfoHashV1 = '986b97c5128d152e2ee2b4017eb72cdb6bcfb028'
    zipInfoHashV2 = '0b5d812062a7bfc045d6e0dba9e2259c9839643e1d9781bf235599c4b33fff20'
    zipSize = 180297724
    size = 928982413

    zip = path.join(downloads, this.zipName)
    dir = ''

    zipTorrentEmbedded = embedded.modPck1ZipTorrent
    zipTorrentName = `${this.zipName}.torrent`
    zipTorrent = `${this.zip}.torrent`
    zipMagnet = magnet(this.zipInfoHashV1, this.zipInfoHashV2, this.zipName, this.zipSize)
    zipMega = 'https://mega.nz/file/ruZDDKTB#XNxrd3gr2GdxhqYPdgAWG2dT4sxBv9Q1mzMT1M-rjLc'
    zipWebSeeds = [
        gdrive(`1OWCNPQ6daIPS_nf3PjpnQzLAcBJAHXyv`),
        `${HARDCODED_HTTP_SERVER_URL}/${this.zipName}`,
    ]

    checkUnpackBy = ''
    lockFile = ''

    topLevelEntries = []
    topLevelEntriesOptional = []

    maps = {
        6: {},
        30: {},
    }

    constructor(){
        super()
        this.setDir(gc126Pkg.dir)
    }

    setDir(gcPkg_dir: string){
        this.dir = path.join(path.dirname(gcPkg_dir), this.dirName)
        this.checkUnpackBy = path.join(this.dir, 'LEVELS', 'Map6', 'Scene', 'room.nvr') //TODO: Set meaningful value.
        this.lockFile = path.join(gcPkg_dir, 'MODS', `${this.id}.installed`)
    }
}

gc126Pkg.onDirSet = modPck1.setDir.bind(modPck1)
