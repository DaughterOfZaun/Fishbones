import path from 'node:path'
import { console_log, createBar } from '../ui/remote'
import { downloads, fs_readFile, fs_writeFile } from './data-fs'
import trackersTxtEmbded from '../Fishbones_Data/trackers.txt' with { type: 'file' }
import type { AbortOptions } from '@libp2p/interface'

const trackersTxtName = 'trackers.txt'
const trackersTxt = path.join(downloads, trackersTxtName)
const trackerListsURLS = [
    'https://raw.githubusercontent.com/ngosang/trackerslist/master/trackers_best.txt',
    'https://ngosang.github.io/trackerslist/trackers_best.txt',
    'https://cdn.jsdelivr.net/gh/ngosang/trackerslist@master/trackers_best.txt',
]

let trackers: undefined | string[]
function setTrackers(txt: string){
    return trackers = (txt || '').split('\n').filter(l => !!l)
}

let trackersPromise: undefined | Promise<string[]>
export async function getAnnounceAddrs(opts: Required<AbortOptions>): Promise<string[]> {
    return trackersPromise ||= (trackers !== undefined) ?
        Promise.resolve(trackers) :
        readTrackersTxt(opts)
}

export async function readTrackersTxt(opts: Required<AbortOptions>){
    const txt = await fs_readFile(trackersTxt, { ...opts, encoding: 'utf8' })
    return txt ? setTrackers(txt) : await downloadTrackersTxt(opts)
}

async function downloadTrackersTxt(opts: Required<AbortOptions>){
    //console.log(`Downloading ${trackersTxtName}...`)
    const bar = createBar('Downloading', trackersTxtName)
    
    let txt: string = ''
    let lastError: Error | undefined
    try {
        for(const url of trackerListsURLS){
            try {
                txt = await (await fetch(url, opts)).text()
                break
            } catch(err) {
                lastError = err as Error
            }
            opts.signal.throwIfAborted()
        }
    } finally {
        bar.stop()
    }
    if(txt){
        await fs_writeFile(trackersTxt, txt, { ...opts, encoding: 'utf8' })
        return setTrackers(txt)
    } else {
        if(lastError)
            console_log('Downloading torrent-tracker list failed:\n', Bun.inspect(lastError))
        console_log('Using built-in list of torrent-trackers')
        txt = (await fs_readFile(trackersTxtEmbded, { ...opts, encoding: 'utf8', rethrow: true }))!
        return setTrackers(txt)
    }
}
