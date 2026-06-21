import type { AbortOptions } from "@libp2p/interface"
import { console_log, createBar, currentExe } from "../../ui/remote/remote"
import { platform, dateFromString, VERSION_FILE_DOMAIN, HARDCODED_KEY_ENCODING, HARDCODED_UPGRADE_PUBLIC_KEY, VERSION_NUMBER, versionFromString } from "../constants-build"
import { FBPkgInfo } from "./packages/self"
import { fs_exists, fs_moveFile, fs_readFile, fs_writeFile } from "./fs"
import { appendPartialPackFileExt, pack } from "./unpack"
import createTorrent from 'create-torrent'
import fs from 'node:fs/promises'
import { tr } from "../translation"
import { inspect } from 'node:util'
import { RecordEnvelope } from '@libp2p/peer-record'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { VersionFile } from '../../message/version.ts'
import { logger } from "../log.ts"
import { safeOptions } from "../process/process.ts"
import { magnet } from "./packages/shared.ts"
import { decompressVersionFile } from "./version.ts"

const VERSION_FILE_LIFETIME = 7/*d*/ * 24/*h*/ * 60/*m*/ * 60/*s*/ * 1000/*ms*/
const HTTP_FETCH_TIMEOUT = 10_000

type Result<T, E extends Error = Error> = { res: T, err?: undefined } | { err: E, res?: undefined }

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

export const fbPkg = new FBPkgInfo(VERSION_NUMBER)
export const fbPkgCurrent = Object.freeze(new FBPkgInfo(VERSION_NUMBER))
export async function checkForUpdates(opts: Required<AbortOptions>){

    //if(!args.upgrade.enabled){
    //    console.log(`Pretending to check for launcher updates...`)
    //    return
    //}

    const bar = createBar(tr('Checking for updates'), '')
    try {
        await checkForUpdatesImpl(opts)    
    } catch(err) {
        console_log(tr('Update check failed:', {}), inspect(err))
    } finally {
        bar.stop()
    }
}
async function checkForUpdatesImpl(opts: Required<AbortOptions>){

    let vf = await getOrLoadVersionFile(opts)
    let urlsToVisit = vf?.vfWebSeeds ?? fbPkg.vfWebSeeds
    const visitedUrls = new Set<string>()

    while(urlsToVisit.length > 0){
        const url = urlsToVisit.shift()!
        visitedUrls.add(url)
        
        logger.log('Fetching version file from:', url)
        const { err: fetchError, res: buffer } = await fetchBinary(url, opts)
        if(fetchError){
            logger.log('Fetching version file failed:', inspect(fetchError))
            continue
        }
        const { err: parseError, res: rvf } = await parseVersionFile(buffer, opts)
        if(parseError){
            logger.log('Parsing version file failed:', inspect(parseError))
            continue
        }
        
        if(!vf || vf.date < rvf.date){
            urlsToVisit = Array.from(new Set(rvf.vfWebSeeds).difference(visitedUrls))
            await saveVersionFile(rvf, opts)
            vf = rvf
        }

        if((Date.now() - vf.date) < VERSION_FILE_LIFETIME)
            break
    }
    
    if(vf && fbPkgCurrent.versionNumber <= vf.versionNumber)
        applyVersionFile()

    if(fbPkg.versionNumber <= fbPkgCurrent.versionNumber){
        console_log(tr('Already using the latest launcher version.', {}))
        return
    }

    _isNewVersionAvailable = true

    if(await fs_exists(fbPkg.zipTorrent, opts)){
        console_log(tr(`{fbPkg_zipTorrent} exists already`, { fbPkg_zipTorrent: fbPkg.zipTorrent }))
        return
    }
    
    for(const url of fbPkg.zipTorrentWebSeeds){
        const { err: fetchError, res: buffer } = await fetchBinary(url, opts)
        if(fetchError){
            logger.log('Fetching torrent file failed:', inspect(fetchError))
            continue
        }
        const tmpFile = appendPartialDownloadFileExt(fbPkg.zipTorrent)
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        await fs_writeFile(tmpFile, buffer, { ...opts, encoding: 'binary' }) &&
        await fs_moveFile(tmpFile, fbPkg.zipTorrent, opts)
        break
    }
}
async function fetchBinary(url: string, opts: Required<AbortOptions>): Promise<Result<Buffer>> {
    try {
        const signal = AbortSignal.any([ opts.signal, AbortSignal.timeout(HTTP_FETCH_TIMEOUT) ])
        const data = await fetch(url, { signal })
        const bytes = await data.bytes()
        opts.signal.throwIfAborted()
        const res = Buffer.from(bytes)
        return { res }
    } catch(err) {
        return { err: err as Error }
    }
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function checkReleasesPage(opts: Required<AbortOptions>){

    const releasesJSON = await fetch(fbPkg.releasesURL, opts)
    const releases = await releasesJSON.json() as GitHub.Release[]
    const release = releases.sort((a, b) => dateFromString(b.published_at) - dateFromString(a.published_at)).at(0)!
    const assets = release.assets.sort((a, b) => versionFromString(b.name) - versionFromString(a.name))
    const zip = assets.find(asset => asset.name.includes(platform) && asset.name.endsWith('.' + fbPkg.zipExt))

    if(!zip){
        console_log(tr('No suitable launcher update archive found.', {}))
        return
    }
    
    const zipVersionNumber = versionFromString(zip.name)
    console_log(tr('Latest version on releases page:', {}) + ` ${zip.name} (${zipVersionNumber})`)
    if(zipVersionNumber <= fbPkgCurrent.versionNumber){
        //console_log(tr('Already using the latest launcher version.', {}))
    } else {

        _isNewVersionAvailable = true

        fbPkg.versionNumber = zipVersionNumber
        fbPkg.zipWebSeeds = [ zip.browser_download_url ]
        fbPkg.zipSize = zip.size
        
        //await fs_removeFile(fbPkg.zip, opts, true)
        //await fs_removeFile(fbPkg.zipTorrent, opts, true)

        const torrent = assets.find(asset => asset.name == zip.name + '.torrent')
        if(torrent){
            try {
                if(await fs_exists(fbPkg.zipTorrent, opts)){
                    console_log(tr(`{fbPkg_zipTorrent} exists already`, { fbPkg_zipTorrent: fbPkg.zipTorrent }))
                } else {
                    const zipTorrentURL = torrent.browser_download_url
                    const zipTorrentResponse = await fetch(zipTorrentURL, opts)
                    const zipTorrentBytes = await zipTorrentResponse.bytes()
                    const zipTorrentPartial = appendPartialDownloadFileExt(fbPkg.zipTorrent)
                    await fs.writeFile(zipTorrentPartial, zipTorrentBytes)
                    await fs.rename(zipTorrentPartial, fbPkg.zipTorrent)
                }
            } catch(err) {
                console_log(tr(`{fbPkg_zipTorrent} download failed:`, { fbPkg_zipTorrent: fbPkg.zipTorrent }), inspect(err))
                //fbPkg.zipTorrent = ''
            }
        } else {
            //fbPkg.zipTorrent = ''
        }
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

export interface ParsedVersionFile {
    date: number
    versionNumber: number
    size: number
    zipSize: number
    zipInfoHashV1: string
    zipInfoHashV2: string
    vfWebSeeds: string[]
    zipWebSeeds: string[]
    zipTorrentWebSeeds: string[]
    releasesURL?: string
    buffer: Buffer
}
let parsedVersionFile: ParsedVersionFile | undefined = undefined
//export function getVersionFile(){ return parsedVersionFile }
//export function setVersionFile(to: ParsedVersionFile){
//    parsedVersionFile = to
//}
export function saveVersionFileInBackground(vf: ParsedVersionFile){
    void saveVersionFile(vf, safeOptions).catch((err) => {
        logger.log('Failed to save version file:', inspect(err))
    })
}
export async function saveVersionFile(vf: ParsedVersionFile, opts: Required<AbortOptions>){
    parsedVersionFile = vf
    return fs_writeFile(fbPkg.versionFile, vf.buffer, { ...opts, encoding: 'binary' })
}
export async function getOrLoadVersionFile(opts: Required<AbortOptions>){
    return parsedVersionFile ?
        Promise.resolve(parsedVersionFile) :
        loadVersionFile(opts)
}
export async function getOrLoadVersionFileString(opts: Required<AbortOptions>){
    return (await getOrLoadVersionFile(opts))?.buffer.toString('base64')
}
export async function loadVersionFile(opts: Required<AbortOptions>){
    const buffer = await fs_readFile(fbPkg.versionFile, { ...opts, encoding: 'binary' })
    if(Buffer.isBuffer(buffer)){
        const { err, res } = await parseVersionFile(buffer, opts)
        if(err) logger.log('Failed to load version file:', inspect(err))
        if(res){
            parsedVersionFile = res
            return res
        }
    } else {
        logger.log('Failed to load version file:', 'buffer is not instance of Buffer')
    }
}
export async function parseVersionFileString(str: string, opts: Required<AbortOptions>, checkDate = true): Promise<Result<ParsedVersionFile>> {
    try {
        const buffer = Buffer.from(str, 'base64')
        return parseVersionFile(buffer, opts, checkDate)
    } catch(err) {
        return { err: err as Error }
    }
}
export async function parseVersionFile(buffer: Buffer, opts: Required<AbortOptions>, checkDate = true): Promise<Result<ParsedVersionFile>> {
    try {
        const envelope = await RecordEnvelope.openAndCertify(buffer, VERSION_FILE_DOMAIN, opts)
        const publicKeyBase64String = uint8ArrayToString(envelope.publicKey.raw, HARDCODED_KEY_ENCODING)
        if(publicKeyBase64String != HARDCODED_UPGRADE_PUBLIC_KEY)
            throw new Error(tr('The public key is not the official one that is hardcoded in the program.'))

        const dvf = VersionFile.decode(envelope.payload)
        decompressVersionFile(dvf)
        
        const { date, versionNumber, releasesUrl: releasesURL } = dvf
        if(checkDate && parsedVersionFile && date <= parsedVersionFile.date)
            throw new Error(tr('The file version is not newer than the latest known version file.'))

        const dvf_platform =
            (process.platform == 'win32') ? dvf.windows :
            (process.platform == 'linux') ? dvf.linux   :
            undefined!
        if(!dvf_platform)
            throw new Error(tr('The file does not contain a current platform.'))

        const {
            zipInfoHashV1, zipInfoHashV2,
            size, zipSize, zipWebSeeds, zipTorrentWebSeeds,
            vfWebSeeds
        } = dvf_platform

        const res = {
            date, versionNumber,
            zipInfoHashV1: zipInfoHashV1 ? uint8ArrayToString(zipInfoHashV1, 'hex') : '',
            zipInfoHashV2: zipInfoHashV2 ? uint8ArrayToString(zipInfoHashV2, 'hex') : '',
            size, zipSize, zipWebSeeds, zipTorrentWebSeeds,
            vfWebSeeds, releasesURL,
            buffer,
        }
        return { res }
    } catch(err){
        return { err: err as Error }
    }
}
export function applyVersionFile(){
    if(!parsedVersionFile) return
    const vf = parsedVersionFile
    fbPkg.versionNumber = vf.versionNumber
    fbPkg.size = vf.size
    fbPkg.zipSize = vf.zipSize
    fbPkg.vfWebSeeds = vf.vfWebSeeds
    fbPkg.zipWebSeeds = vf.zipWebSeeds
    fbPkg.zipTorrentWebSeeds = vf.zipTorrentWebSeeds
    fbPkg.zipInfoHashV1 = vf.zipInfoHashV1
    fbPkg.zipInfoHashV2 = vf.zipInfoHashV2
    fbPkg.releasesURL = vf.releasesURL ?? fbPkg.releasesURL
    fbPkg.zipMagnet = (fbPkg.zipInfoHashV1 || fbPkg.zipInfoHashV2) ?
        magnet(fbPkg.zipInfoHashV1, fbPkg.zipInfoHashV2, fbPkg.zipName, fbPkg.zipSize) :
        ''
}
