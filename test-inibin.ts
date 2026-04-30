import fs from 'node:fs/promises'
import { Reader, Writer } from './utils/proxy/enet'
import { INI } from './utils/data/ini'
import { Buffer } from 'node:buffer'
import { parseArgs } from 'util'
import { argv } from 'bun'

//const { values } = parseArgs({
//    allowPositionals: true,
//    args: argv,
//    options: {
//        input: {
//            type: 'string',
//            short: 'i',
//        },
//    },
//})

const keys = [
    1262429119, 1262429120,
    1960928736, 1960928737,
    2721268055, 2721268056,
    3491215323, 3491215324,
    3858056187, 3858056188,
]
const strings = [
    'SummonerDot',
    'SummonerExhaust',
]

const file = 'test.inibin'
//const file = values.input!

{
    const ini = new INI()
    for(let i = 0; i < keys.length; i++)
        ini.push(keys[i]!, strings[i % strings.length]!)
    const buffer = ini.toBuffer()
    fs.writeFile(file, buffer)
}

/*{
    console.log(`Writing ${file}`)
    const spell1 = 'SummonerDot'
    const spell2 = 'SummonerExhaust'
    const offset0 =
        + sizeof.byte // version
        + sizeof.uint16 // stringTableLength
        + sizeof.uint16 // bitMask
        + sizeof.uint16 // count
        + sizeof.uint32 * 10 // key x10
        + sizeof.uint16 * 10 // offset x10
    const offset1 = 0
    const offset2 = offset1 + sizeof.char * (spell1.length + 1)
    const offset3 = offset2 + sizeof.char * (spell2.length + 1)
    const buffer = Buffer.alloc(offset0 + offset3)
    const writer = new Writer(buffer, 'LE', true)
    writer.writeByte(2, 'version')
    writer.writeUInt16((spell1.length + 1) + (spell2.length + 1), 'stringTableLength')
    writer.writeUInt16(0x1000, 'bitMask')
    writer.writeUInt16(10, 'count')
    for(let i = 0; i < keys.length; i++)
        writer.writeUInt32(keys[i]!, `key[${i}]`)
    const offsets = [ offset1, offset2 ]
    for(let i = 0; i < 10; i++)
        writer.writeUInt16(offsets[i % 2]!, `offset[${i}]`)
    const strings = [ spell1, spell2 ]
    for(let i = 0; i < 2; i++)
        writer.writeString(strings[i]!, `strings[${i}]`)
    await fs.writeFile(file, buffer)
}*/

{
    console.log(`Reading ${file}`)
    const buffer = await fs.readFile(file)
    const reader = new Reader(buffer, 'LE', true)

    const version = reader.readByte('version')
    const stringTableLength = reader.readUInt16('stringTableLength')
    const bitMask = reader.readUInt16('bitMask')

    console.assert(version == 2)
    console.assert(bitMask == 0x1000)

    const count = reader.readUInt16('count')
    console.assert(count == 10)

    const keys = []
    for(let i = 0; i < count; i++)
        keys.push(reader.readUInt32(`key[${i}]`))
    console.log(keys)

    const offsets = []
    for(let i = 0; i < count; i++)
        offsets.push(reader.readUInt16(`offset[${i}]`))
    console.log(offsets)

    const strings = []
    for(let i = 0; i < 2; i++)
        strings.push(reader.readString(`strings[${i}]`))
    console.log(strings)
}