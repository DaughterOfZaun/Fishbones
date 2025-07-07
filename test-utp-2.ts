import UTP from './utp-native'
import { UTPAddress } from './utp-native/address'

console.log('begin')

const ctx = UTP.init()
const socket = ctx.create_socket()
socket.connect(new UTPAddress('127.0.0.1', 9000))
ctx.destroy()

console.log('end')
