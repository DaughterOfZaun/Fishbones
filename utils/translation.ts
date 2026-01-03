//@ts-expect-error: Cannot find module or its corresponding type declarations.
import csv from '../remote-ui/translation/translation.csv' with { type: 'text' }
import { args } from './args'

const table = (csv as string).split('\n').map(line => {
    return line.split(',').map(column => {
        return column
            .replaceAll(/^"|"$/g, '')
            .replaceAll('\\n', '\n')
    })
})
const index = table[0]!.indexOf(args.locale.value)
const cache = new Map(table.map(columns => [ columns[0], columns[index] ]))
export function tr(str: string, obj?: Record<string, string | number>){
    str = cache.get(str) ?? str
    if(obj)
    for(const [key, value] of Object.entries(obj)){
        str = str.replaceAll(`{${key}}`, value.toString())
    }
    return str
}
