import { sdkPkg, type PkgInfoCSProj } from "./data-packages"
import { logger, createInfiniteBar } from "./data-shared"
import type { AbortOptions } from "@libp2p/interface"
import { fs_exists, fs_readFile, fs_writeFile, type ReadWriteFileOpts } from "./data-fs"
import { logTerminationMsg, registerShutdownHandler, spawn, successfulTermination, type ChildProcess } from "./data-process"

const LOG_PREFIX = 'SDK'

let sdkSubprocess: ChildProcess | undefined
registerShutdownHandler((force) => {
    sdkSubprocess?.kill(force ? 'SIGKILL' : 'SIGTERM')
})

export async function build(pkg: PkgInfoCSProj, opts: Required<AbortOptions>){
    const fs_opts: ReadWriteFileOpts = { ...opts, encoding: 'utf8', rethrow: true }

    if(process.argv.includes('--no-build')){
        console.log(`Pretending to build ${pkg.dllName}...`)
        return
    }
    
    //console_log(`Building ${pkg.dllName}...`)
    const bar = createInfiniteBar('Building', pkg.dllName)
    try{

        let txt = (await fs_readFile(pkg.csProj, fs_opts))!
        txt = txt.replace(/(?<=<TargetFramework>)(?:.|\n)*?(?=<\/TargetFramework>)/g, pkg.netVer)
        await fs_writeFile(pkg.csProj, txt, fs_opts)

        txt = (await fs_readFile(pkg.program, fs_opts))!
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
        await fs_writeFile(pkg.program, txt, fs_opts)

        sdkSubprocess = spawn(sdkPkg.exe, ['build', pkg.csProj], {
            env: { 'DOTNET_CLI_TELEMETRY_OPTOUT': '1' },
            stdio: [ null, 'pipe', 'pipe' ],
            signal: opts.signal,
        })
        sdkSubprocess.addListener('exit', (code, signal) => logTerminationMsg(LOG_PREFIX, 'exited', code, signal))
        
        sdkSubprocess.stdout.setEncoding('utf8').on('data', (chunk) => onData('[STDOUT]', chunk))
        sdkSubprocess.stderr.setEncoding('utf8').on('data', (chunk) => onData('[STDERR]', chunk))
        function onData(src: string, chunk: string){
            logger.log(LOG_PREFIX, src, chunk)
        }
        
        await successfulTermination(LOG_PREFIX, sdkSubprocess, opts)

    } finally {
        bar.stop()
        sdkSubprocess?.kill()
        sdkSubprocess = undefined
    }

    if(!await fs_exists(pkg.dll, opts))
        throw new Error(`Unable to build ${pkg.dllName}`)
}
