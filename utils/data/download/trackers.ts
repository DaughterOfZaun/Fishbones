import path from 'node:path'
import { console_log, createBar } from '../../../ui/remote/remote'
import { downloads, fs_readFile, fs_writeFile } from '../fs'
import type { AbortOptions } from '@libp2p/interface'
import { logger } from '../../log'
import embeddedTrackersTxt from '../../../thirdparty/trackers.txt'
import { HARDCODED_ANNOUNCE_URLS } from '../../constants-build'
import { tr } from '../../translation'

const trackersTxtName = 'trackers.txt'
const trackersTxt = path.join(downloads, trackersTxtName)
const trackerListsURLS = [
    'https://raw.githubusercontent.com/ngosang/trackerslist/master/trackers_best.txt',
    'https://ngosang.github.io/trackerslist/trackers_best.txt',
    'https://cdn.jsdelivr.net/gh/ngosang/trackerslist@master/trackers_best.txt',
]

let trackers: undefined | string[]
function setTrackers(txt: string){
    trackers = (txt || '').split('\n').filter(l => !!l)
    trackers.unshift(...HARDCODED_ANNOUNCE_URLS)
    return trackers
}

let trackersPromise: undefined | Promise<string[]>
export async function getAnnounceAddrs(opts: Required<AbortOptions>): Promise<string[]> {
    return trackersPromise ??= (trackers !== undefined) ?
        Promise.resolve(trackers) :
        readTrackersTxt(opts)
}

export async function readTrackersTxt(opts: Required<AbortOptions>){
    let txt = await fs_readFile(trackersTxt, { ...opts, encoding: 'utf8' })
    if(!txt){
        txt = await downloadTrackersTxt(opts)
    }
    if(!txt){
        console_log(tr('Using built-in list of torrent-trackers', {}))
        txt = embeddedTrackersTxt
    }
    return setTrackers(txt)
}

export async function downloadTrackersTxt(opts: Required<AbortOptions>){
    //console.log(`Downloading ${trackersTxtName}...`)
    const bar = createBar(tr('Downloading'), trackersTxtName)
    
    let txt: string = ''
    let lastError: Error | undefined
    try {
        for(const url of trackerListsURLS){
            try {
                logger.log('fetching', url)
                const signal = AbortSignal.any([ opts.signal, AbortSignal.timeout(10_000) ])
                const data = await fetch(url, { signal })
                txt = await data.text()
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
        return txt
    }
    if(lastError){
        console_log(tr('Downloading torrent-tracker list failed:\n', {}), Bun.inspect(lastError))
    }
}
