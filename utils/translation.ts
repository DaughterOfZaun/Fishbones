//@ts-expect-error: Cannot find module or its corresponding type declarations.
import csv from '../remote-ui/translation/translation.csv' with { type: 'text' }
import { setLocale } from '../ui/remote/remote'
import { args } from './args'

export const AUTO_LOCALE = 'auto'
export const DEFAULT_LOCALE = 'en_US'

const CSV_COLUMN_REGEX = /(?:"((?:""|[^"]|\n)*)")?(,|\n|$)/g

let line: string[] = []
const table: string[][] = []
for(let [m, column, ending] of (csv as string).matchAll(CSV_COLUMN_REGEX)){
    column = column?.replaceAll('""', '"').replaceAll('\\n', '\n') ?? ''
    line.push(column)
    if(ending !== ','){
        table.push(line)
        line = []
    }
}

const availableLocales = table[0]!.slice(1)
const supportedLocales = availableLocales
//const supportedLocales = [ 'en_US', 'pt_BR' ]
console.assert(supportedLocales.every(locale => availableLocales.includes(locale)))

export const systemLocale = args.systemLocale.value
export const systemLocaleSupported = supportedLocales.includes(systemLocale)

export const suggestedLocale = args.autoLocale.value

export let usedLocale = args.usedLocale.value
let usedLocaleIndex = availableLocales.indexOf(usedLocale)
console.assert(usedLocaleIndex !== -1, 'usedLocaleIndex == -1')

export function setUsedLocale(to: string){
    if(to === AUTO_LOCALE) to = suggestedLocale
    usedLocaleIndex = availableLocales.indexOf(to)
    usedLocale = to
    setLocale(to)
}

const cache = new Map(table.map(row => [ row[0], row.slice(1) ]))
//void fs.writeFile('cache.json', JSON.stringify(Object.fromEntries(cache.entries()), null, 4), 'utf8')

export function tr(str: string, obj?: Record<string, string | number>){
    
    if(!obj) return str
    
    str = cache.get(str)?.[usedLocaleIndex] ?? str
    if(obj)
    for(const [key, value] of Object.entries(obj)){
        str = str.replaceAll(`{${key}}`, value.toString())
    }
    return str
}
