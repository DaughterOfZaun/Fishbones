import { input as localInput, checkbox as localCheckbox } from '@inquirer/prompts'
import { AbortPromptError, ExitPromptError } from '@inquirer/core'
import type { Context } from '@inquirer/type'
import yoctocolor from 'yoctocolors-cjs'

import { createBar as localBar, console_log as localLog } from './progress'
import { default as localSelect, type Choice } from './dynamic-select'
import { default as localSpinner } from './spinner'

import path from 'node:path'
import { downloads, fs_chmod, fs_copyFile, fs_exists, rwx_rx_rx } from '../utils/data-fs'
import type { AbortOptions } from '@libp2p/interface'
import type { BunSocket } from '../network/umplex'
import { LOCALHOST } from '../utils/constants'


export { type Choice, AbortPromptError, ExitPromptError }

// eslint-disable-next-line @typescript-eslint/promise-function-async
export const input: typeof localInput = (config, context) => {
    //return Object.assign(new Promise<string>((res, rej) => {}), { cancel: () => {} })
    return localInput(config, context)
}

type CheckboxConfig<Value> = Parameters<typeof localCheckbox<Value>>[0]
// eslint-disable-next-line @typescript-eslint/promise-function-async
export const checkbox: typeof localCheckbox = <Value>(config: CheckboxConfig<Value>, context?: Context) => {
   //return Object.assign(new Promise<Value[]>((res, rej) => {}), { cancel: () => {} })
   return localCheckbox<Value>(config, context)
}

type SelectConfig<Value> = Parameters<typeof localSelect<Value>>[0]
// eslint-disable-next-line @typescript-eslint/promise-function-async
export const select: typeof localSelect = <Value>(config: SelectConfig<Value>, context?: Context) => {
    //return Object.assign(new Promise<Value>((res, rej) => {}), { cancel: () => {} })
    return localSelect<Value>(config, context)
}

// eslint-disable-next-line @typescript-eslint/promise-function-async
export const spinner: typeof localSpinner = (config, context) => {
    //return Object.assign(new Promise<unknown>((res, rej) => {}), { cancel: () => {} })
    return localSpinner(config, context)
}

type BrightColorName = 'blueBright'|'redBright'|'greenBright'|'yellowBright'|'magentaBright'|'cyanBright'
type RegularColorName = 'blue'|'red'|'green'|'yellow'|'magenta'|'cyan'
type ColorName = RegularColorName|BrightColorName|'white'|'gray'
export const color = (name: ColorName, text: string) => {
    return yoctocolor[name](text)
}

export const createBar: typeof localBar = (operation, filename, size) => {
    return localBar(operation, filename, size)
}

export const console_log: typeof localLog = (...args) => {
    return localLog(...args)
}

//@ts-expect-error Cannot find module or its corresponding type declarations.
import godotExeEmbded from '/home/user/.local/share/godot/export_templates/4.5.rc1/linux_release.x86_64' with { type: 'file' }
//@ts-expect-error Cannot find module or its corresponding type declarations.
import godotPckEmbded from '../dist/Fishbones.UI.pck' with { type: 'file' }
import { registerShutdownHandler, spawn, type ChildProcess } from '../utils/data-process'

const godotExe = path.join(downloads, 'godot.exe')
const godotPck = path.join(downloads, 'Fishbones.UI.pck')
export async function repairUIRenderer(opts: Required<AbortOptions>){
    return Promise.all([
        (async () => {
            if(!await fs_exists(godotExe, opts)){
                await fs_copyFile(godotExeEmbded as string, godotExe, opts)
                await fs_chmod(godotExe, rwx_rx_rx, opts)
            }
        })(),
        (async () => {
            if(!await fs_exists(godotPck, opts)){
                await fs_copyFile(godotPckEmbded as string, godotPck, opts)
            }
        })(),
    ])
}

let proc: ChildProcess | undefined
let socket: BunSocket | undefined
registerShutdownHandler(() => socket?.close())

export async function start(opts: Required<AbortOptions>){
    let remotePort: number | undefined
    socket = await Bun.udpSocket({
        binaryType: 'buffer',
        hostname: LOCALHOST,
        socket: {
           data(socket, data, port, address){
                if(address != LOCALHOST) return
                if(remotePort && remotePort != port) return

                const obj: unknown = JSON.parse(data.toString('utf8'))
                if(typeof obj != 'object' || obj == null) return
                if(!('method' in obj)) return
                if(obj.method === "started")
                    remotePort = port


           },
           error(socket, error) {
              //TODO: Handle.
           },
        }
    })
    opts.signal.throwIfAborted()
    proc = spawn(godotExe, [ '--main-pack', godotPck, '--', '--port', socket.address.port.toString() ], { log: false, logPrefix: 'GODOT' })
}

export function stop(){

}
