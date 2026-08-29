import fs from 'node:fs/promises'

const locales = [ 'en_US', 'it_IT', 'ru_RU', 'pt_BR', 'zh_CN', 'pl_PL', 'fr_FR', 'es_ES', 'en_GB', 'de_DE' ]

// This code is extracted from utils/translation.ts
const CSV_COLUMN_REGEX = /(?:"((?:""|[^"]|\n)*)")?(,|\n|$)/g
function parseCSV(csv: string){
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
    return table
}

function stringifyCSV(table: string[][]): string {
    return table.map(row => row.map(cell => `"${(cell ?? '').replaceAll('"', '""').replaceAll('\n', '\\n')}"`).join(',')).join('\n')
}

const from = process.argv[2]!
if(from.endsWith('.csv')){
    const csv = await fs.readFile(from, 'utf8')
    const table = parseCSV(csv)
    const header = table.shift()!
    for(const locale of locales)
        if(!header.includes(locale))
            header.push(locale)
    for(const line of table){
        for(let i = 1; i < header.length; i++)
            console.log(header[i], line[i] ?? ((i == 1) ? line[0] : ''))
        console.log('')
    }
}
if(from.endsWith('.txt')){
    const txt = await fs.readFile(from, 'utf8')
    const table: string[][] = [
        ['locale', ...locales],
    ]
    const row: string[] = []
    for(const line of txt.split('\n')){
        const m = line.match(/^(\w+) (.*)/)
        if(m){
            const [_, locale, string] = m
            const i = locales.indexOf(locale!)
            row[i] = string!
        } else if(line.trim() == ''){
            table.push([ row[0]!, ...row ])
            row.length = 0
        }
    }
    console.log(stringifyCSV(table))
}
