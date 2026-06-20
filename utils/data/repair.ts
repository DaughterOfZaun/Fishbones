import { build } from "./build"
import { download, appendPartialDownloadFileExt, repairAria2, seed } from "./download/download"
import { gc126Pkg, gc420Pkg, gitPkg, bwPkg, cbPkg, modPck1, type PkgInfo, repairTorrents, sdkPkg, type PkgInfoCSProj, packages } from "./packages"
import { console_log, createBar, currentExe, extractFile } from "../../ui/remote/remote"
import { console_log_fs_err, cwd, downloads, fs_chmod, fs_copyFile, fs_ensureDir, fs_exists, fs_exists_and_size_eq, fs_moveFile, fs_overwrite, fs_readdir, fs_readFile, fs_removeFile, fs_rmdir, fs_stat, fs_statfs, fs_truncate, fs_writeFile, rwx_rx_rx } from './fs'
import { readTrackersTxt } from "./download/trackers"
import { appendPartialUnpackFileExt, DataError, repair7z, unpack } from "./unpack"
import { TerminationError, unwrapAbortError } from "../process/process"
import type { AbortOptions } from "@libp2p/interface"
import { promises as fs } from 'fs'
import path from 'node:path'
import embedded from './embedded/embedded'
import os from 'os'
import { runPostInstall, update } from "./update"
import { args } from "../args"
import { checkForUpdates, fbPkg, isNewVersionAvailable, fbPkgCurrent, repairSelfPackage } from "./upgrade"
import { spawn } from "node:child_process"
import { tr } from "../translation"
import { DeferredView, render } from "../../ui/remote/view"
import { button, form, label } from "../../ui/remote/types"
import { VERSION } from "../constants-build"
import type { StatsFs } from "node:fs"
import { clients_push, combinations_merge, combinations_push, KnownClients, KnownServers, servers_push, type ClientInfo, type ServerInfo } from "./constants/client-server-combinations"
import { ClientDataInfoV126 } from "./packages/game-client-126"
import { BrokenWingsDataInfo } from "./packages/game-server-bw"
import { ClientDataInfoV420 } from "./packages/game-client-420"
import { ChronobreakDataInfo } from "./packages/game-server-cb"
import { champions } from "./constants/champions"
import { TestGroundsDataInfo, tgPkg } from "./packages/game-server-tg"
import { inspect } from 'node:util'

const DOTNET_INSTALL_CORRUPT_EXIT_CODES = [ 130, 131, 142, ]

function throwAnyRejection(results: PromiseSettledResult<unknown>[]){
    const reasons = results
        .filter(result => result.status === 'rejected')
        .map(result => result.reason as Error)
    if(reasons.length)
        throw new AggregateError(reasons)
}

export async function repair(opts: Required<AbortOptions>){
    const view = render('Install', form({}), opts)
    const res = await repairImpl(view, opts)
    view.resolve()
    return res
}

const checkFileSize = async (path: string, size: number, opts: Required<AbortOptions>) => {
    const existingFileSize = (await fs_stat(path, opts, false))?.size ?? 0
    const result = Math.max(0, size - existingFileSize)
    //console_log('checkFileSize', existingFileSize, 'vs', size, '=', result)
    return result
}

const checkDirSize = async (checkUnpackBy: string, zipPath: string, size: number, opts: Required<AbortOptions>) => {
    const [ dirExists, zipBeingUnpacked ] = await Promise.all([
        fs_exists(checkUnpackBy, opts, false),
        fs_exists(appendPartialUnpackFileExt(zipPath), opts, false),
    ])
    const result = (!dirExists || zipBeingUnpacked) ? size : 0
    //console_log('checkDirSize', dirExists, 'and', zipBeingUnpacked, 'vs', size, '=', result)
    return result
}

const formatSize = (v: number) => {
    let str = ''
    if(v >= 999_995_000) str = `${(v / 1_000_000_000).toFixed(2)} GB`
    else if(v > 999_995) str = `${(v / 1_000_000).toFixed(2)} MB`
    else if(v > 999) str = `${(v / 1_000).toFixed(2)} KB`
    else str = `${v.toFixed(2)} B`
    return str
}

const checkDriveSizeAndGetErrorMsg = (fsStats: StatsFs | undefined, root: string, sizeRequired: number) => {
    if(!fsStats) return
    const spaceAvaible = fsStats.bavail * fsStats.bsize
    const spaceDeficit = sizeRequired - spaceAvaible
    //console_log('checkDriveSizeAndGetErrorMsg', spaceAvaible, 'vs', spaceDeficit)
    if(spaceDeficit > 0){
        return tr('{size} more disk space required on {path}', {
            size: formatSize(spaceDeficit),
            path: root,
        })
    }
}

let repairArchived_sdkPkg_opts: Promise<void> | null = null
async function repairSDK(opts: Required<AbortOptions> & { ignoreUnpacked?: boolean }){
    return repairArchived_sdkPkg_opts ??=
        repairArchived(sdkPkg, opts)
            .finally(() => { repairArchived_sdkPkg_opts = null })
}

let repairArchived_gitPkg_opts: Promise<void> | null = null
async function repairGit(opts: Required<AbortOptions>){
    if(os.platform() !== 'win32') return
    return repairArchived_gitPkg_opts ??=
        repairArchived_gitPkg(opts)
            .finally(() => { repairArchived_sdkPkg_opts = null })
}
async function repairArchived_gitPkg(opts: Required<AbortOptions>){
    await repairArchived(gitPkg, opts)
    if(await fs_exists(gitPkg.postInstall, opts, false))
        await runPostInstall(opts)
}

async function repairImpl(view: DeferredView<void>, opts: Required<AbortOptions>){
    //console.log('Running data check and repair...')

    await fs_ensureDir(downloads, opts)

    if(!args.installS1Client.value)
        args.installModPack.set(false) //HACK?

    while(args.spaceCheck.value){
        const msg = await checkFreeSpaceAndGetErrorMsg(opts)
        if(msg){
            await retryPrompt(tr('Insufficient disk space'), msg, opts)
            continue
        }
        break
    }

    while(true){
        try {
            return await repairOrThrow(opts)
        } catch(err){
            if(opts.signal.aborted) throw err //TODO: Should I put this in all try-catch blocks?
            await retryPrompt(
                tr('Repairing failed'),
                tr('Repairing of some critical component has failed.'),
                opts,
            )
            //continue
        }
        //break
    }
}

//TODO: Rework.
async function checkFreeSpaceAndGetErrorMsg(opts: Required<AbortOptions>){

    const downloadsRoot = path.parse(downloads).root
    const gcInstallRoot = path.parse(gc126Pkg.dir).root
    const isSingleRoot = downloadsRoot == gcInstallRoot
    
    //TODO: Extract embeds sizes.
    let [
        downloadsStats,
        gcInstallDirStats,
        downloadsSizeRequired,
        gcInstallDirSizeRequired,
    ] = await Promise.all([

        fs_statfs(downloads, opts),
        //(!isSingleRoot) ?
        fs_statfs(gc126Pkg.dir, opts)
        //: Promise.resolve(undefined)
        ,
        Promise.all([
            
            checkFileSize(path.join(downloads, path.basename(embedded.s7zExe)), 3759224, opts),
            checkFileSize(path.join(downloads, path.basename(embedded.ariaExe)), 9926088, opts),
            checkFileSize(path.join(downloads, path.basename(embedded.bunExe)), 103547344, opts),
            
            checkFileSize(path.join(downloads, 'aria2.dht6.dat'), 9240, opts),
            checkFileSize(path.join(downloads, 'aria2.dht.dat'), 10080, opts),
            
            ...(
                (args.installBWServer.value) ? (
                    (args.update.value) ? [
                        checkDirSize(bwPkg.checkUnpackBy, bwPkg.zip, bwPkg.size, opts),
                    ] : [
                        checkDirSize(bwPkg.checkUnpackBy, bwPkg.zip, bwPkg.size, opts),
                        checkFileSize(bwPkg.zip, bwPkg.zipSize, opts),
                        checkFileSize(bwPkg.zipTorrent, 14564, opts),
                    ]
                ) : []
            ),
            ...(
                (args.installCBServer.value) ? [
                    checkDirSize(cbPkg.checkUnpackBy, cbPkg.zip, cbPkg.size, opts),
                    checkFileSize(cbPkg.zip, cbPkg.zipSize, opts),
                    checkFileSize(gc420Pkg.zipTorrent, 20022, opts),
                ] : []
            ),
            
            checkFileSize(path.join(downloads, 'config.json'), 64, opts),
            checkFileSize(path.join(downloads, path.basename(embedded.d3dx9_39_dll)), 3851784, opts),
            
            checkDirSize(sdkPkg.checkUnpackBy, sdkPkg.zip, sdkPkg.size, opts),
            checkFileSize(sdkPkg.zip, sdkPkg.zipSize, opts),
            checkFileSize(sdkPkg.zipTorrent, 49220, opts),

            checkDirSize(fbPkg.checkUnpackBy, fbPkg.zip, 220201496, opts),
            checkFileSize(fbPkg.zip, 81561932, opts),
            checkFileSize(fbPkg.zipTorrent, 25399, opts),
            
            checkFileSize(path.join(downloads, `index-${VERSION}.js`), 14896347, opts),
            checkFileSize(path.join(downloads, 'mastery-pages.json'), 1494, opts),
            checkFileSize(path.join(downloads, 'log.txt'), 1834, opts),
            
            ...((args.installModPack.value) ? [
                //checkDirSize(modPck1.checkUnpackBy, modPck1.zip, modPck1.size, opts),
                checkFileSize(modPck1.zip, modPck1.zipSize, opts),
                checkFileSize(modPck1.zipTorrent, 37085, opts),
            ] : []),

            checkFileSize(path.join(downloads, path.basename(embedded.dataChannelLib)), 10231328, opts),
            
            //checkDirSize(gc126Pkg.checkUnpackBy, gc126Pkg.zip, gc126Pkg.size, opts),
            checkFileSize(gc126Pkg.zip, gc126Pkg.zipSize, opts),
            checkFileSize(gc126Pkg.zipTorrent, 90417, opts),

            ...((os.platform() === 'win32') ? [
                checkDirSize(gitPkg.checkUnpackBy, gitPkg.zip, gitPkg.size, opts),
                checkFileSize(gitPkg.zip, gitPkg.zipSize, opts),
                checkFileSize(gitPkg.zipTorrent, 24284, opts),
            ] : []),

            checkFileSize(path.join(downloads, 'trackers.txt'), 809, opts),
        ])
        .then(results => results.reduce((a, v) => a + v, 0)),

        Promise.all([
            ...((args.installS1Client.value) ? [
                checkDirSize(gc126Pkg.checkUnpackBy, gc126Pkg.zip, gc126Pkg.size, opts),
            ] :[]),
            ...((args.installModPack.value) ? [
                checkDirSize(modPck1.lockFile, modPck1.zip, modPck1.size, opts),
            ] :[]),
            ...((args.installS4Client.value) ? [
                checkDirSize(gc420Pkg.checkUnpackBy, gc420Pkg.zip, gc420Pkg.size, opts),
            ] :[]),
        ])
        .then(results => results.reduce((a, v) => a + v, 0)),
    ])

    downloadsSizeRequired *= 1.1
    gcInstallDirSizeRequired *= 1.1

    let msg: string | undefined
    if(!isSingleRoot)
        msg = ([
            checkDriveSizeAndGetErrorMsg(downloadsStats, downloadsRoot, downloadsSizeRequired),
            checkDriveSizeAndGetErrorMsg(gcInstallDirStats, gcInstallRoot, gcInstallDirSizeRequired),
        ]).filter(msg => msg).join('\n')
    else
        msg = checkDriveSizeAndGetErrorMsg(downloadsStats, downloadsRoot, downloadsSizeRequired + gcInstallDirSizeRequired)

    return msg
}

async function retryPrompt(title: string, msg: string, opts: Required<AbortOptions>){
    const view = render('DiskSpaceWarning', form({
        'Retry': button(() => view.resolve()),
        'Title': label(title),
        'Message': label(msg),
    }), opts, [
        {
            //HACK:
            regex: /.\/DiskSpaceWarning\/Retry:pressed/,
            listener: () => view.resolve(),
        }
    ])
    return view.promise
}

async function repairOrThrow(opts: Required<AbortOptions>){

    let results: PromiseSettledResult<unknown>[]
    results = await Promise.allSettled([
        readTrackersTxt(opts).catch((err) => { console_log(tr('Restoring torrent trackers list failed:', {}), inspect(err)) }),
        repairTorrents(opts).catch((err) => { console_log(tr('Restoring torrent files failed:', {}), inspect(err)) }),
        repair7z(opts), //.catch((err) => { console_log(tr('Restoring 7z archiver executable failed:', {}), inspect(err)); throw err }),
        repairAria2(opts), //.catch((err) => { console_log(tr('Restoring Aria2 downloader executable failed:', {}), inspect(err)); throw err }),
        !(args.upgrade.value) ? Promise.resolve() :
        checkForUpdates(opts).catch(err => { console_log(tr('Update check failed:', {}), inspect(err)) }),
    ])
    throwAnyRejection(results)

    if(args.upgrade.value && isNewVersionAvailable()) try {

        // A hack to speed up download.
        if(await fs_exists(fbPkgCurrent.zip, opts) && !await fs_exists(fbPkg.zip, opts)){
            const bar = createBar(tr('Copying'), fbPkgCurrent.zip)
            await fs_copyFile(fbPkgCurrent.zip, fbPkg.zip, opts)
            await fs_truncate(fbPkg.zip, fbPkg.zipSize, opts)
            bar.stop()
        }
        await download(fbPkg, opts)
        await unpack(fbPkg, opts)

        const now = new Date()
        // Fix file after unpacking.
        await fs.utimes(fbPkg.exe, now, now)
        await fs_chmod(fbPkg.exe, rwx_rx_rx, opts)

        console.assert(fbPkg.dir === fbPkgCurrent.dir)
        const oldExe = path.join(fbPkgCurrent.dir, `Fishbones.${fbPkgCurrent.version}.exe`)
        await fs_moveFile(currentExe, oldExe, opts, true)
        await fs_moveFile(fbPkg.exe, currentExe, opts, true)

        spawn(currentExe, {
            //cwd: process.cwd(),
            stdio: 'ignore',
            detached: true,
        }).unref()

        return { mustExit: true }
    
    } catch(err) {
        console_log(tr(`Restoring launcher package failed:`), inspect(err))
    }

    let modFileIsMissing = !await fs_exists(modPck1.lockFile, opts, false)
    let gc126ExeIsMissing = !await fs_exists(gc126Pkg.exe, opts)
    let gc420ExeIsMissing = !await fs_exists(gc420Pkg.exe, opts)
    let bwExeIsMissing = !await fs_exists(bwPkg.dll, opts)
    let cbExeIsMissing = !await fs_exists(cbPkg.dll, opts)
    let tgExeIsMissing = !await fs_exists(tgPkg.dll, opts)
    let bwUpdated = false
    let tgUpdated = false

    results = await Promise.allSettled([

        !(args.torrentDownload.value) ? Promise.resolve() :
        repairSelfPackage(opts).catch(err => {
            console_log(tr(`Restoring launcher package failed:`), inspect(err))
        }),

        !(args.installBWServer.value) ? Promise.resolve() :
        Promise.allSettled([
            repairSDK(opts),
            (async () => {
                if(args.update.value || args.mrNumber.value !== undefined){
                    try {
                        await repairGit(opts)
                        bwUpdated = await update(bwPkg, opts)
                        return // OK
                    } catch(err) {
                        console_log(tr('Updating game server package failed:', {}), inspect(err))
                    }
                }
                await repairArchived(bwPkg, opts)
            })(),
        ]).then(async (results) => {
            throwAnyRejection(results)

            // Allow packages to contain already built exe.
            //gsExeIsMissing = !await fs_exists(bwPkg.dll, opts)

            if(bwExeIsMissing || bwUpdated){
                await tryBuild(bwPkg, opts)
                bwExeIsMissing = false
            }
            await fs_ensureDir(bwPkg.infoDir, opts)
        }),

        !(args.installCBServer.value) ? Promise.resolve() :
        Promise.allSettled([
            repairSDK(opts),
            repairArchived(cbPkg, opts),
        ]).then(async (results) => {
            throwAnyRejection(results)
            if(cbExeIsMissing){
                await tryBuild(cbPkg, opts)
                cbExeIsMissing = false
            }
            await fs_ensureDir(cbPkg.infoDir, opts)

            const levelsDir = path.join(cbPkg.dir, ...'Content/GameClient/LEVELS'.split('/'))
            await fs_moveFile(path.join(levelsDir, 'map11'), path.join(levelsDir, 'Map11'), opts, false)
        }),

        !(args.installTGServer.value) ? Promise.resolve() :
        Promise.allSettled([
            repairSDK(opts),
            (async () => {
                await repairGit(opts)
                tgUpdated = await update(tgPkg, opts)
            })(),
        ]).then(async (results) => {
            throwAnyRejection(results)
            if(tgExeIsMissing || tgUpdated){
                await tryBuild(tgPkg, opts)
                tgExeIsMissing = false
            }
            await fs_ensureDir(tgPkg.infoDir, opts)
            
            const gsSettings = path.join(tgPkg.infoDir, 'GameServerSettings.json')
            await fs_writeFile(gsSettings, JSON.stringify({ autoStartClient: false }, null, 4), { ...opts, encoding: 'utf8' })
        }),

        !(args.installS1Client.value) ? Promise.resolve() :
        Promise.allSettled([
            
            repairArchived(gc126Pkg, opts).then(async () => {

                gc126ExeIsMissing = false

                Promise.allSettled([
                    (async () => {
                        //await fs_ensureDir(gc126Pkg.exeDir, opts)
                        const d3dx9_39_dll_name = 'd3dx9_39.dll'
                        const d3dx9_39_dll_src = path.join(downloads, d3dx9_39_dll_name)
                        const d3dx9_39_dll_dst = path.join(gc126Pkg.exeDir, d3dx9_39_dll_name)
                        if(!await fs_exists(d3dx9_39_dll_dst, opts, true)){
                            await extractFile(embedded.d3dx9_39_dll, d3dx9_39_dll_src, opts)
                            await fs_copyFile(d3dx9_39_dll_src, d3dx9_39_dll_dst, opts) //HACK: To bypass "Access denied" error.
                        }
                        //await ensureSymlink()
                    })(),
                    (async () => {
                        const fontconfig_path = path.join(gc126Pkg.exeDir, 'DATA', 'Menu', 'fontconfig_en_US.txt')
                        let fontconfig = await fs_readFile(fontconfig_path, { ...opts, encoding: 'utf8' })
                        if(!fontconfig) return
                            fontconfig = fontconfig.trim() + '\n'
                        let fontconfig_changed = false
                        const gsInfo = new BrokenWingsDataInfo(bwPkg.dir)
                        const bots = new Set([gsInfo.bots, ...Object.values(gsInfo.maps).map(map => map.bots)].flat())
                        for(const short of bots){
                            const name = champions.find(champ => champ.short == short)?.name ?? short
                            if(!fontconfig.includes(`"game_bot_${short}"`)){
                                fontconfig += `tr "game_bot_${short}" = "${name} Bot"` + '\n'
                                fontconfig_changed = true
                            }
                        }
                        if(fontconfig_changed)
                            await fs_writeFile(fontconfig_path, fontconfig, { ...opts, encoding: 'utf8' })
                    })(),
                ]).then((results) => {
                    throwAnyRejection(results)
                })
            }),
            
            !(args.installModPack.value && modFileIsMissing) ? Promise.resolve() :
            repairArchived(modPck1, { ...opts, ignoreUnpacked: true }),

        ]).then(async (results) => {

            throwAnyRejection(results)

            if (args.installModPack.value && modFileIsMissing){
                const bar = createBar(tr('Moving'), modPck1.name)
                try {
                    await fs_overwrite(modPck1.dir, gc126Pkg.dir, opts)
                } finally {
                    bar.stop()
                }
                await fs_removeFile(modPck1.dir, { ...opts, recursive: true, force: true })
                //const fs_opts = { ...opts, recursive: true }
                await fs_ensureDir(path.dirname(modPck1.lockFile), opts)
                await fs_writeFile(modPck1.lockFile, '', { ...opts, encoding: 'utf8' })
                modFileIsMissing = false
            }
        }),

        !(args.installS4Client.value) ? Promise.resolve() :
        repairArchived(gc420Pkg, opts).then(() => {
            gc420ExeIsMissing = false
        }),
    ])
    throwAnyRejection(results)

    let client: ClientInfo | null = null, server: ServerInfo | null = null

    client = gc126ExeIsMissing ? null : clients_push(gc126Pkg, new ClientDataInfoV126(gc126Pkg.dir), KnownClients.v126, 'v1.0.0.126 (Season 1)')
    if(!modFileIsMissing) Object.assign(client!.maps, modPck1.maps)
    
    server = bwExeIsMissing ? null : servers_push(bwPkg, new BrokenWingsDataInfo(bwPkg.dir), KnownServers.BrokenWings, tr('BrokenWings (Season 1)'))
    if(client && server) combinations_push(client, server)

    client = gc420ExeIsMissing ? null : clients_push(gc420Pkg, new ClientDataInfoV420(gc420Pkg.dir), KnownClients.v420, 'v4.20 (Season 4)')

    server = cbExeIsMissing ? null : servers_push(cbPkg, new ChronobreakDataInfo(cbPkg.dir), KnownServers.ChronoBreak, tr('Chronobreak (Season 1)'))
    if(client && server) combinations_push(client, server)

    server = tgExeIsMissing ? null : servers_push(tgPkg, new TestGroundsDataInfo(tgPkg.dir), KnownServers.TestGrounds, tr('TestGrounds (Season 4)'))
    if(client && server) combinations_push(client, server)

    combinations_merge()

    //TODO: await fs.cp(bwPkg.gcDir, gc126Pkg.exeDir, { recursive: true })

    if(args.torrentDownload.value){
        void Promise.allSettled(
            packages.map(async pkg => seed(pkg, opts))
        ).then((results) => {
            //throwAnyRejection(results)
            for(let i = 0; i < results.length; i++){
                const result = results[i]!
                const pkg = packages[i]!
                if(result.status === 'rejected'){
                    const err = result.reason as Error
                    console_log(tr(`Failed to seed {pkg_zipName}:`, { pkg_zipName: pkg.zipName }), inspect(err))
                }
            }
        })
    }
}

async function tryBuild(pkg: PkgInfoCSProj, opts: Required<AbortOptions>){
    try {
        await build(pkg, opts)
    } catch(err) {
        let tryToRepairSDK = false
        //if(err instanceof Error){
        //    const exception = err as ErrnoException
        //    if(exception.code == 'ENOENT'){ //TODO: Investigate.
        //        const desc1 = tr('SDK installation is probably corrupted')
        //        const desc2 = tr('File not found')
        //        console_log(`${desc1}. ${desc2}:\n`, exception.path ?? '')
        //        tryToRepairSDK = true
        //    }
        //}
        if(err instanceof TerminationError){
            const exitCode = err.cause?.code ?? 0
            if(DOTNET_INSTALL_CORRUPT_EXIT_CODES.includes(exitCode)){
                const desc1 = tr('SDK installation is probably corrupted')
                const desc2 = tr(`exit code is {exitCode}`, { exitCode })
                console_log(`${desc1} (${desc2})`)
                tryToRepairSDK = true
            }
        }
        if(tryToRepairSDK){
            await repairSDK({ ...opts, ignoreUnpacked: true })
            await build(pkg, opts)
        } else
            throw err
    }
}

// cwd = Z:
// downloads = Z:/Fishbones_Data
// pkg.dir = Z:/Fishbones_Data/GameServer

// [Z:/Fishbones_Data]/GameServer?/GameServer.sln <-- pkg.dir in downloads (the way it should be)
// [Z:/Fishbones_Data]/GameServer.sln <-- pkg.dir is downloads (danger)
// [Z:/Fishbones_Data/Foo]/GameServer?/GameServer.sln <-- pkg.dir in downloads subfolder
// [Z:/Fishbones_Data/Foo]/GameServer.sln <-- pkg.dir in downloads but wrong name
// [Z:/Fishbones_Data/Foo]/[Bar]/GameServer.sln <-- pkg.dir in downloads subfolder but wrong name (too complex?)
// [Z:]/GameServer?/GameServer.sln <-- pkg.dir in cwd
// [Z:]/GameServer.sln <-- pkg.dir is cwd (danger)
// [Z:/Foo]/GameServer.sln <-- pkg.dir in cwd but wrong name
// [Z:/Foo]/GameServer?/GameServer.sln <-- pkg.dir in cwd subfolder
// [Z:/Foo]/[Bar]/GameServer.sln <-- pkg.dir in cwd subfolder but wrong name (too complex?)

//TODO: Cache?
async function getPotentialRoots(opts: Required<AbortOptions>){

    const dirents = await Promise.all([
        fs.readdir(downloads, { withFileTypes: true }), // Z:/Fishbones_Data/Foo
        fs.readdir(cwd, { withFileTypes: true }), // Z:/Foo
    ])

    opts.signal.throwIfAborted()

    return [
        ...dirents.flat()
        .filter(dirent => dirent.isDirectory() || dirent.isSymbolicLink())
        .map(dirent => path.join(dirent.parentPath, dirent.name)),

        downloads, // Z:/Fishbones_Data
        cwd, // Z:
    ]
}

//TODO: Compare files to PkgInfo.topLevelEntries
async function * findPackageDirs(pkg: PkgInfo, opts: Required<AbortOptions>){
    const { dirName: pkgDirName, checkUnpackBy: filePath } = pkg
    console.assert(filePath.startsWith(pkg.dir))

    //const zipNameWithoutExt = pkg.zipName
    //    .replace('.' + pkg.zipExt, '')
    //    .replace(pkg.zipExt, '')

    const potentialRoots = new Set([
        ...await getPotentialRoots(opts),
        path.join(path.dirname(pkg.dir), pkg.dirName),
    ])

    potentialRoots.delete(pkg.dir)

    for(const root of potentialRoots){
        const pathsToTest = new Set<string>([
            root, // GameServer.sln
            path.join(root, pkgDirName), // GameServer/GameServer.sln
            //path.join(root, zipNameWithoutExt),
            //path.join(root, zipNameWithoutExt, pkgDirName),
        ])

        pathsToTest.delete(pkg.dir)

        for(const pathToTest of pathsToTest){
            const results = await Promise.all([
                fs_exists(filePath.replace(pkg.dir, pathToTest), opts, false),
                ...(pkg.pathsToCheck ?? []).map(async (pathToCheck) => {
                    return fs_exists(path.join(pathToTest, ...pathToCheck.split('/')), opts, false)
                })
            ])
            if(results.every(result => result))
                yield pathToTest
        }
    }
    //return undefined
}

async function moveFoundFilesToDir(foundPkgDir: string, pkg: PkgInfo, opts: Required<AbortOptions>){

    await fs_ensureDir(pkg.dir, opts)

    let successfullyMovedRequiredFiles = true
    await Promise.all([
        ...pkg.topLevelEntries.map(async (fileName) => {
            try {
                await moveToPkgDir(fileName)
            } catch(err) {
                const filePath = path.join(foundPkgDir, fileName)
                console_log_fs_err(tr('Moving required file failed', {}), filePath, err)
                successfullyMovedRequiredFiles = false
            }
        }),
        ...pkg.topLevelEntriesOptional.map(async (fileName) => {
            try {
                await moveToPkgDir(fileName)
            } catch(err) {
                const filePath = path.join(foundPkgDir, fileName)
                console_log_fs_err(tr('Moving optional file failed', {}), filePath, err)
            }
        }),
    ])
    async function moveToPkgDir(fileName: string){
        return fs_moveFile(
            path.join(foundPkgDir, fileName),
            path.join(pkg.dir, fileName),
            { ...opts, rethrow: true },
            false,
        )
    }
    //opts.signal.throwIfAborted()

    // Try to delete the folder if it is empty.
    await fs_rmdir(foundPkgDir, { ...opts, recursive: false }, false)

    return successfullyMovedRequiredFiles
}

// cwd = Z:
// downloads = Z:/Fishbones_Data
// pkg.zip = Z:/Fishbones_Data/GameServer.7z

// [Z:/Fishbones_Data]/GameServer.7z <-- pkg.zip in downloads (the way it should be)
// [Z:/Fishbones_Data/Foo]/GameServer.7z <-- pkg.zip in downloads subfolder
// [Z:/Foo]/GameServer.7z <-- pkg.zip in cwd subfolder
// [Z:]/GameServer.7z <-- pkg.zip in cwd

//TODO: Check downloader control file.
//TODO: Sort candidates by date and size.
async function findPackageZip(pkg: PkgInfo, opts: Required<AbortOptions>){
    const { zip: filePath } = pkg
    console.assert(filePath.startsWith(downloads))
    const potentialRoots = await getPotentialRoots(opts)
    for(const root of potentialRoots){
        const potentialPath = filePath.replace(downloads, root)
        if(root != downloads // not (the way it should be)
        && await fs_exists(potentialPath, opts, false)
        && await fs_exists_and_size_eq(potentialPath, pkg.zipSize, opts, true))
            return potentialPath
    }
    return undefined
}

export async function repairArchived(pkg: PkgInfo, opts: Required<AbortOptions> & { ignoreUnpacked?: boolean, doNotUnpack?: boolean }){

    if(!opts.ignoreUnpacked)
    if(await fs_exists(pkg.checkUnpackBy, opts)){
        const lockfile = appendPartialUnpackFileExt(pkg.zip)
        if(await fs_exists(lockfile, opts, false)){
            console_log(tr('Found temporary unpacker file:', {}), lockfile)
        } else
            return // OK
    } else {
        for await (const foundPkgDir of findPackageDirs(pkg, opts)){
            const foundEntries = new Set(await fs.readdir(foundPkgDir))
            const requiredEntres = new Set(pkg.topLevelEntries)
            const optionalEntries = new Set(pkg.topLevelEntriesOptional)
            if(foundEntries.isSupersetOf(requiredEntres)){
                if(foundEntries.isSubsetOf(requiredEntres.union(optionalEntries))){
                    console_log(tr(`Moving "{foundPkgDir}" to "{pkg_dir}"...`, { foundPkgDir, pkg_dir: pkg.dir }))
                    if(await fs_moveFile(foundPkgDir, pkg.dir, opts)){
                        //TODO: await fs_rmdir(path.dirname(foundPkgDir), opts)
                        return // OK
                    }
                } else {
                    console_log(tr(`Moving files from "{foundPkgDir}" to "{pkg_dir}"...`, { foundPkgDir, pkg_dir: pkg.dir }))
                    if(await moveFoundFilesToDir(foundPkgDir, pkg, opts))
                        return // OK
                }
            } else {
                const missingEntries = [...requiredEntres.difference(foundEntries)].join(', ')
                console_log(tr(`Skipping "{foundPkgDir}" because it does not contain some files:`, { foundPkgDir }), missingEntries)
            }
        }
    }

    //console.log('file %s does not exist', pkg.checkUnpackBy)
    if(await fs_exists_and_size_eq(pkg.zip, pkg.zipSize, opts)){
        const lockfile = appendPartialDownloadFileExt(pkg.zip)
        if(await fs_exists(lockfile, opts, false)){
            console_log(tr('Found temporary downloader file:', {}), lockfile)
        } else if(await tryToUnpack(pkg, opts))
            return // OK
    } else {
        const foundPkgZip = await findPackageZip(pkg, opts)
        if(foundPkgZip){
            console_log(tr(`Moving "{foundPkgZip}" to "{pkg_zip}"`, { foundPkgZip, pkg_zip: pkg.zip }))
            if(await fs_moveFile(foundPkgZip, pkg.zip, opts)
            && await tryToUnpack(pkg, opts))
                return // OK
        }
    }

    if(pkg.zipEmbded){
        await extractFile(pkg.zipEmbded, pkg.zip, opts)
    } else {
        await download(pkg, opts)
    }

    if(!opts.doNotUnpack){
        await unpack(pkg, opts)
        //TODO: Re-download.
    }
}

//TODO: Modify `unpack` to return boolean instead of throwning?
async function tryToUnpack(pkg: PkgInfo, opts: Required<AbortOptions>){
    try {
        await unpack(pkg, opts)
        return true // OK
    } catch(unk_err) {
        const err = unwrapAbortError(unk_err)
        if(err instanceof DataError){
            console_log_fs_err(tr('Unpacking failed', {}), pkg.zip, err)
            return false
        } else {
            throw err
        }
    }
}
