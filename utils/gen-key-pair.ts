import { generateKeyPair, privateKeyFromRaw } from '@libp2p/crypto/keys'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import bencode from 'bencode'
const DICTIONARY_START = 0x64 // 'd'
const END_OF_TYPE = 0x65 // 'e'

/*
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
*/

const KEY = 'Z3z1776YR5Mz+EkkZOZ2VB7kUNSCm6syviHz1++589Vz4+INeC6EKD2RaDmaP9uVr5FssMaHKed7KlC5wE/+GA=='
const privateKey = privateKeyFromRaw(uint8ArrayFromString(KEY, 'base64pad'))
//const data = fromString('data', 'utf8')
//const signature = await privateKey.sign(data)
/*
const data = Buffer.from('343a73616c74383a046d6e5abb060a4b333a736571693137353332323039363936333265313a763135373a0a240801122073e3e20d782e84283d9168399a3fdb95af916cb0c68729e77b2a50b9c04ffe18120203011a2f0a26002408011220f0506defda7ace60a7a0aecd27281741d77bc71683eaa1da7226d1243a6ce38c10a0e9f3a083332a40b9364e32028558202690fd03a4ca401fd719736bf05900d9abb6a6435d03e1e3ce5fe90397221836df13e430aab78112b843473e064e8f75c840225332209a02', 'hex')
*/
let data = Buffer.from('333a736571693137353332323039363936333265313a763135373a0a240801122073e3e20d782e84283d9168399a3fdb95af916cb0c68729e77b2a50b9c04ffe18120203011a2f0a26002408011220f0506defda7ace60a7a0aecd27281741d77bc71683eaa1da7226d1243a6ce38c10a0e9f3a083332a40b9364e32028558202690fd03a4ca401fd719736bf05900d9abb6a6435d03e1e3ce5fe90397221836df13e430aab78112b843473e064e8f75c840225332209a02', 'hex')
bencode.decode()
data = Buffer.concat([Buffer.from([DICTIONARY_START]), data, Buffer.from([END_OF_TYPE])])
console.log(bencode.decode(data))
const signature = Buffer.from('45de07c2344096313a5ba68e821bcb272d3b24c907c072b2dc67e2f9f08778dbeb1f963c8cbd5f736bf4fa7fddadd4f809f07d26d7f87c4e7966833122246501', 'hex')
console.log(privateKey.publicKey.verify(data, signature))
