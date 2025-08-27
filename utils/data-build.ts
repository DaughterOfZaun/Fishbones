import { promises as fs } from "node:fs"
import { sdkPkg, type PkgInfoCSProj } from "./data-packages"
import { SubProcess } from 'teen_process'
import { fs_exists, logger, createInfiniteBar, registerShutdownHandler } from "./data-shared"

let sdkSubprocess: undefined | SubProcess
registerShutdownHandler(async (force) => {
    await sdkSubprocess?.stop(force ? 'SIGKILL' : 'SIGTERM')
})

export async function build(pkg: PkgInfoCSProj){
    
    if(process.argv.includes('--no-build')){
        console.log(`Pretending to build ${pkg.dllName}...`)
        return
    }
    
    //console_log(`Building ${pkg.dllName}...`)
    const bar = createInfiniteBar('Building', pkg.dllName)
    try{
    
    let txt = await fs.readFile(pkg.csProj, 'utf8')
    txt = txt.replace(/(?<=<TargetFramework>)(?:.|\n)*?(?=<\/TargetFramework>)/g, pkg.netVer)
    await fs.writeFile(pkg.csProj, txt, 'utf8')

    txt = await fs.readFile(pkg.program, 'utf8')
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
    await fs.writeFile(pkg.program, txt)

    const env = { 'DOTNET_CLI_TELEMETRY_OPTOUT': '1' }
    sdkSubprocess = new SubProcess(sdkPkg.exe, ['build', pkg.csProj], { env })
    sdkSubprocess.on('stream-line', line => logger.log('SDK', line))
    await sdkSubprocess.start()
    await sdkSubprocess.join()

    } finally {
        bar.stop()
    }

    if(!await fs_exists(pkg.dll))
        throw new Error(`Unable to build ${pkg.dllName}`)
}
