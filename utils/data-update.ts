import type { AbortOptions } from "@libp2p/interface"
import { spawn, successfulTermination } from "./data-process"
import { gitPkg, type PkgInfoGit } from "./data-packages"
import { console_log, createBar } from "../ui/remote"
import { logger } from "./data-shared"
import { fs_exists } from "./data-fs"
import { args } from "./args"
import path from "node:path"
import os from "node:os"

export async function runPostInstall(opts: Required<AbortOptions>){
    const bar = createBar('Installing', gitPkg.postInstallRelative)
    try {
        const logPrefix = "GIT POST-INSTALL CMD"
        const proc = spawn(
            'cmd.exe', [ '/c', gitPkg.postInstall ], {
                log: true, logPrefix,
                cwd: gitPkg.dir,
                detached: true,
            })
        await successfulTermination(logPrefix, proc, opts)
    } finally {
        bar.stop()
    }
}

export async function update(pkg: PkgInfoGit, opts: Required<AbortOptions>){

    if(!args.update.enabled){
        //console.log(`Pretending to update ${pkg.dirName}...`)
        return
    }

    const bar = createBar('Updating', pkg.dirName)
    let updated = false
    try {
        if(!await fs_exists(path.join(pkg.dir, '.git'), opts)){
            await git([ 'init' ], pkg, opts)
            await git([ 'remote', 'add', 'origin', pkg.gitOrigin ], pkg, opts)
            await git([ 'fetch', 'origin' ], pkg, opts)
            await git([ 'checkout', pkg.gitBranch ], pkg, opts)
            updated = true
        } else {
            const prevHash = getHeadCommitHash(pkg, opts)
            await git([ 'pull' ], pkg, opts)
            const currHash = getHeadCommitHash(pkg, opts)
            updated = prevHash != currHash
        }
    } finally {
        bar?.stop()
    }
    return updated
}

export async function getHeadCommitHash(pkg: PkgInfoGit, opts: Required<AbortOptions>) {
    let { stdout } = await git([ 'rev-parse', 'HEAD' ], pkg, opts)
    stdout = stdout.trim()
    if(/^\w{40}$/.test(stdout)) return stdout
    //else throw new Error('Failed to get the head commit hash')
}

const logPrefix = "GIT"
const gitExe = os.platform() === 'win32' ? gitPkg.exe : 'git'

async function git(args: string[], pkg: PkgInfoGit, opts: Required<AbortOptions>){
    const { signal } = opts
    logger.log('exec', gitExe, ...args)
    const proc = spawn(gitExe, args, {
        log: true, logPrefix,
        cwd: pkg.dir,
        signal,
    })
    proc.stderr.setEncoding('utf8').on('data', (chunk: string) => {
        //if(chunk.includes('error:') && chunk.includes('files would be overwritten by merge'));
        for(const match of chunk.matchAll(/(error|fatal): (.*)/g))
            console_log('git', match[0])
    })
    let stdout = '', stderr = ''
    proc.stdout.setEncoding('utf8').on('data', (chunk) => stdout += chunk)
    proc.stderr.setEncoding('utf8').on('data', (chunk) => stderr += chunk)
    await successfulTermination(logPrefix, proc, opts)
    return { stdout, stderr }
}
