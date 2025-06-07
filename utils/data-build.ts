import { promises as fs } from "node:fs"
import { sdkPkg, type PkgInfoCSProj } from "./data-packages"
import { exec } from 'teen_process'
import { fs_exists } from "./data-shared"

process.env['DOTNET_CLI_TELEMETRY_OPTOUT'] = '1'

export async function build(pkg: PkgInfoCSProj){
    console.log(`Building ${pkg.csProj}...`)

    let txt = await fs.readFile(pkg.csProj, 'utf8')
    txt = txt.replace(/(?<=<TargetFramework>)(?:.|\n)*?(?=<\/TargetFramework>)/g, pkg.netVer)
    await fs.writeFile(pkg.csProj, txt, 'utf8')

    await exec(sdkPkg.exe, ['build', pkg.csProj])

    if(!await fs_exists(pkg.dll))
        throw new Error(`Unable to build ${pkg.dllName}`)
}
