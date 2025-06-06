import { exec, spawn, SubProcess } from 'teen_process'
import { promises as fs, type PathLike } from "node:fs"
import { path7z } from '7z-bin'
//import WebTorrent from 'webtorrent'
import { champions, maps, modes, sanitize_bfkey, spells, /*sanitize_str*/ } from './utils/constants'
import path from 'node:path'
//import { quote } from 'shell-quote'
import type { ChildProcess } from 'child_process'
import { aria2, open, createWebSocket, type Conn } from 'maria2/dist/index.js'
import { randomBytes } from '@libp2p/crypto'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { MultiBar, Presets, SingleBar } from 'cli-progress'

process.env['DOTNET_CLI_TELEMETRY_OPTOUT'] = '1'

async function fs_exists(path: PathLike){
    try {
        await fs.access(path)
        return true
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch(err) {
        return false
    }
}

async function fs_exists_and_size_eq(path: PathLike, size: number) {
    try {
        return (await fs.stat(path)).size == size
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
        return false
    }
}

const cwd = process.cwd()
const downloads = path.join(cwd, 'downloads')

const magnet = (ihv1?: string, ihv2?: string, fname?: string, size?: number) => {
    const parts: string[] = []
    if(ihv1) parts.push(`xt=urn:btih:${ihv1}`)
    if(ihv2) parts.push(`xt=urn:btmh:${ihv2}`)
    if(fname) parts.push(`dn=${fname}`)
    if(size) parts.push(`xl=${size}`)
    return `magnet:?${parts.join('&')}`
}

const gcDir = path.join(downloads, 'League of Legends_UNPACKED')
const gcExeDir = path.join(gcDir, 'League-of-Legends-4-20', 'RADS', 'solutions', 'lol_game_client_sln', 'releases', '0.0.1.68', 'deploy')
const gcExe = path.join(gcExeDir, 'League of Legends.exe')
const gcZipName = 'League of Legends_UNPACKED.7z'
const gcZip = path.join(downloads, gcZipName)
const gcZipTorrent = `${gcZip}.torrent`
const gcZipInfoHashV1 = '4bb197635194f4242d9f937f0f9225851786a0a8'
const gcZipInfoHashV2 = ''
const gcZipSize = 2171262108
const gcZipMagnet = magnet(gcZipInfoHashV1, gcZipInfoHashV2, gcZipName, gcZipSize)
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
const sdkZipInfo = {
    'dotnet-sdk-9.0.300-win-x64.zip': {
        ihv1: '249a75bd3c8abba27b59fe42ab0771f77d6caee7',
        ihv2: '1220418d03e796bd159ed3ff24606a7b4948e520fbc4e93a172fc8a1798c51bc5647',
        size: 298580138,
    },
    'dotnet-sdk-9.0.300-linux-x64.tar.gz': {
        ihv1: 'f859eefcf797348b967220427a721655a9af0bc8',
        ihv2: '1220db828e2a00844b2ad1a457b03e521d24a0b03d4746b0e849bcf0ea1d2b34eb77',
        size: 217847129,
    },
}[sdkZipName]!
if(!sdkZipInfo)
    throw new Error(`Unsupported dotnet-sdk-version-platform-arch combination: ${sdkName}`)
const sdkZipInfoHashV1 = sdkZipInfo.ihv1
const sdkZipInfoHashV2 = sdkZipInfo.ihv2
const sdkZipSize = sdkZipInfo.size
const sdkZipMagnet = magnet(sdkZipInfoHashV1, sdkZipInfoHashV2, sdkZipName, sdkZipSize)

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
const gsZipInfoHashV1 = 'e4043fdc210a896470d662933f7829ccf3ed781b'
const gsZipInfoHashV2 = 'cf9bfaba0f9653255ff5b19820ea4c01ac8484d0f8407b109ca358236d4f4abc'
const gsZipSize = 21309506
const gsZipMagnet = magnet(gsZipInfoHashV1, gsZipInfoHashV2, gsZipName, gsZipSize)
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
    try { await fs.rename(path.join(downloads, `${gsZipInfoHashV1}.torrent`), gsZipTorrent) } catch(err) {}
    try { await fs.rename(path.join(downloads, `${gcZipInfoHashV1}.torrent`), gcZipTorrent) } catch(err) {}
    try { await fs.rename(path.join(downloads, `${sdkZipInfoHashV1}.torrent`), sdkZipTorrent) } catch(err) {}
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

    await Promise.all([
        Promise.all([
            repairArchived(sdkExe, sdkDir, sdkZip, sdkZipName, sdkZipTorrent, sdkZipMagnet, sdkZipSize),
            repairArchived(gsCSProj, gsDir, gsZip, gsZipName, gsZipTorrent, gsZipMagnet, gsZipSize),
        ]).then(async () => {
            if(!await fs_exists(gsExe))
                await build(gsExe, gsExeName, gsCSProj)
            if(!await fs_exists(gsInfoDir))
                await fs.mkdir(gsInfoDir)
        }),
        repairArchived(gcExe, gcDir, gcZip, gcZipName, gcZipTorrent, gcZipMagnet, gcZipSize),
    ] as Promise<unknown>[])
}

async function repairArchived(exe: string, dir: string, zip: string, zipName: string, torrent: string, magnet: string, zipSize: number){
    if(await fs_exists(exe)){
        return // OK
    } else if(await fs_exists_and_size_eq(zip, zipSize)){
        try {
            await unpack(exe, dir, zip, zipName)
            return // OK
        } catch(unk_err) {
            const err = unk_err as Error & { cause?: { code: null|number, signal: null|string } }
            if(err.cause){
                if(err.cause.code === 1){
                    // 7z 1 Warning
                    return // OK
                } else if(err.cause.code !== 2){
                    // 7z 7   Command line error
                    // 7z 8   Not enough memory for operation
                    // 7z 255 User stopped the process
                    // The archive is not damaged, there is no point in downloading it again
                    throw err
                }
            }
        }
    }
    if(await fs_exists(torrent)){
        await download(zip, zipName, 'torrent', torrent, torrent, zipSize)
        await unpack(exe, dir, zip, zipName)
    } else {
        await download(zip, zipName, 'magnet', magnet, torrent, zipSize)
        await unpack(exe, dir, zip, zipName)
    }
}

function successfulTermination(proc: ChildProcess){
    return new Promise<void>((resolve, reject) => {
        proc.on('error', () => reject())
        proc.on('exit', (code: null|number, signal: null|string) => {
            if(code === 0) resolve()
            else {
                let msg = `Process exited with code ${code}`
                if(signal) msg += ` by signal ${signal}`
                reject(new Error(msg, { cause: { code, signal } }))
            }
        })
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
            { stdio: [ 'inherit', 'pipe', 'ignore' ] },
        )
        const s7z2 = spawn(
            path7z, /*quote*/(['x', '-si', '-ttar', ...opts])/*.split(' ')*/,
            { stdio: [ 'pipe', 'ignore', 'ignore' ] },
        )
        s7z1.stdout.pipe(s7z2.stdin)
        
        //TODO: `ERROR: Data Error : `

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
const multibar = new MultiBar({
    format: '{filename} [{bar}] {percentage}% | {value}/{total} | {duration_formatted}/{eta_formatted}',
    //clearOnComplete: false,
    //hideCursor: true,
}, Presets.legacy);
const bars = new Set<SingleBar>()

let aria2proc: SubProcess
let aria2procPromise: undefined | Promise<void>
let aria2conn: Conn
let aria2connPromise: undefined | Promise<Conn>
let aria2secret: string
async function download(
    zip: string,
    zipName: string,
    type: 'magnet' | 'torrent',
    torrentPathOrMagnetLink: string,
    torrentSavePath: string,
    zipSize: number,
){
    //console.log(`Downloading ${zipName}...`)
    const bar = multibar.create(zipSize, 0, { filename: zipName })
    bars.add(bar)
    
    if(!aria2procPromise){
        aria2secret = uint8ArrayToString(randomBytes(8), 'base32')
        aria2proc = new SubProcess(ariaExe, [
            `--conf-path=${ariaConf}`,
            `--enable-rpc=${true}`,
            `--rpc-listen-port=${6800}`,
            `--rpc-listen-all=${false}`,
            `--rpc-allow-origin-all=${false}`,
            `--rpc-secret=${aria2secret}`,
            `--bt-save-metadata=${true}`,
            `--bt-load-saved-metadata=${true}`,
            `--rpc-save-upload-metadata=${true}`,
            //`--input-file=${ariaSession}`,
            //`--save-session=${ariaSession}`,
            `--check-integrity=${true}`,
            //`--dir=${downloads}`,
            `--bt-exclude-tracker=${'*'}`,
            `--bt-tracker=${trackers?.join(',')}`,
        ])
        //console.log(aria2proc.cmd, ...aria2proc.args)
        aria2procPromise = aria2proc.start()
        //TODO: Handle start fail
        await aria2procPromise
    } else
        await aria2procPromise
    
    if(!aria2connPromise){
        aria2connPromise = open(createWebSocket('ws://localhost:6800/jsonrpc'), { secret: aria2secret })
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
        const b64 = await fs.readFile(torrentPathOrMagnetLink, 'base64')
        const gid = await aria2.addTorrent(aria2conn, b64, [], opts)
        await forCompletion(gid, false, bar)
    } else if(type == 'magnet'){
        const gid = await aria2.addUri(aria2conn, [ torrentPathOrMagnetLink ], opts)
        await forCompletion(gid, true, bar)
    }

    if(!await fs_exists_and_size_eq(zip, zipSize))
        throw new Error(`Unable to download ${zipName}`)

    bar.stop()
    bars.delete(bar)
}

function forCompletion(gid: string, isMetadata: boolean, bar: SingleBar){
    
    const delay = 100 //TODO: Unhardcode. delay = 1000 / bar.fps
    let timeout: ReturnType<typeof setTimeout>
    async function update(){
        try {
            const status = await aria2.tellStatus(aria2conn, gid, ['completedLength'])
            bar.update(Number(status.completedLength))
        } catch(err) {}
        timeout = setTimeout(update, delay)
    }

    if(!isMetadata) timeout = setTimeout(update, delay)

    return new Promise<void>((resolve, reject) => {
        const cbs = [
            aria2.onDownloadComplete(aria2conn, onComplete),
            aria2.onBtDownloadComplete(aria2conn, onComplete),
            aria2.onDownloadError(aria2conn, onError),
        ]
        async function onComplete(notification: { gid: string }){
            if(notification.gid == gid){
                if(isMetadata){
                    try {
                        const status = await aria2.tellStatus(aria2conn, gid, [ 'followedBy' ])
                        console.assert(status.followedBy?.length == 1)
                        gid = status.followedBy![0]!
                        isMetadata = false
                        timeout = setTimeout(update, delay)
                    } catch(err) {
                        cbs.forEach(cb => cb.dispose())
                        clearTimeout(timeout)
                        reject(err)
                    }
                } else {
                    cbs.forEach(cb => cb.dispose())
                    clearTimeout(timeout)
                    resolve()
                }
            }
        }
        function onError(notification: { gid: string }) {
            if(notification.gid == gid){
                cbs.forEach(cb => cb.dispose())
                clearTimeout(timeout)
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