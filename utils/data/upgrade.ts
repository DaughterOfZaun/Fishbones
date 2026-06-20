import type { AbortOptions } from "@libp2p/interface"
import { console_log, createBar, currentExe } from "../../ui/remote/remote"
import { platform, VERSION, versionFromString as version, versionToString, date, VERSION_FILE_DOMAIN, HARDCODED_KEY_ENCODING, HARDCODED_UPGRADE_PUBLIC_KEY } from "../constants-build"
import { FBPkgInfo } from "./packages/self"
import { fs_exists, fs_readFile, fs_writeFile } from "./fs"
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

const VERSION_FILE_LIFETIME = 7/*d*/ * 24/*h*/ * 60/*m*/ * 60/*s*/ * 1000/*ms*/
const HTTP_FETCH_TIMEOUT = 10_000

type Result<T, E extends Error = Error> = { res?: T, err?: E }

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

export const fbPkg = new FBPkgInfo(VERSION)
export const fbPkgCurrent = Object.freeze(new FBPkgInfo(VERSION))
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

    const fbPkgCurrent_versionNumber = version(fbPkgCurrent.version)

    const vf = await getOrLoadVersionFile(opts)
    if(vf) applyVersionFile()

    for(const url of fbPkg.vfWebSeeds){
        const { err, res } = await fetchBinary(url, opts)
    }

}
async function fetchBinary(url: string, opts: Required<AbortOptions>): Promise<Result<Buffer>> {
    try {
        logger.log('fetching binary from', url)
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

    const fbPkgCurrent_versionNumber = version(fbPkgCurrent.version)

    const releasesJSON = await fetch(fbPkg.releasesURL, opts)
    const releases = await releasesJSON.json() as GitHub.Release[]
    const release = releases.sort((a, b) => date(b.published_at) - date(a.published_at)).at(0)!
    const assets = release.assets.sort((a, b) => version(b.name) - version(a.name))
    const zip = assets.find(asset => asset.name.includes(platform) && asset.name.endsWith('.' + fbPkg.zipExt))

    if(!zip){
        console_log(tr('No suitable launcher update archive found.', {}))
        return
    }
    
    const zipVersion = version(zip.name)
    console_log(tr('Latest version on releases page:', {}) + ` ${zip.name} (${zipVersion})`)
    if(zipVersion <= fbPkgCurrent_versionNumber){
        //console_log(tr('Already using the latest launcher version.', {}))
    } else {

        _isNewVersionAvailable = true

        fbPkg.version = versionToString(zipVersion)
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
    version: string
    size: number
    zipSize: number
    zipInfoHashV1: string
    zipInfoHashV2: string
    zipWebSeeds: string[]
    vfWebSeeds: string[]
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
    const buffer = await fs_readFile(fbPkg.versionFile, { ...opts, encoding: 'binary' }) as unknown as Buffer
    if(buffer){
        const { err, res } = await parseVersionFile(buffer, opts)
        if(err) logger.log('Failed to load version file:', inspect(err))
        if(res){
            parsedVersionFile = res
            return res
        }
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
export async function parseVersionFile(buffer: Buffer, opts: Required<AbortOptions>, checkDate = true): Promise<{ err?: Error, res?: ParsedVersionFile }> {
    try {
        const envelope = await RecordEnvelope.openAndCertify(buffer, VERSION_FILE_DOMAIN, opts)
        const publicKeyBase64String = uint8ArrayToString(envelope.publicKey.raw, HARDCODED_KEY_ENCODING)
        if(publicKeyBase64String != HARDCODED_UPGRADE_PUBLIC_KEY)
            throw new Error('The public key is not the official one that is hardcoded in the program.')

        const {
            date, version,
            zipInfoHashV1, zipInfoHashV2,
            size, zipSize, zipWebSeeds,
            vfWebSeeds, releasesUrl: releasesURL
        } = VersionFile.decode(envelope.payload)

        if(checkDate && parsedVersionFile && date <= parsedVersionFile.date)
            throw new Error('The file version is not newer than the latest known version file.')

        const res = {
            size, zipSize, zipWebSeeds,
            date, version: versionToString(version),
            zipInfoHashV1: uint8ArrayToString(zipInfoHashV1, 'hex'),
            zipInfoHashV2: uint8ArrayToString(zipInfoHashV2, 'hex'),
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
    fbPkg.version = vf.version
    fbPkg.size = vf.size
    fbPkg.zipSize = vf.zipSize
    fbPkg.vfWebSeeds = vf.vfWebSeeds
    fbPkg.zipWebSeeds = vf.zipWebSeeds
    fbPkg.zipInfoHashV1 = vf.zipInfoHashV1
    fbPkg.zipInfoHashV2 = vf.zipInfoHashV2
    fbPkg.zipMagnet = magnet(fbPkg.zipInfoHashV1, fbPkg.zipInfoHashV2, fbPkg.zipName, fbPkg.zipSize)
    fbPkg.releasesURL = vf.releasesURL ?? fbPkg.releasesURL
}
