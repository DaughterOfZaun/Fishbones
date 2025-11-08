import { build } from "./build"
import { download, appendPartialDownloadFileExt, repairAria2 } from "./download/download"
import { gcPkg, gitPkg, gsPkg, PkgInfo, repairTorrents, sdkPkg } from "./packages"
import { console_log, fs_copyFile } from "../../ui/remote/remote"
import { console_log_fs_err, cwd, downloads, fs_ensureDir, fs_exists, fs_exists_and_size_eq, fs_moveFile, fs_rmdir } from './fs'
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
import { checkForUpdates, fbPkg, isNewVersionAvailable, repairSelfPackage } from "./upgrade"
import { spawn } from "node:child_process"

const DOTNET_INSTALL_CORRUPT_EXIT_CODES = [ 130, 131, 142, ]

function throwAnyRejection(results: PromiseSettledResult<unknown>[]){
    const reasons = results
        .filter(result => result.status === 'rejected')
        .map(result => result.reason as Error)
    if(reasons.length)
        throw new AggregateError(reasons)
}

export async function repair(opts: Required<AbortOptions>){
    //console.log('Running data check and repair...')

    await fs_ensureDir(downloads, opts)
    
    let results: PromiseSettledResult<unknown>[]
    results = await Promise.allSettled([
        readTrackersTxt(opts).catch((err) => { console_log('Restoring torrent trackers list failed:', Bun.inspect(err)) }),
        repairTorrents(opts).catch((err) => { console_log('Restoring torrent files failed:', Bun.inspect(err)) }),
        repair7z(opts), //.catch((err) => { console_log('Restoring 7z archiver executable failed:', Bun.inspect(err)); throw err }),
        repairAria2(opts), //.catch((err) => { console_log('Restoring Aria2 downloader executable failed:', Bun.inspect(err)); throw err }),
        (async () => {
            if(args.upgrade.enabled)
                return checkForUpdates(opts).catch(err => { console_log('Update check failed:', Bun.inspect(err)) })
        })(),
    ])
    throwAnyRejection(results)
    
    if(isNewVersionAvailable()){
    
        await download(fbPkg, opts)
        await unpack(fbPkg, opts)
        
        const now = new Date()
        const newExe = path.join(downloads, 'Fishbones', 'Fishbones.exe')
        await fs.utimes(newExe, now, now) // Fix file after unpacking.
        
        const currentExe = path.join(cwd, 'Fishbones.exe')
        const oldExe = path.join(downloads, 'Fishbones', 'Fishbones.outdated.exe')
        await fs_moveFile(currentExe, oldExe, opts, true)
        await fs_moveFile(newExe, currentExe, opts, true)

        spawn(currentExe, {
            cwd: process.cwd(),
            stdio: 'inherit',
            detached: true,
        }).unref()

        return { mustExit: true }
    }

    let gsExeIsMissing = !await fs_exists(gsPkg.dll, opts)
    results = await Promise.allSettled([
        
        repairSelfPackage(opts),

        Promise.allSettled([
            repairArchived(sdkPkg, opts),
            (async () => {
                if(args.update.enabled){
                    // The update procedure will install files from Git later.
                } else {
                    await repairArchived(gsPkg, opts)
                }
            })(),
            (async () => {
                if(os.platform() === 'win32' && args.update.enabled){
                    await repairArchived(gitPkg, opts)
                    if(await fs_exists(gitPkg.postInstall, opts, false))
                        await runPostInstall(opts)
                }
            })(),
        ]).then(async (results) => {

            throwAnyRejection(results)

            const updated = await update(gsPkg, opts)

            // Allow packages to contain already built exe.
            gsExeIsMissing = !await fs_exists(gsPkg.dll, opts)
            if(gsExeIsMissing || updated){
                try {
                    await build(gsPkg, opts)
                } catch(err) {
                    if(err instanceof TerminationError){
                        const exitCode = err.cause?.code ?? 0
                        if(DOTNET_INSTALL_CORRUPT_EXIT_CODES.includes(exitCode)){
                            console_log(`SDK installation is probably corrupted (exit code is ${exitCode})`)
                            await repairArchived(sdkPkg, opts, true)
                            await build(gsPkg, opts)
                        } else throw err
                    } else throw err
                }
            }
            await fs_ensureDir(gsPkg.infoDir, opts)
        }),
        repairArchived(gcPkg, opts).then(async () => {
            //await fs_ensureDir(gcPkg.exeDir, opts)
            
            const d3dx9_39_dll = path.join(gcPkg.exeDir, 'd3dx9_39.dll')
            if(!await fs_exists(d3dx9_39_dll, opts, true))
                await fs_copyFile(embedded.d3dx9_39_dll, d3dx9_39_dll, opts)

            //await ensureSymlink()
        }),
    ])
    throwAnyRejection(results)

    //TODO: await fs.cp(gsPkg.gcDir, gcPkg.exeDir, { recursive: true })
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
async function findPackageDir(pkg: PkgInfo, opts: Required<AbortOptions>){
    const { dir: pkgDir, checkUnpackBy: filePath } = pkg
    console.assert(filePath.startsWith(downloads))
    console.assert(pkgDir.startsWith(downloads))

    const potentialRoots = await getPotentialRoots(opts)
    for(const root of potentialRoots){
        if(root != downloads && // not (the way it should be)
            await fs_exists(filePath.replace(downloads, root), opts, false) // GameServer/GameServer.sln
        ) return pkgDir.replace(downloads, root)
        
        if(//root != cwd && root != downloads && // not (danger)
            await fs_exists(filePath.replace(pkgDir, root), opts, false) // GameServer.sln
        ) return root
    }
    return undefined
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
                console_log_fs_err('Moving required file', fileName, err)
                successfullyMovedRequiredFiles = false
            }
        }),
        // eslint-disable-next-line @typescript-eslint/await-thenable
        pkg.topLevelEntriesOptional.map(async (fileName) => {
            try {
                await moveToPkgDir(fileName)
            } catch(err) {
                console_log_fs_err('Moving optional file', fileName, err)
            }
        }),
    ])
    async function moveToPkgDir(fileName: string){
        return fs.rename(
            path.join(foundPkgDir, fileName),
            path.join(pkg.dir, fileName),
        )
    }
    //opts.signal.throwIfAborted()

    // Try to delete the folder if it is empty.
    await fs_rmdir(foundPkgDir, opts, false)
    
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

export async function repairArchived(pkg: PkgInfo, opts: Required<AbortOptions>, ignoreUnpacked = false){

    if(!ignoreUnpacked)
    if(await fs_exists(pkg.checkUnpackBy, opts)){
        const lockfile = appendPartialUnpackFileExt(pkg.zip)
        if(await fs_exists(lockfile, opts, false)){
            console_log('Found temporary unpacker file:', lockfile)
        } else
            return // OK
    } else {
        const foundPkgDir = await findPackageDir(pkg, opts)
        if(foundPkgDir){
            const foundEntries = new Set(await fs.readdir(foundPkgDir))
            const requiredEntres = new Set(pkg.topLevelEntries)
            const optionalEntries = new Set(pkg.topLevelEntriesOptional)
            if(foundEntries.isSupersetOf(requiredEntres)){
                if(foundEntries.isSubsetOf(requiredEntres.union(optionalEntries))){
                    console_log(`Moving "${foundPkgDir}" to "${pkg.dir}"...`)
                    if(await fs_moveFile(foundPkgDir, pkg.dir, opts)){
                        //TODO: await fs_rmdir(path.dirname(foundPkgDir), opts)
                        return // OK
                    }
                } else {
                    console_log(`Moving files from "${foundPkgDir}" to "${pkg.dir}"...`)
                    if(await moveFoundFilesToDir(foundPkgDir, pkg, opts))
                        return // OK
                }
            } else {
                const missingEntries = [...requiredEntres.difference(foundEntries)].join(', ')
                console_log(`Skipping "${foundPkgDir}" because it does not contain some files: ${missingEntries}`)
            }
        }
    }

    //console.log('file %s does not exist', pkg.checkUnpackBy)
    if(await fs_exists_and_size_eq(pkg.zip, pkg.zipSize, opts)){
        const lockfile = appendPartialDownloadFileExt(pkg.zip)
        if(await fs_exists(lockfile, opts, false)){
            console_log('Found temporary downloader file:', lockfile)
        } else if(await tryToUnpack(pkg, opts))
            return // OK
    } else {
        const foundPkgZip = await findPackageZip(pkg, opts)
        if(foundPkgZip){
            console_log(`Moving "${foundPkgZip}" to "${pkg.zip}"`)
            if(await fs_moveFile(foundPkgZip, pkg.zip, opts)
            && await tryToUnpack(pkg, opts))
                return // OK
        }
    }

    if(pkg.zipEmbded){
        await fs_copyFile(pkg.zipEmbded, pkg.zip, opts)
    } else {
        await download(pkg, opts)
    }
    await unpack(pkg, opts)
}

//TODO: Modify `unpack` to return boolean instead of throwning?
async function tryToUnpack(pkg: PkgInfo, opts: Required<AbortOptions>){
    try {
        await unpack(pkg, opts)
        return true // OK
    } catch(unk_err) {
        const err = unwrapAbortError(unk_err)
        if(err instanceof DataError){
            console_log_fs_err('Unpacking', pkg.zip, err)
            return false
        } else {
            throw err
        }
    }
}
