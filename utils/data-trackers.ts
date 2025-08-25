import path from 'node:path'
import { console_log, createInfiniteBar, downloads, fs_readFile, fs_writeFile } from "./data-shared"
import { promises as fs } from "node:fs"
import trackersTxtEmbded from '../Fishbones_Data/trackers.txt' with { type: 'file' }

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
export function getAnnounceAddrs(): Promise<string[]> {
    return trackersPromise ||= (trackers !== undefined) ?
        Promise.resolve(trackers) :
        readTrackersTxt()
}

export async function readTrackersTxt(){
    const txt = await fs_readFile(trackersTxt, 'utf-8')
    return txt ? setTrackers(txt) : await downloadTrackersTxt()
}

async function downloadTrackersTxt(){
    //console.log(`Downloading ${trackersTxtName}...`)
    const bar = createInfiniteBar('Downloading', trackersTxtName)

    let txt: string = ''
    let lastError: Error | undefined
    for(const url of trackerListsURLS){
        try {
            txt = await (await fetch(url)).text()
            break
        } catch(err) {
            lastError = err as Error
        }
    }
    
    bar.stop()

    if(txt){
        /*await*/ fs_writeFile(trackersTxt, txt, 'utf-8')
        return setTrackers(txt)
    } else {
        if(lastError)
            console_log('Downloading torrent-tracker list failed:\n', Bun.inspect(lastError))
        console_log('Using built-in list of torrent-trackers')
        txt = await fs.readFile(trackersTxtEmbded, 'utf8')
        return setTrackers(txt)
    }
}
