import { build } from "./build"
import { download, appendPartialDownloadFileExt, repairAria2, seed } from "./download/download"
import { gcPkg, gc420Pkg, gitPkg, gsPkg, gs420Pkg, modPck1, type PkgInfo, repairTorrents, sdkPkg, type PkgInfoCSProj } from "./packages"
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
//import { ensureSymlink } from "./data-client"
import { args } from "../args"
import { checkForUpdates, fbPkg, isNewVersionAvailable, prev_fbPkg, repairSelfPackage } from "./upgrade"
import { spawn } from "node:child_process"
import { tr } from "../translation"
import { DeferredView, render } from "../../ui/remote/view"
import { button, form, label } from "../../ui/remote/types"
import { VERSION } from "../constants-build"
import type { StatsFs } from "node:fs"
import { clients_push, combinations_merge, combinations_push, KnownClients, KnownServers, servers_push } from "./constants/client-server-combinations"
import { ClientDataInfoV126 } from "./packages/game-client"
import { BrokenWingsDataInfo } from "./packages/game-server"
import { ClientDataInfoV420 } from "./packages/game-client-420"
import { ChronobreakDataInfo } from "./packages/game-server-420"
import { champions } from "./constants/champions"

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
async function repairImpl(view: DeferredView<void>, opts: Required<AbortOptions>){
    //console.log('Running data check and repair...')

    await fs_ensureDir(downloads, opts)

    if(!args.installS1Client.value)
        args.installModPack.set(false) //HACK?

    while(args.spaceCheck.value){

        const downloadsRoot = path.parse(downloads).root
        const gcInstallRoot = path.parse(gcPkg.dir).root
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
            fs_statfs(gcPkg.dir, opts)
            //: Promise.resolve(undefined)
            ,
            Promise.all([
                
                checkFileSize(path.join(downloads, path.basename(embedded.s7zExe)), 3759224, opts),
                checkFileSize(path.join(downloads, path.basename(embedded.ariaExe)), 9926088, opts),
                checkFileSize(path.join(downloads, path.basename(embedded.bunExe)), 103547344, opts),
                
                checkFileSize(path.join(downloads, 'aria2.dht6.dat'), 9240, opts),
                checkFileSize(path.join(downloads, 'aria2.dht.dat'), 10080, opts),
                
                ...(
                    (args.installS1Server.value) ? (
                        (args.update.value) ? [
                            checkDirSize(gsPkg.checkUnpackBy, gsPkg.zip, gsPkg.size, opts),
                        ] : [
                            checkDirSize(gsPkg.checkUnpackBy, gsPkg.zip, gsPkg.size, opts),
                            checkFileSize(gsPkg.zip, gsPkg.zipSize, opts),
                            checkFileSize(gsPkg.zipTorrent, 14564, opts),
                        ]
                    ) : []
                ),
                ...(
                    (args.installS4Server.value) ? [
                        checkDirSize(gs420Pkg.checkUnpackBy, gs420Pkg.zip, gs420Pkg.size, opts),
                        checkFileSize(gs420Pkg.zip, gs420Pkg.zipSize, opts),
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
                
                //checkDirSize(gcPkg.checkUnpackBy, gcPkg.zip, gcPkg.size, opts),
                checkFileSize(gcPkg.zip, gcPkg.zipSize, opts),
                checkFileSize(gcPkg.zipTorrent, 90417, opts),

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
                    checkDirSize(gcPkg.checkUnpackBy, gcPkg.zip, gcPkg.size, opts),
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

        if(msg){
            const view = render('DiskSpaceWarning', form({
                'Retry': button(() => view.resolve()),
                'Message': label(msg),
            }), opts, [
                {
                    //HACK:
                    regex: /.\/DiskSpaceWarning\/Retry:pressed/,
                    listener: () => view.resolve(),
                }
            ])
            await view.promise
            continue
        }
        break
    }

    let results: PromiseSettledResult<unknown>[]
    results = await Promise.allSettled([
        readTrackersTxt(opts).catch((err) => { console_log(tr('Restoring torrent trackers list failed:', {}), Bun.inspect(err)) }),
        repairTorrents(opts).catch((err) => { console_log(tr('Restoring torrent files failed:', {}), Bun.inspect(err)) }),
        repair7z(opts), //.catch((err) => { console_log(tr('Restoring 7z archiver executable failed:', {}), Bun.inspect(err)); throw err }),
        repairAria2(opts), //.catch((err) => { console_log(tr('Restoring Aria2 downloader executable failed:', {}), Bun.inspect(err)); throw err }),
        (async () => {
            if(args.upgrade.value)
                return checkForUpdates(opts).catch(err => { console_log(tr('Update check failed:', {}), Bun.inspect(err)) })
        })(),
    ])
    throwAnyRejection(results)

    if(prev_fbPkg && isNewVersionAvailable()){

        // A hack to speed up download.
        if(await fs_exists(prev_fbPkg.zip, opts) && !await fs_exists(fbPkg.zip, opts)){
            const bar = createBar(tr('Copying'), prev_fbPkg.zip)
            await fs_copyFile(prev_fbPkg.zip, fbPkg.zip, opts)
            await fs_truncate(fbPkg.zip, fbPkg.zipSize, opts)
            bar.stop()
        }
        await download(fbPkg, opts)
        await unpack(fbPkg, opts)

        const now = new Date()
        // Fix file after unpacking.
        await fs.utimes(fbPkg.exe, now, now)
        await fs_chmod(fbPkg.exe, rwx_rx_rx, opts)

        console.assert(fbPkg.dir === prev_fbPkg.dir)
        const oldExe = path.join(prev_fbPkg.dir, `Fishbones.${prev_fbPkg.version}.exe`)
        await fs_moveFile(currentExe, oldExe, opts, true)
        await fs_moveFile(fbPkg.exe, currentExe, opts, true)

        spawn(currentExe, {
            //cwd: process.cwd(),
            stdio: 'ignore',
            detached: true,
        }).unref()

        return { mustExit: true }
    }

    let updated = false
    let gcExeIsMissing = !await fs_exists(gcPkg.exe, opts)
    let gsExeIsMissing = !await fs_exists(gsPkg.dll, opts)
    let gc420ExeIsMissing = !await fs_exists(gc420Pkg.exe, opts)
    let gs420ExeIsMissing = !await fs_exists(gs420Pkg.dll, opts)
    let modFileIsMissing = !await fs_exists(modPck1.lockFile, opts, false)
    repairArchived_sdkPkg_opts ??=
        repairArchived(sdkPkg, opts)
            .then(() => { repairArchived_sdkPkg_opts = null })
    results = await Promise.allSettled([

        !(args.torrentDownload.value) ? Promise.resolve() :
        repairSelfPackage(opts).catch(err => {
            console_log(tr(`Restoring launcher package failed:`), Bun.inspect(err))
        }),

        !(args.installS1Server.value) ? Promise.resolve() :
        Promise.allSettled([
            repairArchived_sdkPkg_opts,
            (async () => {
                if(args.update.value || args.mrNumber.value !== undefined){
                    try {
                        if(os.platform() === 'win32'){
                            await repairArchived(gitPkg, opts)
                            if(await fs_exists(gitPkg.postInstall, opts, false))
                                await runPostInstall(opts)
                        }
                        const existingEntries = await fs_readdir(gsPkg.dir, opts)
                        if(existingEntries.length > 0 && !existingEntries.includes('.git')){
                            await fs_moveFile(gsPkg.dir, `${gsPkg.dir}-backup-${Date.now().toString(16)}`, opts)
                        }
                        updated = await update(gsPkg, opts)
                        return // OK
                    } catch(err) {
                        console_log(tr('Updating game server package failed:', {}), Bun.inspect(err))
                    }
                }
                await repairArchived(gsPkg, opts)
            })(),
        ]).then(async (results) => {
            throwAnyRejection(results)

            // Allow packages to contain already built exe.
            //gsExeIsMissing = !await fs_exists(gsPkg.dll, opts)

            if(gsExeIsMissing || updated){
                await tryBuild(gsPkg, opts)
                gsExeIsMissing = false
            }
            await fs_ensureDir(gsPkg.infoDir, opts)
        }),

        !(args.installS4Server.value) ? Promise.resolve() :
        Promise.allSettled([
            repairArchived_sdkPkg_opts,
            repairArchived(gs420Pkg, opts),
        ]).then(async (results) => {
            throwAnyRejection(results)
            if(gs420ExeIsMissing){
                await tryBuild(gs420Pkg, opts)
                gs420ExeIsMissing = false
            }
            await fs_ensureDir(gs420Pkg.infoDir, opts)

            const levelsDir = path.join(gs420Pkg.dir, ...'Content/GameClient/LEVELS'.split('/'))
            await fs_moveFile(path.join(levelsDir, 'map11'), path.join(levelsDir, 'Map11'), opts, false)
        }),

        !(args.installS1Client.value) ? Promise.resolve() :
        Promise.allSettled([
            
            repairArchived(gcPkg, opts).then(async () => {

                gcExeIsMissing = false

                Promise.allSettled([
                    (async () => {
                        //await fs_ensureDir(gcPkg.exeDir, opts)
                        const d3dx9_39_dll_name = 'd3dx9_39.dll'
                        const d3dx9_39_dll_src = path.join(downloads, d3dx9_39_dll_name)
                        const d3dx9_39_dll_dst = path.join(gcPkg.exeDir, d3dx9_39_dll_name)
                        if(!await fs_exists(d3dx9_39_dll_dst, opts, true)){
                            await extractFile(embedded.d3dx9_39_dll, d3dx9_39_dll_src, opts)
                            await fs_copyFile(d3dx9_39_dll_src, d3dx9_39_dll_dst, opts) //HACK: To bypass "Access denied" error.
                        }
                        //await ensureSymlink()
                    })(),
                    (async () => {
                        const fontconfig_path = path.join(gcPkg.exeDir, 'DATA', 'Menu', 'fontconfig_en_US.txt')
                        let fontconfig = await fs_readFile(fontconfig_path, { ...opts, encoding: 'utf8' })
                        if(!fontconfig) return
                            fontconfig = fontconfig.trim() + '\n'
                        let fontconfig_changed = false
                        const gsInfo = new BrokenWingsDataInfo(gsPkg.dir)
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
                    await fs_overwrite(modPck1.dir, gcPkg.dir, opts)
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

    if(!gsExeIsMissing && !gcExeIsMissing){
        const client = clients_push(gcPkg, new ClientDataInfoV126(gcPkg.dir), KnownClients.v126, 'v1.0.0.126 (Season 1)')
        const server = servers_push(gsPkg, new BrokenWingsDataInfo(gsPkg.dir), KnownServers.BrokenWings, tr('BrokenWings (Season 1)'))
        combinations_push(client, server)
        if(!modFileIsMissing)
            Object.assign(client.maps, modPck1.maps)
    }
    if(!gs420ExeIsMissing && !gc420ExeIsMissing){
        const client = clients_push(gc420Pkg, new ClientDataInfoV420(gc420Pkg.dir), KnownClients.v420, 'v4.20 (Season 4)')
        const server = servers_push(gs420Pkg, new ChronobreakDataInfo(gs420Pkg.dir), KnownServers.ChronoBreak, tr('Chronobreak (Season 1)'))
        combinations_push(client, server)
    }
    combinations_merge()

    //TODO: await fs.cp(gsPkg.gcDir, gcPkg.exeDir, { recursive: true })

    if(args.torrentDownload.value){
        //TODO: Seed all downloaded packages.
        const packages = [ gcPkg, gitPkg, modPck1, sdkPkg, fbPkg ]
        void Promise.allSettled(
            packages.map(async pkg => seed(pkg, opts))
        ).then((results) => {
            //throwAnyRejection(results)
            for(let i = 0; i < results.length; i++){
                const result = results[i]!
                const pkg = packages[i]!
                if(result.status === 'rejected'){
                    const err = result.reason as Error
                    console_log(tr(`Failed to seed {pkg_zipName}:`, { pkg_zipName: pkg.zipName }), Bun.inspect(err))
                }
            }
        })
    }
}

async function tryBuild(pkg: PkgInfoCSProj, opts: Required<AbortOptions>){
    try {
        await build(pkg, opts)
    } catch(err) {
        let tryToRepairSDK = true
        if(err instanceof Error){
            const exception = err as ErrnoException
            if(exception.code == 'ENOENT'){ //TODO: Investigate.
                const desc1 = tr('SDK installation is probably corrupted')
                const desc2 = tr('File not found')
                console_log(`${desc1}. ${desc2}:\n`, exception.path ?? '')
                tryToRepairSDK = true
            }
        }
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
            repairArchived_sdkPkg_opts ??=
                repairArchived(sdkPkg, { ...opts, ignoreUnpacked: true })
                    .then(() => { repairArchived_sdkPkg_opts = null })
            await repairArchived_sdkPkg_opts
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
        // eslint-disable-next-line @typescript-eslint/await-thenable
        pkg.topLevelEntries.map(async (fileName) => {
            try {
                await moveToPkgDir(fileName)
            } catch(err) {
                console_log_fs_err(tr('Moving required file failed', {}), fileName, err)
                successfullyMovedRequiredFiles = false
            }
        }),
        // eslint-disable-next-line @typescript-eslint/await-thenable
        pkg.topLevelEntriesOptional.map(async (fileName) => {
            try {
                await moveToPkgDir(fileName)
            } catch(err) {
                console_log_fs_err(tr('Moving optional file failed', {}), fileName, err)
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
