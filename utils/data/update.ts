import type { AbortOptions } from "@libp2p/interface"
import { spawn, successfulTermination, TerminationError } from "../process/process"
import { gitPkg, type PkgInfoGit } from "./packages"
import { console_log, createBar } from "../../ui/remote/remote"
import { fs_ensureDir, fs_exists } from "./fs"
import { tr } from "../translation"
import { args } from "../args"
import path from "node:path"
import os from "node:os"

export async function runPostInstall(opts: Required<AbortOptions>){
    const bar = createBar(tr('Installing'), gitPkg.postInstallRelative)
    try {
        const logPrefix = "GIT POST-INSTALL CMD"
        const proc = spawn(
            //gitPkg.postInstall, [],
            'git-bash.exe', [ '--no-needs-console', '--hide', '--no-cd', `--command=${gitPkg.postInstallName}` ],
            {
                log: true, logPrefix,
                cwd: gitPkg.dir,
                //detached: true,
                //shell: true,
            }
        )
        await successfulTermination(logPrefix, proc, opts, [ 1 ])
    } finally {
        bar.stop()
    }
}

export async function update(pkg: PkgInfoGit, opts: Required<AbortOptions>){

    args.mr.enabled = !!args.mr.value
    if(!args.update.enabled && !args.mr.enabled){
        //console.log(`Pretending to update ${pkg.dirName}...`)
        return false
    }

    const bar = createBar(tr('Updating'), pkg.name)
    let updated = false
    try {
        await fs_ensureDir(pkg.dir, opts)
        await git(['config', /*'--global',*/ 'core.longpaths', 'true'], pkg, opts)
        if(!await fs_exists(path.join(pkg.dir, '.git'), opts)){
            await git([ 'init' ], pkg, opts)
            
            await git([ 'remote', 'add', pkg.gitRemoteName, pkg.gitOriginURL ], pkg, opts)
            await git([ 'fetch', pkg.gitRemoteName ], pkg, opts)
            await git([ 'checkout', '-b', `${pkg.gitRemoteName}-${pkg.gitBranchName}`, `${pkg.gitRemoteName}/${pkg.gitBranchName}`, '--force' ], pkg, opts)
            
            await getHeadCommitHash(pkg, opts)
            updated = true
        } else {
            const prevHash = await getHeadCommitHash(pkg, opts)
            if(args.mr.enabled){
                const newBranchName = `mr-${pkg.gitRemoteName}-${args.mr.value}`
                console_log(tr(`Switching the branch to {newBranchName}...`, { newBranchName }))

                await git([ 'remote', 'add', pkg.gitRemoteName, pkg.gitOriginURL ], pkg, opts, true)
                await git([ 'fetch', pkg.gitRemoteName, `merge-requests/${args.mr.value}/head:${newBranchName}`], pkg, opts)
                await git([ 'checkout',  newBranchName ], pkg, opts)
            } else {
                const newBranchName = `${pkg.gitRemoteName}-${pkg.gitBranchName}`
                console_log(tr(`Switching the branch to {newBranchName}...`, { newBranchName }))

                await git([ 'remote', 'add', pkg.gitRemoteName, pkg.gitOriginURL ], pkg, opts, true)
                await git([ 'fetch', pkg.gitRemoteName ], pkg, opts)
                await git([ 'checkout', '-b', newBranchName, `${pkg.gitRemoteName}/${pkg.gitBranchName}` ], pkg, opts, true)
                await git([ 'checkout', newBranchName], pkg, opts)
                await git([ 'merge', `${pkg.gitRemoteName}/${pkg.gitBranchName}` ], pkg, opts)
            }
            const currHash = await getHeadCommitHash(pkg, opts)
            updated = prevHash != currHash
        }
    } catch(err){
        console_log(tr('The update failed, see the log for details.', {}))
        if(err instanceof TerminationError){ /* Ignore */ }
        else throw err
    } finally {
        bar?.stop()
    }
    return updated
}

export async function getHeadCommitHash(pkg: PkgInfoGit, opts: Required<AbortOptions>) {
    let { stdout } = await git([ 'rev-parse', 'HEAD' ], pkg, opts)
    stdout = stdout.trim()
    if(/^\w{40}$/.test(stdout)){
        pkg.gitRevision = stdout
        return stdout
    }
    //else throw new Error('Failed to get the head commit hash')
}

const logPrefix = "GIT"
const gitExe = os.platform() === 'win32' ? gitPkg.exe : 'git'

async function git(args: string[], pkg: PkgInfoGit, opts: Required<AbortOptions>, quiet = false){
    const { signal } = opts
    const proc = spawn(gitExe, args, {
        log: true, logPrefix,
        cwd: pkg.dir,
        signal,
    })
    if(!quiet)
    proc.stderr.setEncoding('utf8').on('data', (chunk: string) => {
        //if(chunk.includes('error:') && chunk.includes('files would be overwritten by merge'));
        for(const match of chunk.matchAll(/(error|fatal): (.*)/g))
            console_log('git', match[0])
    })
    let stdout = '', stderr = ''
    proc.stdout.setEncoding('utf8').on('data', (chunk) => stdout += chunk)
    proc.stderr.setEncoding('utf8').on('data', (chunk) => stderr += chunk)
    try {
        await successfulTermination(logPrefix, proc, opts)
    } catch(err) {
        if(!quiet) throw err
    }
    return { stdout, stderr }
}
