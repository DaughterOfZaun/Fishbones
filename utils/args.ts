//import { tr } from "./translation"
const tr = (str: string) => str
const DEFAULT_LOCALE = 'en_US'
const AUTO_LOCALE = 'auto'

export class Args {
    megaDownload = new Option('mega-download', true, tr('Download files from mega.nz'))
    torrentDownload = new Option('torrent-download', true, tr('Download and Seed files via BitTorrent'))
    allowInternet = new Option('allow-internet', true, tr('Connect to other players via Internet'))
    globalDiscovery = new Option('global-discovery', false, tr('(Experimental) Search for servers on the global Internet'))
    torrentDiscovery = new Option('torrent-discovery', false, tr('(Experimental) Search for servers on the global Internet via BitTorrent'))
    update = new Option('update', true, tr('Download game server updates'))
    upgrade = new Option('upgrade', true, tr('Download launcher updates'))
    port = new Parameter<number>('port', false, 5119, tr('Set custom UDP port number to use'))
    mr = new Parameter<number>('mr', false, 0, tr('Select a merge request to test'))
    //origin = new Parameter<string>('origin', false, '', tr('Set a repository origin'))
    installModPack = new Option('install-modpack', true, tr('Install the package with additional levels'))

    repair = new Option('repair', true, tr('(Debug) Download+Unpack+Build missing files'))
    download = new Option('download', true, tr('(Debug) Download missing files'))
    unpack = new Option('unpack', true, tr('(Debug) Unpack missing files'))
    build = new Option('build', true, tr('(Debug) Build missing files'))

    setup = new Option('setup', true, tr('Ask about custom arguments at startup'))

    jRPCUI = new Parameter<string>('jrpc-ui', false, '', tr('(Internal) Use JSON RPC for I/O'))
    systemLocale = new Parameter<string>('system-locale', false, DEFAULT_LOCALE, tr('(Internal) Specify the system locale'))
    autoLocale = new Parameter<string>('auto-locale', false, DEFAULT_LOCALE, tr('(Internal) Specify the auto-suggested locale to use'))
    usedLocale = new Parameter<string>('used-locale', false, DEFAULT_LOCALE, tr('(Internal) Specify the locale to use'))

    customizable = [
        this.megaDownload,
        this.torrentDownload,
        this.allowInternet,
        //this.globalDiscovery,
        //this.torrentDiscovery,
        this.update,
        this.upgrade,
        //this.port,
        this.mr,
    ]

    all: Option[]
    constructor(){
        this.all = Object.values(this).filter(v => v instanceof Option)
    }

    toArray(): string[] {
        return this.all.filter(arg => arg.enabled != arg.enabledByDefault).flatMap(arg => arg.toArray())
    }
}

class Option {
    public readonly name: string
    public readonly desc?: string
    public enabled: boolean
    public enabledByDefault: boolean
    constructor(name: string, value: boolean, desc?: string){
        this.enabledByDefault = value
        if(process.argv.includes(`--${name}`)) value = true
        if(process.argv.includes(`--no-${name}`)) value = false
        this.enabled = value
        this.name = name
        this.desc = desc
    }
    toArray(){
        return [ `--${this.name}` ]
    }
}

class Parameter<T extends (string | number)> extends Option {
    public value: T
    constructor(name: string, enabledByDefault: boolean, value: T, desc?: string){
        super(name, enabledByDefault, desc)
        const passed = getNamedArg(`--${name}`, value.toString())
        if(typeof value === 'number'){
            const parsed = parseInt(passed)
            const valid = isFinite(parsed) && parsed >= 0
            this.value = (valid ? parsed : value) as T
        } else {
            this.value = (passed) as T
        }
    }
    toArray(){
        return [ `--${this.name}`, this.value.toString() ]
    }
}

function getNamedArg(name: string, defaultValue: string){
    const index = process.argv.indexOf(name)
    return (index >= 0 && index + 1 < process.argv.length) ?
        process.argv[index + 1]! :
        defaultValue
}

export const args = new Args()
