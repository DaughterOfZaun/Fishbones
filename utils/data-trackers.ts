import path from 'node:path'
import { downloads, fs_exists } from "./data-shared"
import { promises as fs } from "node:fs"

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
}

let trackersPromise: undefined | Promise<string[]>
export function getAnnounceAddrs(): Promise<string[]> {
    return trackersPromise ||= (trackers !== undefined) ?
        Promise.resolve(trackers) :
        fs.readFile(trackersTxt, 'utf-8')
            .then(txt => {
                setTrackers(txt)
                return trackers!
            }).catch(err => {
                console.log(err)
                return []
            })
}

export async function repairTorrentsTxt(){
    if(!await fs_exists(trackersTxt)){
        
        console.log(`Downloading ${trackersTxtName}...`)

        let txt: string = ''
        for(const url of trackerListsURLS){
            try {
                txt = await (await fetch(url)).text()
                break
            } catch(err) {
                console.log(err)
            }
        }
        if(txt){
            setTrackers(txt)
            try {
                await fs.writeFile(trackersTxt, txt, 'utf-8')
            } catch(err) {
                console.log(err)
            }
        }
    }
}