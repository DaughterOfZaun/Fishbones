import { exec, spawn, SubProcess } from 'teen_process'
import { promises as fs } from "fs"
import s7z from '7z-bin'
import WebTorrent from 'webtorrent'
import { sanitize_bfkey, /*sanitize_str*/ } from './utils/constants'
import path from 'path'
import { quote } from 'shell-quote'
import type { ChildProcess } from 'child_process'

async function fs_exists(path: string){
    try {
        await fs.access(path)
        return true
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch(err) {
        return false
    }
}

const downloads = path.join(process.cwd(), 'downloads')

const gcDir = path.join(downloads, 'League of Legends_UNPACKED')
const gcExeDir = path.join(gcDir, 'League-of-Legends-4-20', 'RADS', 'solutions', 'lol_game_client_sln', 'releases', '0.0.1.68', 'deploy')
const gcExe = path.join(gcExeDir, 'League of Legends.exe')
const gcZipName = 'League of Legends_UNPACKED.7z'
const gcZip = path.join(downloads, gcZipName)
const gcZipTorrent = `${gcZip}.torrent`
const gcZipInfoHash = '4bb197635194f4242d9f937f0f9225851786a0a8'

const sdkVer = '9.0.300'

let sdkPlatform = ''
if(process.platform == 'win32') sdkPlatform = 'win'
else if(process.platform == 'linux') sdkPlatform = 'linux'
else if(process.platform == 'darwin') sdkPlatform = 'osx'
else throw new Error(`Unsupported platform: ${process.platform}`)

let sdkArch = ''
if(process.arch == 'x64') sdkArch = 'x64'
else if(process.arch == 'ia32') sdkArch = 'x86'
else if(process.arch == 'arm') sdkArch = 'arm'
else if(process.arch == 'arm64') sdkArch = 'arm64'
else throw new Error(`Unsupported arch: ${process.arch}`)

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
const netVer = 'net9.0'
const gsExeExt = (sdkPlatform == 'win') ? '.exe' : ''
const gsExeName = `${gsProjName}${gsExeExt}`
const gsExeDir = path.join(gsProjDir, 'bin', gsTarget, netVer)
const gsExe = path.join(gsExeDir, gsExeName)
const gsCSProj = path.join(gsProjDir, `${gsProjName}.csproj`)
const gsZipName = 'Chronobreak.GameServer.7z'
const gsZip = path.join(downloads, gsZipName)
const gsZipTorrent = `${gsZip}.torrent`
const gsZipInfoHash = 'e4043fdc210a896470d662933f7829ccf3ed781b'
const gsgcDir = path.join(gsDir, 'Content', 'GameClient')
const gsInfoDir = path.join(gsExeDir, 'Settings')

const trackersTxtName = 'trackers.txt'
const trackersTxt = path.join(downloads, trackersTxtName)
const trackerListsURLS = [
    'https://raw.githubusercontent.com/ngosang/trackerslist/master/trackers_best.txt',
    'https://ngosang.github.io/trackerslist/trackers_best.txt',
    'https://cdn.jsdelivr.net/gh/ngosang/trackerslist@master/trackers_best.txt',
]

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

async function repair7z(){
    const rwx_rx_rx =
        fs.constants.S_IRUSR | fs.constants.S_IWUSR | fs.constants.S_IXUSR |
        fs.constants.S_IRGRP | fs.constants.S_IXGRP |
        fs.constants.S_IROTH | fs.constants.S_IXOTH    
    for(const exe of [
        './node_modules/7z-bin/bin/linux/arm/7zzs',
        './node_modules/7z-bin/bin/linux/arm64/7zzs',
        './node_modules/7z-bin/bin/linux/ia32/7zzs',
        './node_modules/7z-bin/bin/linux/x64/7zzs'
    ])
        await fs.chmod(exe, rwx_rx_rx)
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

    //console.log(`"${gcExe}" "" "" "" "${ip} ${port} ${key} ${clientId}"`)
    const gcArgs = ['', '', '', /*quote*/([ip, port.toString(), sanitize_bfkey(key), clientId.toString()]).join(' ')].map(a => `"${a}"`).join(' ')
    
    console.log(quote(['bottles-cli', 'run', '-b', 'Default Gaming', '-e', gcExe, gcArgs]))
    //console.log(quote(['bottles-cli', 'run', '-b', 'Default Gaming', '-p', 'League of Legends', '--args-replace', gcArgs]))

    await stopClient()

    if(process.platform == 'win32')
        clientSubprocess = new SubProcess(gcExe, [ gcArgs ])
    else if(process.platform == 'linux')
        clientSubprocess = new SubProcess('bottles-cli', ['run', '-b', 'Default Gaming', '-e', gcExe, gcArgs])
        //clientSubprocess = new SubProcess('bottles-cli', ['run', '-b', 'Default Gaming', '-p', 'League of Legends', '--args-replace', gcArgs])
    else throw new Error(`Unsupported platform: ${process.platform}`)

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
    //console.log(`"${gsExe}" --port ${port} --config-json ${quote([JSON.stringify(info, sanitize_kv)])}`)

    info.gameInfo.CONTENT_PATH = path.relative(gsExeDir, gsgcDir)

    const gsInfo = path.join(gsInfoDir, `GameInfo.${info.gameId}.json`)
    await fs.writeFile(gsInfo, JSON.stringify(info, null, 4))
    const gsInfoRel = path.relative(gsExeDir, gsInfo)

    console.log(`${path.relative(gsExeDir, gsExe)} --port ${port} --config ${gsInfoRel}`)
    
    serverSubprocess = new SubProcess(gsExe, [
        //'--port', port.toString(), '--config-json', quote([JSON.stringify(info, sanitize_kv)]),
        '--port', port.toString(), '--config', gsInfoRel,
    ], {
        cwd: gsExeDir,
    })
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
    
    await repairTorrentsTxt()
    await repair7z()

    await Promise.all([
        Promise.all([
            repairArchived(sdkExe, sdkDir, sdkZip, sdkZipName, sdkZipTorrent, sdkZipInfoHash),
            repairArchived(gsCSProj, gsDir, gsZip, gsZipName, gsZipTorrent, gsZipInfoHash)
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
        await download(zip, zipName, torrent)
        await unpack(exe, dir, zip, zipName)
    } else {
        await download(zip, zipName, infohash, torrent)
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

    await fs.mkdir(dir)

    const opts = ['-aoa', `-o${dir}`]
    if(zip.endsWith('.tar.gz')){
        const s7z1 = spawn(
            s7z.path7z, /*quote*/(['x', '-so', zip])/*.split(' ')*/,
            { stdio: [ 'inherit', 'pipe', 'inherit' ] },
        )
        const s7z2 = spawn(
            s7z.path7z, /*quote*/(['x', '-si', '-ttar', ...opts])/*.split(' ')*/,
            { stdio: [ 'pipe', 'inherit', 'inherit' ] },
        )
        s7z1.stdout.pipe(s7z2.stdin)
        await Promise.all([
            successfulTermination(s7z1),
            successfulTermination(s7z2),
        ])
    } else {
        const s7z1 = spawn(s7z.path7z, /*quote*/(['x', ...opts, zip])/*.split(' ')*/)
        await successfulTermination(s7z1)
    }
    
    if(!await fs_exists(exe))
        throw new Error(`Unable to unpack ${zipName}`)
}

//TODO: <TargetFramework>net8.0</TargetFramework>
async function build(exe: string, exeName: string, csproj: string){
    console.log(`Building ${csproj}...`)

    await exec(sdkExe, ['build', csproj], {
        env: {...process.env, 'DOTNET_CLI_TELEMETRY_OPTOUT': '1' }
    })
    if(!await fs_exists(exe))
        throw new Error(`Unable to build ${exeName}`)
}

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
        webtorrent!.add(torrent, { path: downloads, strategy: 'rarest' }, saveto ? async torrent => {
            torrent.on('metadata', async () => {
                await fs.writeFile(saveto, torrent.torrentFile)
            })
            torrent.on('done', resolve)
            torrent.on('error', reject)
        } : undefined)
    })
    if(!await fs_exists(zip))
        throw new Error(`Unable to download ${zipName}`)
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