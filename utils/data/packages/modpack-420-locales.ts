import embedded from "../embedded/embedded"
import { downloads } from "../fs"
import { gc420Pkg } from "./game-client-420"
import { gdrive, magnet, PkgInfo } from "./shared"
import { HARDCODED_HTTP_SERVER_URL } from '../../constants-build'
import { tr, usedLocale } from "../../translation"
import { args } from "../../args"
import path from 'node:path'
import { pickRandom } from "../../helpers"

interface Archive {
    name: string
    dirs: string[]
    locales: string[]
    gdrive: string
    mega: string
    ihv1: string
    torrent: string
    zipSize: number
    size: number
}
const archives: Archive[] = [
    {
        name: 'romance.1',
        dirs: [ 'es_ES', 'es_MX', 'pt_BR' ],
        locales: [ 'es_AR', 'es_ES', 'es_MX', 'pt_BR' ],
        gdrive: '1VkWd3Ybeg2CjO8TmIG5Uhak-OxveDDbG',
        mega: 'https://mega.nz/file/3rgRzRJZ#qYEp3jY4g1DeBW-iUdud54CBMrCZh7woH2sfWvh9XYc',
        ihv1: '0d37bb7d62c7e6a490bdde4a3597a986f8e0ccfd',
        torrent: embedded.modPck3ZipTorrent,
        zipSize: 863896826,
        size: 910568693,
    },
    {
        name: 'romance.2',
        dirs: [ 'it_IT', 'ro_RO', 'fr_FR' ],
        locales: [ 'it_IT', 'ro_RO', 'fr_FR' ],
        gdrive: '1bZHdBKny0ibrrqGrAsQ-40uTwimNCNhH',
        mega: 'https://mega.nz/file/H6xSVZAR#MlzDsUoQStF6pPZbU7ieROgk1VYLl6rM3ymoFNbp_Ts',
        ihv1: 'f4e36e698ef1a166618ed4afbf297c44e044b41e',
        torrent: embedded.modPck4ZipTorrent,
        zipSize: 853683764,
        size: 903819554,
    },
    {
        name: 'slavic',
        dirs: [ 'cs_CZ', 'pl_PL', 'ru_RU' ],
        locales: [ 'cs_CZ', 'pl_PL', 'ru_RU' ],
        gdrive: '1W6bzuVaVqyvq6neQ-cZXxgUiwql1IGG-',
        mega: 'https://mega.nz/file/j3ZnFJaA#2SF-JjcTNqo2EwTAfQtwtcMgt1DMDZT-v9HxK36V_ag',
        ihv1: '2edf66d0decb0da41baad6e9862ee4e43da44f2d',
        torrent: embedded.modPck5ZipTorrent,
        zipSize: 882390358,
        size: 931402642,
    },
    {
        name: 'asian',
        dirs: [ 'ko_KR' ],
        locales: [ 'ko_KR' ],
        gdrive: '1xqSs8QqtOATGdoPxnNMQeo7Gdo0ztLl_',
        mega: 'https://mega.nz/file/aqZwgaRY#0jmCyuUjFIYDL8nh9GySClYinCsutYt1uH_bkKxd-8c',
        ihv1: 'd1db354654a781fc3e3c0e71ec43092ff0d13e77',
        torrent: embedded.modPck6ZipTorrent,
        zipSize: 304781591,
        size: 319353868,
    },
    {
        name: 'other',
        dirs: [ 'de_DE', 'el_GR', 'hu_HU', 'tr_TR' ],
        locales: [ 'de_DE', 'el_GR', 'hu_HU', 'tr_TR' ],
        gdrive: '1M6ieBxLGL6JAbo54eSWMroGyAd4Z9we8',
        mega: 'https://mega.nz/file/e6ZBxRAQ#BbVatwM4erYb6RlC7T9QE61Hgv3HhtkhilNvgRQyS1c',
        ihv1: '629ec8431aac972e9a618f88e355c8c4dac4b6af',
        torrent: embedded.modPck7ZipTorrent,
        zipSize: 1116484864,
        size: 1178618572,
    },
]
//const emptyArchive: Archive = undefined!
const emptyArchive: Archive = {
    name: 'none',
    dirs: [],
    locales: [],
    gdrive: '',
    mega: '',
    ihv1: '',
    torrent: '',
    zipSize: 0,
    size: 0,
}

const archivesByLocale = Object.fromEntries(archives.flatMap(archive => archive.locales.map(locale => [ locale, archive ])))

args.usedLocale.on('change', () => modPck3.setLocale(usedLocale))
gc420Pkg.onDirSet.push(dir => modPck3.setDir(dir))

export const modPck3 = new class ModPackThree extends PkgInfo {

    private gcPkg!: { dir: string }
    private archive: Archive = emptyArchive
    
    get isSupported(){ return this.archive != emptyArchive }

    get name(){ return tr('Additional Locales For 4.20') }
    get id(){ return `additional_locales_${this.archive.name.replaceAll('.', '_')}` } 

    get zipExt(){ return '7z' }
    get makeDir(){ return true }
    get dirName(){ return `additional_locales_for_420.${this.archive.name}` }
    get zipName(){ return `additional_locales_for_420.${this.archive.name}.7z` }
    get zipInfoHashV1(){ return this.archive.ihv1 }
    get zipInfoHashV2(){ return '' } //TODO: Make a hybrid v1+v2 torrent.
    get zipSize(){ return this.archive.zipSize }
    get size(){ return this.archive.size }

    get zip(){ return path.join(downloads, this.zipName) }
    get dir(){ return path.join(path.dirname(this.gcPkg.dir), this.dirName) }
    get moveTo(){ return path.join(this.gcPkg.dir, 'DATA', 'Sounds', 'Wwise', 'VO') }

    get zipTorrentEmbedded(){ return this.isSupported ? this.archive.torrent : '' }
    get zipTorrentName(){ return this.isSupported ? `${this.zipName}.torrent` : '' }
    get zipTorrent(){ return this.isSupported ? `${this.zip}.torrent` : '' }
    get zipMagnet(){ return this.isSupported ? magnet(this.zipInfoHashV1, this.zipInfoHashV2, this.zipName, this.zipSize) : '' }

    get checkUnpackBy(){
        //TODO: Set meaningful value.
        const locale = pickRandom(this.archive.dirs)
        const champion = pickRandom([ 'Jinx', 'LeeSin', 'Ahri', 'Ezreal', 'Caitlyn' ])
        return path.join(this.dir, locale, 'Characters', champion, 'Skins', 'Base', `${champion}_Base_VO_audio.wpk`)
    }
    get lockFile(){ return path.join(this.gcPkg.dir, 'MODS', `${this.id}.installed`) }

    get locales(){ return this.archive.locales }
    get topLevelEntries(){ return this.archive.dirs }
    get topLevelEntriesOptional(){ return [] }

    constructor(){
        super()
        this.setDir(gc420Pkg.dir)
        this.setLocale(usedLocale)
    }

    setDir(gcPkg_dir: string){
        this.gcPkg ??= { dir: gcPkg_dir }
        this.gcPkg.dir = gcPkg_dir
    }

    setLocale(locale: string){
        
        this.archive = archivesByLocale[locale] ?? emptyArchive
        if(!this.isSupported) return

        this.zipMega = this.archive.mega
        this.zipWebSeeds = [
            gdrive(this.archive.gdrive),
            `${HARDCODED_HTTP_SERVER_URL}/${this.zipName}`,
        ]
    }
}
