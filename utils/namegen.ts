/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */

//@ts-expect-error: Could not find a declaration file for module.
import Foswig from 'foswig'
import sampleNames from './names.json'
//import sampleSpecies from './species.json'
import type { PeerId } from '@libp2p/interface'
import { PeerMap } from '@libp2p/peer-collections'
import { peerIdFromString } from '@libp2p/peer-id'

const chain = new Foswig(2, sampleNames)
const cache = new PeerMap<string>()

const officialServers = [
    '12D3KooWHHyaqcTuPvphwifkP2su2Qis2wWKLZhaobc9cB5qXQak',
    '12D3KooWB8HczTZk8VYDbWW5wpiMxK5558DfNWw35h8dthbMhzwA',
    '12D3KooWLUUnmY5C57XiwXaENUYh1xwJZevcCYvGB8FRXTsoMTpJ',
    '12D3KooWADLXQ59NVtdD8gJL2N6CcVkD6gzC4YgA5JMBvwVFsUos',
]
for(const [i, peerIdString] of officialServers.entries()){
    const peerId = peerIdFromString(peerIdString)
    cache.set(peerId, `Official Server #${i + 1}`)
}

export function getUsername(peerId: PeerId){
    let name = cache.get(peerId)
    if(!name){
        let j = 4
        const bytes = peerId.publicKey?.raw
        if(bytes){
            const bytes_at = (i: number) => bytes[bytes.length - 1 - i]!
            name = chain.generate({
                maxLength: 16,
                random: () => bytes_at(j++ % bytes.length) / 255,
                allowDuplicates: false,
            }) as string + ' #' + formatUInt32(
                bytes_at(0) << 8 * 0 |
                bytes_at(1) << 8 * 1 |
                bytes_at(2) << 8 * 2 |
                bytes_at(3) << 8 * 3
            )
        } else {
            name = 'Unknown #ERROR'
        }
        cache.set(peerId, name)
    }
    return name
}

export function getPseudonym(playerId: number, isMe: boolean){
    let name = 'Anonymous '
    //name += sampleSpecies[Math.floor((playerId / (2 ** 31)) * sampleSpecies.length)]
    name += ' #' + formatUInt32(playerId)
    if(isMe) name += ' (You)'
    return name
}

function formatUInt32(i: number){
    return (i >>> 0).toString(36).toUpperCase()//.padStart(7, '0')
}
