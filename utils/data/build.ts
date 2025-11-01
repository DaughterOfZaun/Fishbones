import { sdkPkg, type PkgInfoCSProj } from "./data-packages"
import { createBar } from "../ui/remote"
import type { AbortOptions } from "@libp2p/interface"
import { fs_exists, fs_readFile, fs_writeFile, type ReadWriteFileOpts } from "./data-fs"
import { killIfActive, spawn, successfulTermination, type ChildProcess } from "./data-process"
import { args } from "./args"

const LOG_PREFIX = 'SDK'

let sdkSubprocess: ChildProcess | undefined

export async function build(pkg: PkgInfoCSProj, opts: Required<AbortOptions>){
    const fs_opts: ReadWriteFileOpts = { ...opts, encoding: 'utf8', rethrow: true }

    if(!args.build.enabled){
        console.log(`Pretending to build ${pkg.dllName}...`)
        return
    }
    
    //console_log(`Building ${pkg.dllName}...`)
    const bar = createBar('Building', pkg.dllName)
    let program, programWasPatched = false
    try {
        
        program = (await fs_readFile(pkg.program, fs_opts))!
        const patched = program.replace(/(?<!\/\/)(Console\.SetWindowSize)/, '//$1')
        if(patched != program){
            await fs_writeFile(pkg.program, patched, fs_opts)
            programWasPatched = true
        }

        sdkSubprocess = spawn(sdkPkg.exe, ['build', '.' /*pkg.csProj*/], {
            env: Object.assign(process.env, { 'DOTNET_CLI_TELEMETRY_OPTOUT': '1' }),
            //env: { 'DOTNET_CLI_TELEMETRY_OPTOUT': '1' },
            stdio: [ null, 'pipe', 'pipe' ],
            logPrefix: LOG_PREFIX,
            //signal: opts.signal,
            cwd: pkg.csProjDir,
            log: true,
        })
        
        await successfulTermination(LOG_PREFIX, sdkSubprocess, opts)

    } finally {
        bar.stop()
        killIfActive(sdkSubprocess)
        sdkSubprocess = undefined
        
        // Revert patch.
        if(program && programWasPatched)
            await fs_writeFile(pkg.program, program, fs_opts)
    }

    if(!await fs_exists(pkg.dll, opts))
        throw new Error(`Unable to build ${pkg.dllName}`)
}
