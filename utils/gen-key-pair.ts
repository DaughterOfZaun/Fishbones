import { generateKeyPair, privateKeyFromRaw } from '@libp2p/crypto/keys'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'

const encoding = 'base64pad'
const privateKey = await generateKeyPair('Ed25519')
const { publicKey } = privateKey
const privateKeyString = uint8ArrayToString(privateKey.raw, encoding)
const publicKeyString = uint8ArrayToString(publicKey.raw, encoding)
console.log(privateKey.raw.length, privateKeyString)
console.log(publicKey.raw.length, publicKeyString)
const privateKeyRestored = privateKeyFromRaw(uint8ArrayFromString(privateKeyString, encoding))
const { publicKey: publicKeyRestored } = privateKey
console.log(uint8ArrayToString(privateKeyRestored.raw, encoding))
console.log(uint8ArrayToString(publicKeyRestored.raw, encoding))
