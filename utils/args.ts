/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import type { AbortOptions } from "@libp2p/interface"
import { OUTFILE } from "./constants-build"
import fs from 'node:fs/promises'
import path from 'node:path'

//import { downloads, fs_readFile, fs_writeFile } from "./data/fs"
import { downloads } from "./log"

//import { safeOptions } from "./process/process"
const safeOptions = { signal: (new AbortController()).signal }

//import { GC_LOCATION_AUTO } from "./data/packages/game-client"
const GC_LOCATION_AUTO = 'auto'
//import { WINE_CMD_AUTO } from "./data/packages/wine"
const WINE_CMD_AUTO = 'auto'

//import { tr } from "./translation"
const tr = (str: string) => str
const DEFAULT_LOCALE = 'en_US'

type Action<T> = (arg: T) => void

const config: Record<string, any> = {}

class Option<T> {
    public readonly name: string
    public readonly desc?: string

    private _value!: T
    public get value(){ return this._value }
    private set value(on){ this._value = on }

    public readonly defaultValue: T
    public readonly passedWithCMD: boolean = false

    constructor(short: string, name: string, defaultValue: T, desc?: string){

        this.defaultValue = defaultValue
        this.value = defaultValue
        this.name = name
        this.desc = desc
        
        if(short)
        if(typeof this.value == 'boolean'){
            if(process.argv.includes(`--${short}`)){
                this.passedWithCMD = true
                this.value = true as T
            }
            if(process.argv.includes(`--no-${short}`)){
                this.passedWithCMD = true
                this.value = false as T
            }
        } else {
            const index = process.argv.indexOf(`--${short}`)
            if(index >= 0 && index + 1 < process.argv.length){
                const passed = process.argv[index + 1]!
                if(this.parse(passed))
                    this.passedWithCMD = true
            }
        }
    }

    public parse(passed: string){
        if(typeof this.value == 'number'){
            const parsed = parseInt(passed)
            if(isFinite(parsed) && parsed >= 0){
                this.value = parsed as T
                return true
            }
        } else if(typeof this.value == 'string') {
            this.value = passed as T
            return true
        } else {
            //throw new Error()
        }
        return false
    }

    private callbacks: Action<T>[] = []
    public on(_event: 'change', cb: Action<T>){
        this.callbacks.push(cb)
    }
    public emit(_event: 'change', to: T){
        for(const callback of this.callbacks)
            callback(to)
    }
    
    public set(to: T){
        this.value = to
        this.emit('change', to)
    }
    
    public save(to: T = this.value){
        this.set(to)
        console.assert(!!this.name, 'Assertion failed: !!this.name')
        config[this.name] = this.value
        saveConfigInBackground()
    }
}

export const args = new class Args {

    megaDownload = new Option('mega-download', 'downloader-mega-enabled', true, tr('Download files from mega.nz'))
    torrentDownload = new Option('torrent-download', 'downloader-torrent-enabled', true, tr('Download and Seed files via BitTorrent'))
    allowInternet = new Option('allow-internet', 'discovery-global-net-enabled', true, tr('Connect to other players via Internet'))
    
    upgrade = new Option('upgrade', 'self-upgrade-enabled', true, tr('Download launcher updates'))
    
    update = new Option('update', 'game-server-update-enabled', true, tr('Download game server updates'))
    remoteIdx = new Option('', 'game-server-git-remote-index', 0)
    selectMR = new Option<boolean>('', '', false, tr('Select a merge request to test'))
    mrNumber = new Option<number | undefined>('', '', undefined)
    
    port = new Option('port', '', 5119, tr('Set custom UDP port number to use'))

    installModPack = new Option('install-modpack', 'game-client-modpack-levels-install-enabled', true, tr('Install the package with additional levels'))
    spaceCheck = new Option('space-check', '', true, tr('Perform a free disk space check'))
    
    installS1Client = new Option('install-s1-client', 'game-client-126-install-enabled', true, '')
    installS4Client = new Option('install-s4-client', 'game-client-420-install-enabled', false, '')

    installBWServer = new Option('install-brokenwings', 'brokenwings-install-enabled', true, '')
    installCBServer = new Option('install-chronobreak', 'chronobreak-install-enabled', false, '')
    installTGServer = new Option('install-testgrounds', 'testgrounds-install-enabled', false, '')
    
    gc126Location = new Option('', 'game-client-location', GC_LOCATION_AUTO)
    gc420Location = new Option('', 'game-client-location', GC_LOCATION_AUTO)

    wineCommand = new Option('', 'wine-command', WINE_CMD_AUTO)

    repair = new Option('repair', '', true, tr('(Debug) Download+Unpack+Build missing files'))
    download = new Option('download', '', true, tr('(Debug) Download missing files'))
    unpack = new Option('unpack', '', true, tr('(Debug) Unpack missing files'))
    build = new Option('build', '', true, tr('(Debug) Build missing files'))
    cleanup = new Option('cleanup', '', true)

    setup = new Option('setup', '', true, tr('Ask about custom arguments at startup'))

    jRPCUI = new Option('jrpc-ui', '', `../${OUTFILE}`, tr('(Internal) Use JSON RPC for I/O'))
    systemLocale = new Option('system-locale', '', DEFAULT_LOCALE, tr('(Internal) Specify the system locale'))
    autoLocale = new Option('auto-locale', '', DEFAULT_LOCALE, tr('(Internal) Specify the auto-suggested locale to use'))
    usedLocale = new Option('used-locale', '', DEFAULT_LOCALE, tr('(Internal) Specify the locale to use'))

    spellCrashDetected = new Option('', 'game-client-spell-crash-detected', false)

    username = new Option('', 'user-name', 'Anonymous')
    usericon = new Option('', 'user-icon-index', 0)

    all: Option<any>[]
    constructor(){
        this.all = Object.values(this).filter(v => v instanceof Option)
    }

    public save(){
        for(const arg of args.all)
            if(arg.name)
                config[arg.name] = arg.value
        saveConfigInBackground()
    }
}

export async function loadConfig(opts: Required<AbortOptions>){
    
    let configJSON: string | undefined
    try{
        configJSON = await fs.readFile(configFile, { ...opts, encoding: 'utf8' })
    } catch(err){ /* Ignore */ }
    if(configJSON)
        Object.assign(config, JSON.parse(configJSON))
    
    for(const arg of args.all){
        if(arg.name){
            const config_arg_name = config[arg.name]
            if(config_arg_name != undefined && !arg.passedWithCMD)
                arg['value'] = config_arg_name
            if(config_arg_name == undefined && arg.value != arg.defaultValue)
                config[arg.name] = arg.value
        }
        arg.emit('change', arg.value)
    }
    
    if(!configJSON)
        saveConfigInBackground()
}

const configFile = path.join(downloads, 'config.json')
async function saveConfig(opts: Required<AbortOptions>){
    return fs.writeFile(configFile, JSON.stringify(config, null, 4), { ...opts, encoding: 'utf8' })
}

function saveConfigInBackground(){
    saveConfig(safeOptions).catch(err => {
        //TODO: Handle.
    })
}
