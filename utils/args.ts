export class Args {
    megaDownload = new Option('mega-download', true, 'Download files from mega.nz')
    torrentDownload = new Option('torrent-download', true, 'Download and Seed files via BitTorrent')
    allowInternet = new Option('allow-internet', true, 'Сonnect to other players via Internet')
    globalDiscovery = new Option('global-discovery', false, '(Experimental) Search for servers on the global Internet')
    torrentDiscovery = new Option('torrent-discovery', false, '(Experimental) Search for servers on the global Internet via BitTorrent')
    update = new Option('update', true, 'Download game server updates')
    upgrade = new Option('upgrade', true, 'Download launcher updates')
    port = new Parameter<number>('port', false, 5119, 'Set custom UDP port number to use')
    mr = new Parameter<number>('mr', false, 0, 'Select a merge request to test')
    //origin = new Parameter<string>('origin', false, '', 'Set a repository origin')

    repair = new Option('repair', true, '(Debug) Download+Unpack+Build missing files')
    download = new Option('download', true, '(Debug) Download missing files')
    unpack = new Option('unpack', true, '(Debug) Unpack missing files')
    build = new Option('build', true, '(Debug) Build missing files')

    setup = new Option('setup', true, 'Ask about custom arguments at startup')

    jRPCUI = new Parameter<string>('jrpc-ui', false, '', '(Internal) Use JSON RPC for I/O')

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
        const passed = getNamedArg(`--${name}`, '')
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
