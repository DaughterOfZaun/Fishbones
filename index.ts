import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { tcp } from '@libp2p/tcp'
import { createLibp2p } from 'libp2p'
import { discovery } from './discovery'
import { hash } from 'uint8-util'
import { promises as fs } from 'fs'

const port = 5118
const node = await createLibp2p({
    addresses: {
        listen: [ `/ip4/0.0.0.0/tcp/${port}` ]
    },
    transports: [ tcp() ],
    streamMuxers: [ yamux() ],
    connectionEncrypters: [ noise() ],
    //peerDiscovery: [],
    services: {
        discovery: discovery({
            infoHash: (await hash(`jinx/launcher/${0}`, 'hex', 'sha-1')) as string,
            port: port,
            announce: await getAnnounceAddrs(),
            dht: true,
            dhtPort: 5117,
            tracker: true,
            lsd: true,
        }),
        pubsub: gossipsub()
    }
})

const trackerListsURLS = [
    'https://raw.githubusercontent.com/ngosang/trackerslist/master/trackers_best.txt',
    'https://ngosang.github.io/trackerslist/trackers_best.txt',
    'https://cdn.jsdelivr.net/gh/ngosang/trackerslist@master/trackers_best.txt',
]

async function getAnnounceAddrs(){
    let list: string
    try {
        list = await fs.readFile('trackers.txt', 'utf-8')
    } catch(e) {
        console.log(e)
        for(let url of trackerListsURLS){
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