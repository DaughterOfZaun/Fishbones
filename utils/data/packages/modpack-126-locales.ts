import embedded from "../embedded/embedded"
import { downloads } from "../fs"
import { gc126Pkg } from "./game-client-126"
import { gdrive, magnet, PkgInfo } from "./shared"
import { HARDCODED_HTTP_SERVER_URL } from '../../constants-build'
import { tr } from "../../translation"
import { args } from "../../args"
import path from 'node:path'

export const modPck2 = new class ModPackTwo extends PkgInfo {
    id = 'additional_locales_1'
    name = tr('Additional Locales For 1.0.0.126')
    dirName = 'additional_locales_for_126'
    makeDir = false

    zipExt = '7z'
    zipName = 'additional_locales_for_126.7z'
    zipInfoHashV1 = '6b04ed51f4cce0e8434105622147423861ed97b5'
    zipInfoHashV2 = '17b45a09a44817d874af858293fa4be2c52da17e34a6b48c3dc60c06b7e5a802'
    zipSize = 666607239
    size = 734957771

    zip = path.join(downloads, this.zipName)
    dir = ''

    zipTorrentEmbedded = embedded.modPck2ZipTorrent
    zipTorrentName = `${this.zipName}.torrent`
    zipTorrent = `${this.zip}.torrent`
    zipMagnet = magnet(this.zipInfoHashV1, this.zipInfoHashV2, this.zipName, this.zipSize)
    zipMega = 'https://mega.nz/file/66ZAwYrB#cz1MC-NWyngVOLz5nluuttVNXU9wnr3hgMXpcjen5Rw'
    zipWebSeeds = [
        gdrive(`16tjE5oLU36w3aFaxxB6i8OXqB8P52lGd`),
        `${HARDCODED_HTTP_SERVER_URL}/${this.zipName}`,
    ]

    checkUnpackBy = ''
    lockFile = ''

    topLevelEntries = []
    topLevelEntriesOptional = []

    locales = [ 'pl_PL', 'fr_FR', 'es_ES', 'en_GB', 'de_DE' ]

    constructor(){
        super()
        this.setDir(gc126Pkg.dir)
    }

    setDir(gcPkg_dir: string){
        this.dir = path.join(path.dirname(gcPkg_dir), this.dirName)
        this.checkUnpackBy = path.join(this.dir, 'DATA', 'Sounds', 'FMOD', 'VOBank_pl_PL.fsb') //TODO: Set meaningful value.
        this.lockFile = path.join(gcPkg_dir, 'MODS', `${this.id}.installed`)
    }
}

gc126Pkg.onDirSet.push(modPck2.setDir.bind(modPck2))
