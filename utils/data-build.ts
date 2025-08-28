import { sdkPkg, type PkgInfoCSProj } from "./data-packages"
import { SubProcess } from 'teen_process'
import { logger, createInfiniteBar, registerShutdownHandler } from "./data-shared"
import type { AbortOptions } from "@libp2p/interface"
import { fs_exists, fs_readFile, fs_writeFile, type ReadWriteFileOpts } from "./data-fs"

let sdkSubprocess: undefined | SubProcess
registerShutdownHandler(async (force) => {
    if(sdkSubprocess?.isRunning)
        await sdkSubprocess.stop(force ? 'SIGKILL' : 'SIGTERM')
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

        const env = { 'DOTNET_CLI_TELEMETRY_OPTOUT': '1' }
        sdkSubprocess = new SubProcess(sdkPkg.exe, ['build', pkg.csProj], { env })
        sdkSubprocess.on('stream-line', line => logger.log('SDK', line))
        
        const abort = () => sdkSubprocess!.stop()
        try {
            opts.signal.addEventListener('abort', abort)
            
            await sdkSubprocess.start()
            opts.signal.throwIfAborted()

            await sdkSubprocess.join()
            opts.signal.throwIfAborted()
        } finally {
            opts.signal.removeEventListener('abort', abort)
        }
    } finally {
        bar.stop()
    }

    if(!await fs_exists(pkg.dll, opts))
        throw new Error(`Unable to build ${pkg.dllName}`)
}
