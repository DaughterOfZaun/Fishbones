import { exec, spawn, SubProcess } from 'teen_process'
import { promises as fs } from "node:fs"
import { path7z } from '7z-bin'
//import WebTorrent from 'webtorrent'
import { champions, maps, modes, sanitize_bfkey, spells, /*sanitize_str*/ } from './utils/constants'
import path from 'node:path'
//import { quote } from 'shell-quote'
import type { ChildProcess } from 'child_process'
import { aria2, open, createWebSocket, type Conn } from 'maria2/dist/index.js'

process.env['DOTNET_CLI_TELEMETRY_OPTOUT'] = '1'

async function fs_exists(path: string){
    try {
        await fs.access(path)
        return true
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch(err) {
        return false
    }
}

const cwd = process.cwd()
const downloads = path.join(cwd, 'downloads')

const gcDir = path.join(downloads, 'League of Legends_UNPACKED')
const gcExeDir = path.join(gcDir, 'League-of-Legends-4-20', 'RADS', 'solutions', 'lol_game_client_sln', 'releases', '0.0.1.68', 'deploy')
const gcExe = path.join(gcExeDir, 'League of Legends.exe')
const gcZipName = 'League of Legends_UNPACKED.7z'
const gcZip = path.join(downloads, gcZipName)
const gcZipTorrent = `${gcZip}.torrent`
const gcZipInfoHash = '4bb197635194f4242d9f937f0f9225851786a0a8'

const sdkVer = '9.0.300'

const sdkPlatformMap: Record<string, string> = {
    'win32': 'win',
    'linux': 'linux',
    'darwin': 'osx',
}
const sdkPlatform = sdkPlatformMap[process.platform]
if(!sdkPlatform) throw new Error(`Unsupported platform: ${process.platform}`)

const sdkArchMap: Record<string, string> = {
    'x64': 'x64',
    'ia32': 'x86',
    'arm': 'arm',
    'arm64': 'arm64',
}
const sdkArch = sdkArchMap[process.arch]
if(!sdkArchMap) throw new Error(`Unsupported arch: ${process.arch}`)

const sdkName = `dotnet-sdk-${sdkVer}-${sdkPlatform}-${sdkArch}`
const sdkDir = path.join(downloads, sdkName), sdkExeDir = sdkDir
const sdkExeExt = (sdkPlatform == 'win') ? '.exe' : ''
const sdkExe = path.join(sdkExeDir, `dotnet${sdkExeExt}`)
const sdkZipExt = (sdkPlatform == 'win') ? '.zip' : '.tar.gz'
const sdkZipName = `${sdkName}${sdkZipExt}`
const sdkZip = path.join(downloads, sdkZipName)
const sdkZipTorrent = `${sdkZip}.torrent`
const sdkZipInfoHash = {
    'dotnet-sdk-9.0.300-win-x64.zip': '740101aee53e396fc278afb5bb248cc2ac32123e',
    'dotnet-sdk-9.0.300-linux-x64.tar.gz': 'dbec3b9150545a5d5edde95e1a63c9c27feb0b35',
}[sdkZipName]!
if(!sdkZipInfoHash)
    throw new Error(`Unsupported dotnet-sdk-version-platform-arch combination: ${sdkName}`)

const gsProjName = 'GameServerConsole'
const gsDir = path.join(downloads, 'GameServer')
const gsProjDir = path.join(gsDir, gsProjName)
const gsTarget = 'Debug'
const gsNetVer = 'net9.0'
const gsExeExt = (sdkPlatform == 'win') ? '.exe' : ''
const gsExeName = `${gsProjName}${gsExeExt}`
const gsExeDir = path.join(gsProjDir, 'bin', gsTarget, gsNetVer)
const gsExe = path.join(gsExeDir, gsExeName)
const gsDll = path.join(gsExeDir, `${gsProjName}.dll`)
const gsCSProj = path.join(gsProjDir, `${gsProjName}.csproj`)
const gsZipName = 'Chronobreak.GameServer.7z'
const gsZip = path.join(downloads, gsZipName)
const gsZipTorrent = `${gsZip}.torrent`
const gsZipInfoHash = 'e4043fdc210a896470d662933f7829ccf3ed781b'
const gsZipMagnet = `magnet:?xt=urn:btih:${gsZipInfoHash}`
const gsgcDir = path.join(gsDir, 'Content', 'GameClient')
const gsInfoDir = path.join(gsExeDir, 'Settings')

const trackersTxtName = 'trackers.txt'
const trackersTxt = path.join(downloads, trackersTxtName)
const trackerListsURLS = [
    'https://raw.githubusercontent.com/ngosang/trackerslist/master/trackers_best.txt',
    'https://ngosang.github.io/trackerslist/trackers_best.txt',
    'https://cdn.jsdelivr.net/gh/ngosang/trackerslist@master/trackers_best.txt',
]

const AriaPlatformArchMap: Record<string, Record<string, string>> = {
    darwin: {
        x64: 'x64',
        arm64: 'arm64',
    },
    win32: {
        ia32: 'ia32',
        x64: 'x64',
        arm64: 'x64',
    },
    linux: {
        x64: 'x64',
        arm: 'armv7l',
        arm64: 'arm64',
    }
}
const ariaPlatform = process.platform
const ariaArch = (AriaPlatformArchMap[process.platform] ?? {})[process.arch];
if(!ariaArch) throw new Error(`Unsupported platform-arch combination: ${process.platform}-${process.arch}`)

const ariaExeExt = (sdkPlatform == 'win') ? '.exe' : ''
const ariaExeDir = path.join(cwd, 'thirdparty', 'Motrix', 'extra', ariaPlatform, ariaArch, 'engine')
const ariaExe = path.join(ariaExeDir, `aria2c${ariaExeExt}`)
const ariaConf = path.join(ariaExeDir, 'aria2.conf')
const ariaSession = path.join(downloads, 'aria2.session')

let trackers: undefined | string[]
export async function getAnnounceAddrs(){
    if(trackers !== undefined)
        return trackers
    try {
        const txt = await fs.readFile(trackersTxt, 'utf-8')
        setTrackers(txt)
    } catch(err) {
        console.log(err)
    }
    return trackers || []
}
function setTrackers(txt: string){
    trackers = (txt || '').split('\n').filter(l => !!l)
}
async function repairTorrentsTxt(){
    if(!await fs_exists(trackersTxt)){
        
        console.log(`Downloading ${trackersTxtName}...`)

        let txt: string = ''
        for(const url of trackerListsURLS){
            try {
                txt = await (await fetch(url)).text()
                break
            } catch(err) {
                console.log(err)
            }
        }
        if(txt){
            setTrackers(txt)
            try {
                await fs.writeFile(trackersTxt, txt, 'utf-8')
            } catch(err) {
                console.log(err)
            }
        }
    }
}

const rwx_rx_rx =
    fs.constants.S_IRUSR | fs.constants.S_IWUSR | fs.constants.S_IXUSR |
    fs.constants.S_IRGRP | fs.constants.S_IXGRP |
    fs.constants.S_IROTH | fs.constants.S_IXOTH    

async function repair7z(){
    await fs.chmod(path7z, rwx_rx_rx)
}

async function repairAria2(){
    await fs.chmod(ariaExe, rwx_rx_rx)
}

async function repairTorrents() {
    try { await fs.rename(path.join(downloads, `${gsZipInfoHash}.torrent`), gsZipTorrent) } catch(err) {}
    try { await fs.rename(path.join(downloads, `${gcZipInfoHash}.torrent`), gcZipTorrent) } catch(err) {}
    try { await fs.rename(path.join(downloads, `${sdkZipInfoHash}.torrent`), sdkZipTorrent) } catch(err) {}
}

const serverSettingsJson = path.join(downloads, 'server-settings.jsonc')
let serverSettings: undefined | Record<'maps' | 'modes' | 'champions' | 'spells', number[]>
async function repairServerSettingsJsonc(){
    if(await fs_exists(serverSettingsJson)) return
    const line = (i: number, name: string, enabled: boolean) => '        ' + (enabled ? '' : '//') + `${i}, // ${name}`
    const txt =`{
    "maps": [
${ maps.map(([i, name, enabled]) => line(i, name, enabled)).join('\n') }
    ],
    "modes": [
${ modes.map(([, name, enabled], i) => line(i, name, enabled)).join('\n') }
    ],
    "champions": [
${ champions.map(([, name, enabled], i) => line(i, name, enabled)).join('\n') }
    ],
    "spells": [
${ spells.map(([, name, enabled], i) => line(i, name, enabled)).join('\n') }
    ],
}`.trim()
    await fs.writeFile(serverSettingsJson, txt, 'utf8')
    parseServerSettings(txt)
}
function parseServerSettings(txt: string){
    txt = txt.replace(/\n? *\/\/.*/g, '').replace(/,(?=[\s\n]*[\]}])/g, '')
    serverSettings = JSON.parse(txt)
}
export async function getServerSettings(){
    if(serverSettings) return serverSettings
    const txt = await fs.readFile(serverSettingsJson, 'utf8')
    parseServerSettings(txt)
    return serverSettings!
}

//const sanitize_kv = (key: string, value: string) => {
//    if(typeof value === 'string')
//        return sanitize_str(value)
//}

let launchArgs: undefined | Parameters<typeof launchClient>
let clientSubprocess: undefined | SubProcess
export async function launchClient(ip: string, port: number, key: string, clientId: number){
    launchArgs = [ip, port, key, clientId]
    return await relaunchClient()
}
export async function relaunchClient(){
    const [ip, port, key, clientId] = launchArgs!

    const gcArgs = ['', '', '', /*quote*/([ip, port.toString(), sanitize_bfkey(key), clientId.toString()]).join(' ')].map(a => `"${a}"`).join(' ')
    
    await stopClient()

    if(process.platform == 'win32')
        clientSubprocess = new SubProcess(gcExe, [ gcArgs ])
    else if(process.platform == 'linux')
        clientSubprocess = new SubProcess('bottles-cli', ['run', '-b', 'Default Gaming', '-e', gcExe, gcArgs])
        //clientSubprocess = new SubProcess('bottles-cli', ['run', '-b', 'Default Gaming', '-p', 'League of Legends', '--args-replace', gcArgs])
    else throw new Error(`Unsupported platform: ${process.platform}`)

    console.log(clientSubprocess.rep)

    await clientSubprocess.start()
    return clientSubprocess
}

export async function stopClient(){
    const prevSubprocess = clientSubprocess!

    if(!clientSubprocess) return
    clientSubprocess = undefined

    await killSubprocess(prevSubprocess)
}

async function killSubprocess(sp: SubProcess){
    try {
        await sp.stop('SIGTERM', 10 * 1000)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch(err){
        try {
            await sp.stop('SIGKILL', 5 * 1000)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (err) {
            //TODO: Handle errors
        }
    }
}

let serverSubprocess: undefined | SubProcess
export async function launchServer(port: number, info: GameInfo){
    info.gameInfo.CONTENT_PATH = path.relative(gsExeDir, gsgcDir)

    const gsInfo = path.join(gsInfoDir, `GameInfo.${info.gameId}.json`)
    await fs.writeFile(gsInfo, JSON.stringify(info, null, 4))
    const gsInfoRel = path.relative(gsExeDir, gsInfo)

    serverSubprocess = new SubProcess(sdkExe, [
        gsDll, '--port', port.toString(), '--config', gsInfoRel,
    ], {
        cwd: gsExeDir,
        //timeout: 15 * 1000
    })
    
    console.log(serverSubprocess.rep)

    await serverSubprocess.start((stdout: string, /*stderr: string*/) => stdout.includes('Server is ready'))
    return serverSubprocess
}

export async function stopServer(){
    const prevSubprocess = serverSubprocess!

    if(!serverSubprocess) return
    serverSubprocess = undefined

    await killSubprocess(prevSubprocess)
}

export async function repair(){
    //console.log('Running data check and repair...')

    if(!await fs_exists(downloads))
        await fs.mkdir(downloads)
    
    await Promise.all([
        repairServerSettingsJsonc(),
        repairTorrentsTxt(),
        repairTorrents(),
        repair7z(),
        repairAria2(),
    ] as Promise<unknown>[])

    await repairArchived(gsCSProj, gsDir, gsZip, gsZipName, gsZipTorrent, gsZipInfoHash)
    return

    await Promise.all([
        Promise.all([
            repairArchived(sdkExe, sdkDir, sdkZip, sdkZipName, sdkZipTorrent, sdkZipInfoHash),
            repairArchived(gsCSProj, gsDir, gsZip, gsZipName, gsZipTorrent, gsZipInfoHash),
        ]).then(async () => {
            if(!await fs_exists(gsExe))
                await build(gsExe, gsExeName, gsCSProj)
            if(!await fs_exists(gsInfoDir))
                await fs.mkdir(gsInfoDir)
        }),
        repairArchived(gcExe, gcDir, gcZip, gcZipName, gcZipTorrent, gcZipInfoHash),
    ] as Promise<unknown>[])
}

async function repairArchived(exe: string, dir: string, zip: string, zipName: string, torrent: string, infohash: string){
    if(await fs_exists(exe)){
        // OK
    } else if(await fs_exists(zip)){
        await unpack(exe, dir, zip, zipName)
    } else if(await fs_exists(torrent)){
        await download(zip, zipName, 'torrent', torrent)
        await unpack(exe, dir, zip, zipName)
    } else {
        await download(zip, zipName, 'magnet', infohash, torrent)
        await unpack(exe, dir, zip, zipName)
    }
}

function successfulTermination(proc: ChildProcess){
    return new Promise((resolve, reject) => {
        proc.on('error', reject)
        proc.on('exit', resolve)
    })
}

async function unpack(exe: string, dir: string, zip: string, zipName: string){
    console.log(`Unpacking ${zipName}...`)

    try {
        await fs.mkdir(dir)
    } catch(unk_err) {
        const err = unk_err as ErrnoException
        if(err.code != 'EEXIST')
            console.log(err)
    }
    
    const opts = ['-spe', '-aoa', `-o${dir}`]
    if(zip.endsWith('.tar.gz')){
        const s7z1 = spawn(
            path7z, /*quote*/(['x', '-so', zip])/*.split(' ')*/,
            { stdio: [ 'inherit', 'pipe', 'inherit' ] },
        )
        const s7z2 = spawn(
            path7z, /*quote*/(['x', '-si', '-ttar', ...opts])/*.split(' ')*/,
            { stdio: [ 'pipe', 'inherit', 'inherit' ] },
        )
        s7z1.stdout.pipe(s7z2.stdin)
        await Promise.all([
            successfulTermination(s7z1),
            successfulTermination(s7z2),
        ])
    } else {
        const s7z1 = spawn(path7z, /*quote*/(['x', ...opts, zip])/*.split(' ')*/)
        await successfulTermination(s7z1)
    }
    
    if(!await fs_exists(exe))
        throw new Error(`Unable to unpack ${zipName}`)
}

async function build(exe: string, exeName: string, csproj: string){
    console.log(`Building ${csproj}...`)

    let txt = await fs.readFile(csproj, 'utf8')
    txt = txt.replace(/(?<=<TargetFramework>)(?:.|\n)*?(?=<\/TargetFramework>)/g, gsNetVer)
    await fs.writeFile(csproj, txt, 'utf8')

    await exec(sdkExe, ['build', csproj])
    if(!await fs_exists(exe))
        throw new Error(`Unable to build ${exeName}`)
}
/*
let webtorrent: undefined | WebTorrent.Instance
async function download(
    zip: string,
    zipName: string,
    torrent: Parameters<WebTorrent.Instance['add']>[0],
    saveto?: Parameters<(typeof fs)['writeFile']>[0]
){
    console.log(`Downloading ${zipName}...`)
    
    webtorrent = new WebTorrent({
        tracker: {
            announce: await getAnnounceAddrs()
        }
    })
    await new Promise<void>((resolve, reject) => {
        webtorrent!.add(torrent, { path: downloads, strategy: 'rarest' }, async torrent => {
            if(saveto)
            torrent.on('metadata', async () => {
                await fs.writeFile(saveto, torrent.torrentFile)
            })
            torrent.on('done', resolve)
            torrent.on('error', reject)
            torrent.on('download', (bytes: number) => {
                console.log(zipName, (torrent.progress * 100).toFixed(2) + '%')
            })
        })
    })
    if(!await fs_exists(zip))
        throw new Error(`Unable to download ${zipName}`)
}
*/
let aria2proc: SubProcess
let aria2procPromise: undefined | Promise<void>
let aria2conn: Conn
let aria2connPromise: undefined | Promise<Conn>
async function download(
    zip: string,
    zipName: string,
    type: 'magnet' | 'torrent',
    torrent: string,
    saveto?: string,
){
    console.log(`Downloading ${zipName}...`)
    
    if(!aria2procPromise){
        aria2proc = new SubProcess(ariaExe, [
            `--conf-path=${ariaConf}`,
            `--enable-rpc=${true}`,
            `--rpc-listen-port=${6800}`,
            `--rpc-listen-all=${false}`,
            `--rpc-allow-origin-all=${false}`,
            //`--rpc-secret=${''}`,
            `--bt-save-metadata=${true}`,
            `--bt-load-saved-metadata=${true}`,
            `--rpc-save-upload-metadata=${true}`,
            //`--input-file="${ariaSession}"`,
            //`--save-session="${ariaSession}"`,
            //`--dir="${downloads}"`
        ])
        console.log(aria2proc.cmd, ...aria2proc.args)
        aria2procPromise = aria2proc.start()
        //TODO: Handle start fail
        await aria2procPromise
    } else
        await aria2procPromise
    
    if(!aria2connPromise){
        aria2connPromise = open(createWebSocket('ws://localhost:6800/jsonrpc'))
        aria2conn = await aria2connPromise
    } else
        await aria2connPromise
    
    const opts = {
        'bt-save-metadata': true,
        'bt-load-saved-metadata': true,
        'rpc-save-upload-metadata': true,
        dir: downloads,
        out: zipName,
    }

    if(type == 'torrent'){
        const b64 = await fs.readFile(torrent, 'base64')
        const gid = await aria2.addTorrent(aria2conn, b64, [], opts)
        await forCompletion(gid, false)
    } else if(type == 'magnet'){
        const magnet = `magnet:?xt=urn:btih:${torrent}`
        const gid = await aria2.addUri(aria2conn, [ magnet ], opts)
        await forCompletion(gid, true)
    }

    if(!await fs_exists(zip))
        throw new Error(`Unable to download ${zipName}`)
}

function forCompletion(gid: string, isMetadata: boolean){
    return new Promise<void>((resolve, reject) => {
        const cbs = [
            aria2.onDownloadComplete(aria2conn, onComplete),
            aria2.onBtDownloadComplete(aria2conn, onComplete),
            aria2.onDownloadError(aria2conn, onError),
        ]
        /*
        if(isMetadata){
            cbs.push(aria2.onDownloadStart(aria2conn, onStart))
        }
        async function onStart(notification: { gid: string }){
            await aria2.tellStatus(aria2conn, ...)
        }
        */
        async function onComplete(notification: { gid: string }){
            if(notification.gid == gid){
                if(isMetadata){
                    try {
                        const status = await aria2.tellStatus(aria2conn, gid, [ 'followedBy' ])
                        console.assert(status.followedBy?.length == 1)
                        gid = status.followedBy![0]!
                        isMetadata = false
                    } catch(err) {
                        reject(err)
                    }
                } else {
                    cbs.forEach(cb => cb.dispose())
                    resolve()
                }
            }
        }
        function onError(notification: { gid: string }) {
            if(notification.gid == gid){
                cbs.forEach(cb => cb.dispose())
                reject()
            }
        }
        
    })
}

export type GameInfo = {
    gameId: number
    game: {
        map: number
        gameMode: string
        mutators: string[]
    }
    gameInfo: {
        TICK_RATE: number
        FORCE_START_TIMER: number
        USE_CACHE: boolean
        IS_DAMAGE_TEXT_GLOBAL: boolean
        ENABLE_CONTENT_LOADING_LOGS: boolean
        SUPRESS_SCRIPT_NOT_FOUND_LOGS: boolean
        CHEATS_ENABLED: boolean
        MANACOSTS_ENABLED: boolean
        COOLDOWNS_ENABLED: boolean
        MINION_SPAWNS_ENABLED: boolean
        LOG_IN_PACKETS: boolean
        LOG_OUT_PACKETS: boolean
        CONTENT_PATH: string
        ENDGAME_HTTP_POST_ADDRESS: string
        scriptAssemblies: string[]
    }
    players: {
        playerId: number
        blowfishKey: string
        rank: string
        name: string
        champion: string
        team: string
        skin: number
        summoner1: string
        summoner2: string
        ribbon?: number, // Unused
        icon: number
        runes: Record<number, number>
        talents: Record<number, number>
    }[]
}