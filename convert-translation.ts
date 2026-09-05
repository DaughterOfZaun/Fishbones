import fs from 'node:fs/promises'

const locales = [
    'en_US', 'en_GB', 'en_AU',
    'es_ES', 'es_AR', 'es_MX', 'pt_BR',
    'fr_FR', 'it_IT', 'ro_RO',
    'cs_CZ', 'pl_PL', 'ru_RU',
    'de_DE', 'el_GR',  'hu_HU', 'tr_TR',
    'ko_KR',
]

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
    for(const line of table){
        for(const locale of locales){
            const i = header.indexOf(locale)
            console.log(locale, line[i] ?? '')
        }
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
