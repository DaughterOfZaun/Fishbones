import { Writer } from "../proxy/enet"

const DEBUG = false

const sizeof = {
    byte: 1,
    uint16: 2,
    uint32: 4,
    char: 1,
}

export class INI {
    
    version = 2
    stringKeys: number[] = []
    stringValues: string[] = []

    push(key: number, value: string){
        this.stringKeys.push(key)
        this.stringValues.push(value)
    }
    
    toBuffer(){

        console.assert(this.stringKeys.length == this.stringValues.length)
        const count = this.stringKeys.length
    
        let baseSize =
            + sizeof.byte // version
            + sizeof.uint16 // stringTableLength
            + sizeof.uint16 // bitMask
            + sizeof.uint16 // count
            + sizeof.uint32 * count // keys
            + sizeof.uint16 * count // offsets
    
        let stringTableLength = 0
        const keys = this.stringKeys
        const offsets: number[] = []
        const strings: string[] = []
        const stringOffsets: number[] = []
        for(const value of this.stringValues){
            let index = strings.indexOf(value)
            if(index < 0){
                index = strings.push(value) - 1
                //offsets.push(stringTableLength)
                stringOffsets.push(stringTableLength)
                stringTableLength += sizeof.char * (value.length + 1)
            } //else {
            const offset = stringOffsets[index]!
            offsets.push(offset)
            //}
        }
    
        const buffer = Buffer.alloc(baseSize + stringTableLength)
        const writer = new Writer(buffer, 'LE', DEBUG)
    
        writer.writeByte(this.version, 'version')
        writer.writeUInt16(stringTableLength, 'stringTableLength')

        let bitMask = 0
        if(count > 0)
            bitMask |= 0x1000

        writer.writeUInt16(bitMask, 'bitMask')

        if(count > 0)
            writer.writeUInt16(count, 'count')
        for(let i = 0; i < count; i++)
            writer.writeUInt32(keys[i]!, `key[${i}]`)
        for(let i = 0; i < count; i++)
            writer.writeUInt16(offsets[i]!, `offset[${i}]`)

        for(let i = 0; i < strings.length; i++)
            writer.writeString(strings[i]!, `strings[${i}]`)

        return buffer
    }
}
