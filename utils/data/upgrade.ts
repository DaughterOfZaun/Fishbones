import type { AbortOptions } from "@libp2p/interface"
import { console_log, createBar } from "../../ui/remote/remote"
import { VERSION, VERSION_REGEX } from "../constants-build"
import { downloads, fs_stat } from "./fs"
import { PkgInfo } from "./packages"
import path from 'node:path'
import { pack } from "./unpack"
import createTorrent from 'create-torrent'
import fs from 'node:fs/promises'

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace GitHub {
    export type Release = {
        published_at: string
        assets: Asset[]
    }
    export type Asset = {
        name: string
        size: number
        digest: string
        uploaded_at: string
        browser_download_url: string
    }
}

const platform =
    process.platform === 'win32' ? 'windows' :
    process.platform === 'linux' ? 'linux' :
    undefined!

const date = (str: string) => new Date(str).getTime()
const extractVersion = (str: string) => {
    const m = str.match(VERSION_REGEX)
    if(m){
        return 0
            | parseInt(m[4]!) << 8 * 0
            | parseInt(m[3]!) << 8 * 1
            | parseInt(m[2]!) << 8 * 2
            | parseInt(m[1]!) << 8 * 3
    }
    return 0
}

class FBPkgInfo extends PkgInfo {
    
    dirName = 'Fishbones'
    exeName = 'Fishbones.exe'
    noDedup = true

    // Mutable variables.
    version = extractVersion(VERSION)
    zipSize!: number
    zipWebSeed = ''

    zipExt = 'zip'
    zipName = `${this.dirName}.${this.zipExt}`
    torrentName = `${this.zipName}.torrent`
    zipInfoHashV1 = ''
    zipInfoHashV2 = ''
    zipMagnet = ''
    
    zip = path.join(downloads, this.zipName)
    dir = path.join(downloads, this.dirName)
    exe = path.join(this.dir, this.exeName)
    zipTorrentEmbedded = ''
    zipTorrent = path.join(downloads, this.torrentName)
    topLevelEntriesOptional = []
    topLevelEntries = [
        'Fishbones.exe'
    ]

    checkUnpackBy = this.exe
}

export let _isNewVersionAvailable = false
export function isNewVersionAvailable(){
    return _isNewVersionAvailable
}

export const fbPkg = new FBPkgInfo()
export async function checkForUpdates(opts: Required<AbortOptions>){
    const bar = createBar('Checking', 'updates')
    try {
        const releasesJSON = await fetch('https://api.github.com/repos/DaughterOfZaun/Fishbones/releases', opts)
        const releases = await releasesJSON.json() as GitHub.Release[]
        const release = releases.sort((a, b) => date(b.published_at) - date(a.published_at)).at(0)!
        const assets = release.assets.sort((a, b) => date(b.uploaded_at) - date(a.uploaded_at))
        const zip = assets.find(asset => asset.name.toLowerCase().includes(platform) && asset.name.endsWith('.' + fbPkg.zipExt))

        if(!zip){
            console_log('No suitable launcher update archive found.')
            return
        }
        
        const zipVersion = extractVersion(zip.name)
        console_log(zip.name, zipVersion, 'vs', VERSION, fbPkg.version)
        if(zipVersion <= fbPkg.version){
            console_log('Already using the latest launcher version.')
        } else {

            _isNewVersionAvailable = true

            fbPkg.version = zipVersion
            fbPkg.zipWebSeed = zip.browser_download_url
            fbPkg.zipSize = zip.size
            
            //await fs_removeFile(fbPkg.zip, opts, true)
            //await fs_removeFile(fbPkg.zipTorrent, opts, true)

            const torrent = assets.find(asset => asset.name == zip.name + '.torrent')
            if(torrent){
                const zipTorrentURL = torrent.browser_download_url
                const zipTorrentResponse = await fetch(zipTorrentURL, opts)
                const zipTorrentBytes = await zipTorrentResponse.bytes()
                await fs.writeFile(fbPkg.zipTorrent, zipTorrentBytes)
            } else {
                fbPkg.zipTorrent = ''
            }
        }
        
    } catch(err) {
        console_log('Update check failed:', Bun.inspect(err))
    } finally {
        bar.stop()
    }
}

export async function repairSelfPackage(opts: Required<AbortOptions>){

    const exeModTime = (await fs_stat(fbPkg.exe, opts))?.mtime ?? 0
    const zipModTime = (await fs_stat(fbPkg.zip, opts))?.mtime ?? 0
    if(exeModTime > zipModTime){
        fbPkg.zipSize = await pack(fbPkg, opts)
    }
    const zipTorrentModTime = (await fs_stat(fbPkg.zipTorrent, opts))?.mtime ?? 0
    if(exeModTime > zipTorrentModTime){
        const buffer = await new Promise<Buffer>((resolve, reject) => {
            createTorrent(fbPkg.zip, { creationDate: 1 }, (err, torrent) => {
                if(err) reject(err)
                else resolve(torrent)
            })
        })
        await fs.writeFile(fbPkg.zipTorrent, buffer)
    }

    //if(!args.upgrade.enabled){
    //    console.log(`Pretending to check for launcher updates...`)
    //    return
    //}
}