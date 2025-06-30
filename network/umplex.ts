import { createSocket } from 'node:dgram'
import EventEmitter from 'node:events'

const emitter = new EventEmitter()

const isUTP = (msg: Buffer) => {
    if(msg.length < /*sizeof_PacketFormatV1*/ 20) return false
    
    const ver_type = msg[0]!
	const version = ver_type & 0xf
	const type = ver_type >> 4
	const ext = msg[1]!

    return type < /*ST_NUM_STATES*/ 5 && ext < 3 && version === 1
}

const internalSocket = createSocket({ type: 'udp4', reuseAddr: true })
internalSocket.connect(5002)

const externalSocket = createSocket({ type: 'udp4', reuseAddr: true })
externalSocket.on('message', (msg, rinfo) => {
    if(isUTP(msg))
        internalSocket.send(msg)
    else
        emitter.emit('message', msg, rinfo)
})
externalSocket.bind()
