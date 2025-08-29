import path from 'node:path'
import { createWriteStream as fs_createWriteStream, WriteStream } from "node:fs"
import { MultiBar, Presets } from 'cli-progress'
import { cwd, downloads } from './data-fs'

export const barOpts = {
    stopOnComplete: true,
    clearOnComplete: true,
    hideCursor: true,
    linewrap: true,
    autopadding: false,
    autopaddingChar: ' ',
}
export const multibar = new MultiBar({
    ...barOpts,
    format: '{operation} {filename} |{bar}| {percentage}% | {value}/{total} | {duration_formatted}/{eta_formatted}',
    formatBar(progress, options){
        const partials = [' ', '▏', '▎', '▍', '▌', '▋', '▊', '▉', '█']
        const size = options.barsize!
        const ticks = progress * size
        const filled = Math.floor(ticks)
        const open = size - filled - 1
        let bar = ''
        if(filled > 0) bar += partials.at(-1)!.repeat(filled)
        if(filled < size) bar += partials[Math.round((ticks - filled) * (partials.length - 1))]
        if(open > 0) bar += partials.at(0)!.repeat(open)
        return bar
    },
    formatValue(v, options, type){
        const space = options.autopaddingChar!
        
        if(typeof v != 'number') return v

        if(options.autopadding && type === 'percentage')
            return v.toFixed(0).padStart(3, space)
        
        let str = ''
        if(v >= 999_995_000) str = `${(v / 1_000_000_000).toFixed(2)}G`
        else if(v > 999_995) str = `${(v / 1_000_000).toFixed(2)}M`
        else if(v > 999) str = `${(v / 1_000).toFixed(2)}K`
        else str = v.toFixed(2) + space

        if(options.autopadding)
            str = str.padStart(3 + 1 + 2 + 1, space)
        return str
    }
}, Presets.legacy)

//import { makeTheme, type Theme } from '@inquirer/core'
//const defaultTheme = makeTheme<Theme>();
const defaultTheme = {
    spinner: {
        frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
        interval: 80,
    }
}
export function createInfiniteBar(operation: string, filename: string){
    const bar = multibar.create(1000, 1, { operation, filename }, {
        ...barOpts,
        stopOnComplete: false,
        format: '{bar} {operation} {filename}... {duration_formatted}',
        formatBar(progress){
            const { frames } = defaultTheme.spinner
            return frames[Math.floor(progress * 1000) % frames.length] || 'x'
        }
    })
    const barUpdateInterval = setInterval(() => bar.increment(1), defaultTheme.spinner.interval)
    return {
        stop: () => {
            clearInterval(barUpdateInterval)
            bar.update(bar.getTotal())
            bar.stop()
        }
    }
}

export function console_log(...args: (string | number)[]){
    if(multibar.isActive) multibar.log(args.join(' ') + '\n')
    else console.log(...args)
    logger.log(...args)
}

const cwdWin = cwd.replaceAll('/', '\\')
const cwdLin = cwd.replaceAll('\\', '/')
export const logger = new class Logger {
    private stream?: WriteStream
    log(...args: (string | number)[]){
        this.stream ??= fs_createWriteStream(path.join(downloads, 'log.txt'), { flags: 'a', autoClose: true })
        this.stream.write(`${Date.now()} ${
            args.join(' ').replace(cwdWin, '.').replaceAll(cwdLin, '.')
        }\n`)
    }
}()
