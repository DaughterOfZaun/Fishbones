
import { promises as fs } from 'fs'

const trackerListsURLS = [
    'https://raw.githubusercontent.com/ngosang/trackerslist/master/trackers_best.txt',
    'https://ngosang.github.io/trackerslist/trackers_best.txt',
    'https://cdn.jsdelivr.net/gh/ngosang/trackerslist@master/trackers_best.txt',
]

export async function getAnnounceAddrs(){
    let list: string
    try {
        list = await fs.readFile('trackers.txt', 'utf-8')
    } catch(e) {
        console.log(e)
        for(const url of trackerListsURLS){
            try {
                list = await (await fetch(url)).text()
                try {
                    /*await*/ fs.writeFile('trackers.txt', list, 'utf-8')
                } catch(e) {
                    console.log(e)
                }
            } catch(e) {
                console.log(e)
                continue
            }
        }
    }
    return (list ||= '').split('\n').filter(l => !!l)
}