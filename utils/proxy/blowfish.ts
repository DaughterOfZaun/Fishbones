import { createCipheriv, createDecipheriv } from 'crypto'
import { blowfishKey } from '../constants'

const key = Buffer.from(blowfishKey, 'base64')

export function encrypt(buffer: Buffer){

    if(buffer.length < 8) return buffer

    const cipher = createCipheriv('bf-ecb', key, 'anything').setAutoPadding(false)
    const reminder = buffer.length % 8

    if(!reminder) return cipher.update(buffer)

    const delimiter = buffer.length - reminder
    return Buffer.concat([
        cipher.update(buffer.subarray(0, delimiter)),
        buffer.subarray(delimiter),
    ])
}

export function decrypt(buffer: Buffer){

    if(buffer.length < 8) return buffer
    
    const decipher = createDecipheriv('bf-ecb', key, 'anything').setAutoPadding(false)
    const reminder = buffer.length % 8
    
    if(!reminder) return decipher.update(buffer)

    const delimiter = buffer.length - reminder
    let data = Buffer.concat([
        decipher.update(buffer.subarray(0, delimiter)),
        buffer.subarray(delimiter),
    ])
    return data
}
