import { promises as fs } from "node:fs"
import { sdkPkg, type PkgInfoCSProj } from "./data-packages"
import { SubProcess } from 'teen_process'
import { fs_exists, logger, console_log } from "./data-shared"

process.env['DOTNET_CLI_TELEMETRY_OPTOUT'] = '1'

let sdkSubprocess: undefined | SubProcess
export async function build(pkg: PkgInfoCSProj){
    console_log(`Building ${pkg.dllName}...`)

    let txt = await fs.readFile(pkg.csProj, 'utf8')
    txt = txt.replace(/(?<=<TargetFramework>)(?:.|\n)*?(?=<\/TargetFramework>)/g, pkg.netVer)
    await fs.writeFile(pkg.csProj, txt, 'utf8')

    txt = await fs.readFile(pkg.program, 'utf8')
    txt = txt.replace(`
        [DllImport("kernel32.dll")]
        private static extern IntPtr GetConsoleWindow();
    `.trim(), 'private static IntPtr GetConsoleWindow(){ return IntPtr.Zero; } //HACK:')
    await fs.writeFile(pkg.program, txt)

    sdkSubprocess = new SubProcess(sdkPkg.exe, ['build', pkg.csProj])
    sdkSubprocess.on('stream-line', line => logger.log('SDK', line))
    await sdkSubprocess.start()
    await sdkSubprocess.join()

    if(!await fs_exists(pkg.dll))
        throw new Error(`Unable to build ${pkg.dllName}`)
}
