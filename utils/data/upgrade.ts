import type { AbortOptions } from "@libp2p/interface"
import { console_log, createBar, currentExe } from "../../ui/remote/remote"
import { platform, VERSION, versionFromString as version, versionToString, date } from "../constants-build"
import { FBPkgInfo } from "./packages/self"
import { fs_exists } from "./fs"
import { appendPartialPackFileExt, pack } from "./unpack"
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
        updated_at: string
        browser_download_url: string
    }
}

export let _isNewVersionAvailable = false
export function isNewVersionAvailable(){
    return _isNewVersionAvailable
}

export let prev_fbPkg: FBPkgInfo | undefined
export let fbPkg = new FBPkgInfo(VERSION)
export async function checkForUpdates(opts: Required<AbortOptions>){

    //if(!args.upgrade.enabled){
    //    console.log(`Pretending to check for launcher updates...`)
    //    return
    //}

    const bar = createBar('Checking', 'updates')
    try {
        const releasesJSON = await fetch(fbPkg.releasesURL, opts)
        const releases = await releasesJSON.json() as GitHub.Release[]
        const release = releases.sort((a, b) => date(b.published_at) - date(a.published_at)).at(0)!
        const assets = release.assets.sort((a, b) => version(b.name) - version(a.name))
        const zip = assets.find(asset => asset.name.includes(platform) && asset.name.endsWith('.' + fbPkg.zipExt))

        if(!zip){
            console_log('No suitable launcher update archive found.')
            return
        }
        
        const zipVersion = version(zip.name)
        const fbVersion = version(fbPkg.version)
        console_log(
            `Latest available version: ${zip.name} (${zipVersion})\n` +
            `Currently running version: ${fbPkg.zipName} (${fbVersion})`
        )
        if(zipVersion <= fbVersion){
            console_log('Already using the latest launcher version.')
        } else {

            _isNewVersionAvailable = true

            prev_fbPkg = fbPkg
            fbPkg = new FBPkgInfo(versionToString(zipVersion))
            fbPkg.zipWebSeed = zip.browser_download_url
            fbPkg.zipSize = zip.size
            
            //await fs_removeFile(fbPkg.zip, opts, true)
            //await fs_removeFile(fbPkg.zipTorrent, opts, true)

            const torrent = assets.find(asset => asset.name == zip.name + '.torrent')
            if(torrent){
                try {
                    if(await fs_exists(fbPkg.zipTorrent, opts)){
                        console_log(`${fbPkg.zipTorrent} exists already`)
                    } else {
                        const zipTorrentURL = torrent.browser_download_url
                        const zipTorrentResponse = await fetch(zipTorrentURL, opts)
                        const zipTorrentBytes = await zipTorrentResponse.bytes()
                        const zipTorrentPartial = appendPartialDownloadFileExt(fbPkg.zipTorrent)
                        await fs.writeFile(zipTorrentPartial, zipTorrentBytes)
                        await fs.rename(zipTorrentPartial, fbPkg.zipTorrent)
                    }
                } catch(err) {
                    console_log(`${fbPkg.zipTorrent} download failed:`, Bun.inspect(err))
                    fbPkg.zipTorrent = ''
                }
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

export function appendPartialDownloadFileExt(zip: string){
    return `${zip}.part`
}

export async function repairSelfPackage(opts: Required<AbortOptions>){

    const lockfile = appendPartialPackFileExt(fbPkg.zip)
    if(!(await fs_exists(fbPkg.zip, opts)) || await fs_exists(lockfile, opts, false)){
        fbPkg.zipSize = await pack({
            exeName: fbPkg.exeName,
            zipName: fbPkg.zipName,
            exe: currentExe,
            zip: fbPkg.zip,
        }, opts)
    }
    if(!(await fs_exists(fbPkg.zipTorrent, opts))){
        const buffer = await new Promise<Buffer>((resolve, reject) => {
            createTorrent(fbPkg.zip, { creationDate: 1 }, (err, torrent) => {
                if(err) reject(err)
                else resolve(torrent)
            })
        })
        await fs.writeFile(fbPkg.zipTorrent, buffer)
    }
}
