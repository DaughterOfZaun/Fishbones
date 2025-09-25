export class Args {
    megaDownload = new Option('mega-download', true, 'Download files via mega.nz')
    torrentDownload = new Option('torrent-download', true, 'Download files via BitTorrent')
    globalDiscovery = new Option('global-discovery', false, '(Experimental) Search for servers on the global Internet')
    torrentDiscovery = new Option('torrent-discovery', false, '(Experimental) Search for servers on the global Internet via BitTorrent')
    port = new Parameter('port', 5119, 'Set custom UDP port number to use')

    repair = new Option('repair', true, '(Debug) Download+Unpack+Build missing files')
    download = new Option('download', true, '(Debug) Download missing files')
    unpack = new Option('unpack', true, '(Debug) Unpack missing files')
    build = new Option('build', true, '(Debug) Build missing files')
    
    setup = new Option('setup', true, 'Ask about custom arguments at startup')
    gui = new Option('gui', true, 'Restart with GUI')

    jRPCUI = new Option('jrpc-ui', false, '(Internal) Use JSON RPC for I/O')

    customizable = [
        this.megaDownload,
        this.torrentDownload,
        this.globalDiscovery,
        this.torrentDiscovery,
        this.port,
    ]
}

class Option {
    public readonly name: string
    public readonly desc?: string
    public enabled = false
    constructor(name: string, value: boolean, desc?: string){
        if(process.argv.includes(`--${name}`)) value = true
        if(process.argv.includes(`--no-${name}`)) value = false
        this.name = name
        this.desc = desc
        this.enabled = value
    }
}

class Parameter extends Option {
    public value: number
    constructor(name: string, value: number, desc?: string){
        const passed = getNamedArg(`--${name}`, '')
        const parsed = parseInt(passed)
        const valid = isFinite(parsed) && parsed >= 0
        super(name, valid, desc)
        this.value = valid ? parsed : value
    }
}

function getNamedArg(name: string, defaultValue: string){
    const index = process.argv.indexOf(name)
    return (index >= 0 && index + 1 < process.argv.length) ?
        process.argv[index + 1]! :
        defaultValue
}

export const args = new Args()
