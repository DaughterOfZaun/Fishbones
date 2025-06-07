import { exec, spawn, SubProcess } from 'teen_process'
import { promises as fs, type PathLike } from "node:fs"
import { path7z } from '7z-bin'
import { champions, maps, modes, sanitize_bfkey, spells, /*sanitize_str*/ } from './utils/constants'
import path from 'node:path'
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
        const stat = await fs.stat(path)
        //console.log('fs_exists_and_size_eq', path, size, stat.size)
        return stat.size == size
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (unk_err) {
        const err = unk_err as ErrnoException
        //console.log('fs_exists_and_size_eq', path, size, err.code)
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

abstract class PkgInfo {
    abstract dirName: string
    abstract noDedup: boolean
    
    abstract zipExt: string
    abstract zipName: string
    abstract zipInfoHashV1: string
    abstract zipInfoHashV2: string
    abstract zipSize: number

    abstract dir: string
    abstract zip: string
    abstract zipTorrent: string
    abstract zipMagnet: string

    abstract checkUnpackBy: string
}

abstract class PkgInfoExe extends PkgInfo {
    get checkUnpackBy(){ return this.exe }
    
    abstract exe: string
}

abstract class PkgInfoCSProj extends PkgInfo {
    get checkUnpackBy(){ return this.csProj }

    abstract target: string
    abstract netVer: string
    abstract csProj: string
    abstract dllDir: string
    abstract dllName: string
    abstract dll: string
}

const gcPkg = new class extends PkgInfoExe {
    dirName = 'League of Legends_UNPACKED'
    noDedup = false
    zipExt = '.7z'
    zipName = `League of Legends_UNPACKED${this.zipExt}`
    zipInfoHashV1 = '4bb197635194f4242d9f937f0f9225851786a0a8'
    zipInfoHashV2 = ''
    zipSize = 2171262108

    dir = path.join(downloads, this.dirName)
    zip = path.join(downloads, this.zipName)
    zipTorrent = `${this.zip}.torrent`
    zipMagnet = magnet(this.zipInfoHashV1, this.zipInfoHashV2, this.zipName, this.zipSize)

    exe = path.join(this.dir, 'League-of-Legends-4-20', 'RADS', 'solutions', 'lol_game_client_sln', 'releases', '0.0.1.68', 'deploy', 'League of Legends.exe')
}()

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
const sdkZipExt = (sdkPlatform == 'win') ? '.zip' : '.tar.gz'
const sdkZipName = `${sdkName}${sdkZipExt}`
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
    throw new Error(`Unsupported dotnet-sdk-version-platform-arch.ext combination: ${sdkZipName}`)

const sdkPkg = new class extends PkgInfoExe {
    dirName = sdkName
    noDedup = true
    zipExt = sdkZipExt
    zipName = sdkZipName
    zipInfoHashV1 = sdkZipInfo.ihv1
    zipInfoHashV2 = sdkZipInfo.ihv2
    zipSize = sdkZipInfo.size
    
    dir = path.join(downloads, this.dirName)
    zip = path.join(downloads, this.zipName)
    zipTorrent = `${this.zip}.torrent`
    zipMagnet = magnet(this.zipInfoHashV1, this.zipInfoHashV2, this.zipName, this.zipSize)

    exeExt = (sdkPlatform == 'win') ? '.exe' : ''
    exe = path.join(this.dir, `dotnet${this.exeExt}`)
}()

const gsPkg = new class extends PkgInfoCSProj {
    dirName = 'GameServer'
    noDedup = false
    zipExt = '.7z'
    zipName = `Chronobreak.GameServer${this.zipExt}`
    zipInfoHashV1 = 'e4043fdc210a896470d662933f7829ccf3ed781b'
    zipInfoHashV2 = 'cf9bfaba0f9653255ff5b19820ea4c01ac8484d0f8407b109ca358236d4f4abc'
    zipSize = 21309506
    
    dir = path.join(downloads, this.dirName)
    zip = path.join(downloads, this.zipName)
    zipTorrent = `${this.zip}.torrent`
    zipMagnet = magnet(this.zipInfoHashV1, this.zipInfoHashV2, this.zipName, this.zipSize)

    projName = 'GameServerConsole'
    csProjDir = path.join(this.dir, this.projName)
    
    target = 'Debug'
    netVer = 'net9.0'
    csProj = path.join(this.csProjDir, `${this.projName}.csproj`)
    dllDir = path.join(this.csProjDir, 'bin', this.target, this.netVer)
    dllName = `${this.projName}.dll`
    dll = path.join(this.dllDir, this.dllName)
    
    infoDir = path.join(this.dllDir, 'Settings')
    gcDir = path.join(this.dir, 'Content', 'GameClient')
}()

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
//const ariaSession = path.join(downloads, 'aria2.session')

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
    try { await fs.rename(path.join(downloads, `${gsPkg.zipInfoHashV1}.torrent`), gsPkg.zipTorrent) } catch(err) {}
    try { await fs.rename(path.join(downloads, `${gcPkg.zipInfoHashV1}.torrent`), gcPkg.zipTorrent) } catch(err) {}
    try { await fs.rename(path.join(downloads, `${sdkPkg.zipInfoHashV1}.torrent`), sdkPkg.zipTorrent) } catch(err) {}
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

    const gcArgs = ['', '', '', ([ip, port.toString(), sanitize_bfkey(key), clientId.toString()]).join(' ')].map(a => `"${a}"`).join(' ')
    
    await stopClient()

    if(process.platform == 'win32')
        clientSubprocess = new SubProcess(gcPkg.exe, [ gcArgs ])
    else if(process.platform == 'linux')
        clientSubprocess = new SubProcess('bottles-cli', ['run', '-b', 'Default Gaming', '-e', gcPkg.exe, gcArgs])
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
    info.gameInfo.CONTENT_PATH = path.relative(gsPkg.dllDir, gsPkg.gcDir)

    const gsInfo = path.join(gsPkg.infoDir, `GameInfo.${info.gameId}.json`)
    await fs.writeFile(gsInfo, JSON.stringify(info, null, 4))
    const gsInfoRel = path.relative(gsPkg.dllDir, gsInfo)

    serverSubprocess = new SubProcess(sdkPkg.exe, [
        gsPkg.dll, '--port', port.toString(), '--config', gsInfoRel,
    ], {
        cwd: gsPkg.dllDir,
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
            repairArchived(sdkPkg),
            repairArchived(gsPkg),
        ]).then(async () => {
            if(!await fs_exists(gsPkg.dll))
                await build(gsPkg)
            if(!await fs_exists(gsPkg.infoDir))
                await fs.mkdir(gsPkg.infoDir)
        }),
        repairArchived(gcPkg),
    ] as Promise<unknown>[])
}

async function repairArchived(pkg: PkgInfo){
    if(await fs_exists(pkg.checkUnpackBy)){
        return // OK
    } else if(await fs_exists_and_size_eq(pkg.zip, pkg.zipSize)){
        try {
            await unpack(pkg)
            return // OK
        } catch(err) {
            if(!(err instanceof DataError))
                throw err
        }
    }
    if(await fs_exists(pkg.zipTorrent)){
        await download(pkg, 'torrent')
        await unpack(pkg)
    } else {
        await download(pkg, 'magnet')
        await unpack(pkg)
    }
}

type TerminationErrorCause = { code: null|number, signal: null|string }
type TerminationErrorOptions = { cause?: TerminationErrorCause }
class TerminationError extends Error implements TerminationErrorOptions {
    cause?: TerminationErrorCause
    constructor(msg: string, options?: TerminationErrorOptions){
        super(msg)
        this.cause = options?.cause
    }
}
function successfulTermination(proc: ChildProcess){
    return new Promise<void>((resolve, reject) => {
        proc.on('error', (err) => reject(err))
        proc.on('exit', (code: null|number, signal: null|string) => {

            let msg = `Process exited with code ${code}`
            if(signal) msg += ` by signal ${signal}`
            console.log(msg)

            if(code === 0) resolve()
            else {    
                reject(new TerminationError(msg, { cause: { code, signal } }))
            }
        })
    })
}

const s7zDataErrorMsgs = [
    /\bData Error\b/,
    /\bCRC Failed\b/,
    /\bIs not archive\b/,
    /\bCan(?: ?not|'?t) open (?:the )?file as archive\b/,
    /\bUnexpected end of (?:data|archive|(?:input )?stream)\b/,
    //TODO: ...
]

enum s7zExitCodes {
    Warning = 1,
    FatalError = 2,
    CommandLineError = 7,
    NotEnoughMemoryForOperation = 8,
    UserStoppedTheProcess = 255,
}

class DataError extends Error {}
async function unpack(pkg: PkgInfo){
    console.log(`Unpacking ${pkg.zipName}...`)

    try {
        await fs.mkdir(pkg.dir)
    } catch(unk_err) {
        const err = unk_err as ErrnoException
        if(err.code != 'EEXIST')
            throw err
    }
    
    const controller = new AbortController();
    const { signal } = controller;

    const opts = ['-aoa', `-o${pkg.dir}`, '-bsp2']
    if(!pkg.noDedup) opts.push('-spe')
    
    const s7zs: ChildProcess[] = []

    if(pkg.zipExt == '.tar.gz'){
        s7zs[0] = spawn(path7z, ['x', '-so', '-tgzip', pkg.zip], {
            stdio: [ 'inherit', 'pipe', 'pipe' ], signal
        })
        s7zs[1] = spawn(path7z, ['x', '-si', '-ttar', ...opts], {
            stdio: [ 'pipe', 'pipe', 'pipe' ], signal
        })
        s7zs[0].stdout!.pipe(s7zs[1].stdin!)
    } else {
        s7zs[0] = spawn(path7z, (['x', ...opts, pkg.zip]))
    }

    s7zs.at(-1)!.stdout!.setEncoding('utf8').addListener('data', (chunk) => onData(-1, 'stdout', chunk))
    s7zs.at(-1)!.stderr!.setEncoding('utf8').addListener('data', (chunk) => onData(-1, 'stderr', chunk))
    function onData(i: number, src: 'stdout' | 'stderr', chunk: string){
        console.log(`s7zs[${i}]`, src, chunk)
        if(s7zDataErrorMsgs.some(msg => msg.test(chunk))){
            s7zs.at(i)![src]!.removeAllListeners('data')
            controller.abort(new DataError())
            console.log('abort')
        }
    }

    try {
        await Promise.race([
            Promise.all(s7zs.map(s7zi => successfulTermination(s7zi))),
            new Promise((resolve, reject) => {
                signal.addEventListener('abort', () => {
                    reject(signal.reason)
                })
            }),
        ])
    } catch(err) {
        if(err instanceof DataError) throw err
        else if(err instanceof TerminationError){
            if(err.cause?.code === s7zExitCodes.Warning){ /*OK*/ }
            else throw err
        } else throw err
    }
    
    if(!await fs_exists(pkg.checkUnpackBy))
        throw new Error(`Unable to unpack ${pkg.zipName}`)
}

async function build(pkg: PkgInfoCSProj){
    console.log(`Building ${pkg.csProj}...`)

    let txt = await fs.readFile(pkg.csProj, 'utf8')
    txt = txt.replace(/(?<=<TargetFramework>)(?:.|\n)*?(?=<\/TargetFramework>)/g, pkg.netVer)
    await fs.writeFile(pkg.csProj, txt, 'utf8')

    await exec(sdkPkg.exe, ['build', pkg.csProj])

    if(!await fs_exists(gsPkg.dll))
        throw new Error(`Unable to build ${gsPkg.dllName}`)
}

const multibar = new MultiBar({
    format: '{filename} [{bar}] {percentage}% | {value}/{total} | {duration_formatted}/{eta_formatted}',
    //clearOnComplete: false,
    //hideCursor: true,
}, Presets.legacy);
const bars = new Set<SingleBar>()

let aria2proc: undefined | SubProcess
let aria2procPromise: undefined | Promise<void>
let aria2conn: undefined | Conn
let aria2connPromise: undefined | Promise<Conn>
let aria2secret: undefined | string

async function startAria2(){
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
}

async function stopAria2(){
    const prevSubprocess = aria2proc!

    if(!aria2proc) return
    aria2proc = undefined

    await killSubprocess(prevSubprocess)
}

async function download(pkg: PkgInfo, type: 'magnet' | 'torrent'){
    //console.log(`Downloading ${zipName}...`)
    const bar = multibar.create(pkg.zipSize, 0, { filename: pkg.zipName })
    bars.add(bar)
    multibar.stop()
    
    await startAria2()
    
    const opts = {
        'bt-save-metadata': true,
        'bt-load-saved-metadata': true,
        'rpc-save-upload-metadata': true,
        dir: downloads,
        out: pkg.zipName,
    }

    if(type == 'torrent'){
        const b64 = await fs.readFile(pkg.zipTorrent, 'base64')
        const gid = await aria2.addTorrent(aria2conn, b64, [], opts)
        await forCompletion(gid, false, bar)
    } else if(type == 'magnet'){
        const gid = await aria2.addUri(aria2conn, [ pkg.zipMagnet ], opts)
        await forCompletion(gid, true, bar)
    }

    if(!await fs_exists_and_size_eq(pkg.zip, pkg.zipSize))
        throw new Error(`Unable to download ${pkg.zipName}`)

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

await repair() //DEBUG:

export async function stop(){
    stopServer()
    stopClient()
    
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