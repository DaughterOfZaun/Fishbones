import { $, file } from "bun"

//const strings = ``
//let chunk = ''
//let chunks = 0
//for(const line of strings.trim().split('\n')){
//    if(chunk.length + line.length < 1500)
//        chunk += line + '\n'
//    else {
//        console.log(chunk)
//        console.log()
//        chunk = line + '\n'
//        chunks++
//    }
//}
//console.log(chunk)
//console.log(chunks)
//process.exit()

//const translated = ``
//const lines1 = strings.split('\n')
//const lines2 = translated.split('\n')
//console.assert(lines1.length == lines2.length)
//const gRegex = /\{\w+\}/g
//for(let i = 0; i < lines1.length; i++){
//    const line1 = new Set(lines1[i]!.matchAll(gRegex).map(m => m[0]))
//    const line2 = new Set(lines2[i]!.matchAll(gRegex).map(m => m[0]))
//    if(line1.size != line2.size)
//        console.log(line1, '->', line2)
//    else {
//        const d1 = line1.difference(line2)
//        const d2 = line2.difference(line1)
//        if(d1.size > 0 || d2.size > 0)
//            console.log(line1, '->', line2)
//    }
//}
// process.exit()

const fdrg = async (ext: string, regex: RegExp, i: number) => {
    const results = await $`fd -e ${ext} -x rg --pcre2 ${regex.source} --only-matching --no-filename --no-line-number`.nothrow().text('utf8')
    return results.split('\n')
        .filter(str => str)
        .map(str => str.match(regex)![i]!)
}

const usedStrings = new Set<string>([
    ...await fdrg('ts', /\btr\((['"`])(.*?)\1/, 2),
    ...await fdrg('tscn', /(text|tooltip_text|placeholder_text) = "(.*?)"/, 2),
])

const csv = await file('./remote-ui/translation/translation.csv').text()
const translatedStrings = new Set<string>(
    csv.split('\n')
        .map(line => line.split(',')[0]!)
        .map(str => str.replace(/^"|"$/g, ''))
)

//console.log('strings to translate', JSON.stringify([...usedStrings.difference(translatedStrings)], null, 4))
//for(const str of usedStrings.difference(translatedStrings)) console.log(str)
//console.log('strings to remove', JSON.stringify([...translatedStrings.difference(usedStrings)], null, 4))
//for(const str of translatedStrings.difference(usedStrings)) console.log(str)