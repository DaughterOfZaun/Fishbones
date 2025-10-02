import type { AbortOptions } from "@libp2p/interface"
import { spawn, successfulTermination } from "./data-process"
import { gitPkg, type PkgInfoGit } from "./data-packages"
import { console_log, createBar } from "../ui/remote"
import { fs_exists } from "./data-fs"
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
    const bar = createBar('Updating', pkg.dirName)
    try {
        if(!await fs_exists(path.join(pkg.dir, '.git'), opts)){
            await git([
                `clone`,
                `--revision=${pkg.gitRevision}`,
                `--depth=${1}`,
                `--bare`,
                pkg.gitOrigin,
                `.git`,
            ], pkg, opts)
            await git([ 'config', '--local', '--bool', 'core.bare', 'false' ], pkg, opts)
        }
        await git([ 'pull' ], pkg, opts)
    } finally {
        bar?.stop()
    }
}

const logPrefix = "GIT"
const gitExe = os.platform() === 'win32' ? gitPkg.exe : 'git'

async function git(args: string[], pkg: PkgInfoGit, opts: Required<AbortOptions>){
    const proc = spawn(gitExe, args, {
        log: true, logPrefix,
        cwd: pkg.dir,
    })
    proc.stderr.setEncoding('utf8').on('data', (chunk: string) => {
        //if(chunk.includes('error:') && chunk.includes('files would be overwritten by merge'));
        for(const match of chunk.matchAll(/error: (.*)/g))
            console_log('git', match[0])
    })
    return successfulTermination(logPrefix, proc, opts)
}
