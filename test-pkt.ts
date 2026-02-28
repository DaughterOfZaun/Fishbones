import { decrypt, encrypt } from './utils/proxy/blowfish'
import { Writer } from './utils/proxy/enet'
import * as PKT from './utils/proxy/pkt'
import { replacer } from './utils/proxy/utils'

const data = Buffer.from('ZAAAAAD+Y2AEEgAAAAIAmAAAQAJH+mT0vvyKAAACAJoAAEAAdvjl+C/6UPoAAAIAnQAAQAFl9Bb6kA79AAACAJ4AAEAAvvl99L787vMAAAIAoAAAQAAB+K/4L/pQ+gAAAgCjAABAAIL0qPn18w79AAACAKQAAEAAOPmW9L787vMAAAIApgAAQAC692P4v/g3+QAAAgCpAABAAXL0NPkBp/oAAAIAqgAAQAKw+JH0R/okAAADAKwAAEAAQ/fR9+j3qfi/+Df5AAACAK8AAEABmfSX+Nqn+gAAAgCwAABAAin4hvRH+i8AAAMAsgAAQADz9mX3nfde+L/4N/kAAAMAtQAAQAVw9CT4Dbz59qf6AAACALYAAEACpPd69Ef6OwAAAwC4AABAAKb2+Pad90X4v/g3+QAAAwC7AABABV/0oPc3wvjdp/o=', 'base64')
const writer = new Writer(Buffer.alloc(1024), 'LE')

let pkt = new PKT.WaypointGroup().read(data)
console.log(JSON.stringify(pkt, replacer, 4))
//data.fill(0)
//pkt.write(writer)
const buffer = pkt.write()
pkt = new PKT.WaypointGroup().read(buffer)
console.log(JSON.stringify(pkt, replacer, 4))

console.log(data.toString('base64'))
const encrypted = encrypt(data)
//console.log(encrypted.toString('base64'))
const decrypted = decrypt(encrypted)
console.log(decrypted.toString('base64'))

/*
{
    "senderNetID": 0,
    "syncID": 73425918,
    "movements": [
        {
            "syncID": 0,
            "teleportNetID": 1073741996,
            "hasTeleportID": false,
            "teleportID": 0,
            "waypoints": [
                {
                    "x": -2236,
                    "y": 0,
                    "z": -2096,
                    "w": 0
                },
                {
                    "x": -2072,
                    "y": 0,
                    "z": -1879,
                    "w": 0
                },
                {
                    "x": -1857,
                    "y": 0,
                    "z": -1737,
                    "w": 0
                }
            ]
        },
        {
            "syncID": 0,
            "teleportNetID": 1073742005,
            "hasTeleportID": false,
            "teleportID": 0,
            "waypoints": [
                {
                    "x": -2960,
                    "y": 0,
                    "z": -2012,
                    "w": 0
                },
                {
                    "x": -2948,
                    "y": 0,
                    "z": -1604,
                    "w": 0
                },
                {
                    "x": -2956,
                    "y": 0,
                    "z": -1369,
                    "w": 0
                }
            ]
        }
    ]
}
*/
