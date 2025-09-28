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
    try{

        let txt = (await fs_readFile(pkg.csProj, fs_opts))!
        txt = txt.replace(/(?<=<TargetFramework>)(?:.|\n)*?(?=<\/TargetFramework>)/g, pkg.netVer)
        await fs_writeFile(pkg.csProj, txt, fs_opts)

        txt = (await fs_readFile(pkg.program, fs_opts))!
        /*
        const nl2 = '\n        '
        const nl3 = '\n            '
        const lines = [
            '[DllImport("kernel32.dll")]',
            'private static extern IntPtr GetConsoleWindow();',
        ]
        txt = txt.replace(
            lines.join(nl2),
            lines.map(line => `//${line}`)
            .concat(`private static IntPtr GetConsoleWindow(){ return IntPtr.Zero; }`)
            .join(nl2)
        )
        txt = txt.replace(`${nl3}Banner();\n`, `${nl3}//Banner();\n`)
        */
        txt = txt.replace(/(Console\.SetWindowSize)/, '//$1')
        await fs_writeFile(pkg.program, txt, fs_opts)

        sdkSubprocess = spawn(sdkPkg.exe, ['build', pkg.csProj], {
            env: Object.assign(process.env, { 'DOTNET_CLI_TELEMETRY_OPTOUT': '1' }),
            //env: { 'DOTNET_CLI_TELEMETRY_OPTOUT': '1' },
            stdio: [ null, 'pipe', 'pipe' ],
            logPrefix: LOG_PREFIX,
            //signal: opts.signal,
            cwd: pkg.dir,
            log: true,
        })
        
        await successfulTermination(LOG_PREFIX, sdkSubprocess, opts)

    } finally {
        bar.stop()
        killIfActive(sdkSubprocess)
        sdkSubprocess = undefined
    }

    if(!await fs_exists(pkg.dll, opts))
        throw new Error(`Unable to build ${pkg.dllName}`)
}
