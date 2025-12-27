import { sdkPkg, type PkgInfoCSProj } from "./packages"
import { createBar } from "../../ui/remote/remote"
import type { AbortOptions } from "@libp2p/interface"
import { fs_exists, fs_readdir, fs_readFile, fs_removeFile, fs_writeFile, type ReadWriteFileOpts } from "./fs"
import { killIfActive, spawn, successfulTermination, type ChildProcess } from "../process/process"
import { args } from "../args"
import path from 'node:path'

const LOG_PREFIX = 'SDK'

let sdkSubprocess: ChildProcess | undefined

const nugetConfigContent = `
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" protocolVersion="3" />
  </packageSources>
</configuration>
`.trimStart()

export async function build(pkg: PkgInfoCSProj, opts: Required<AbortOptions>){
    const fs_opts: ReadWriteFileOpts = { ...opts, encoding: 'utf8', rethrow: true }

    if(!args.build.enabled){
        console.log(`Pretending to build ${pkg.dllName}...`)
        return
    }
    
    //console_log(`Building ${pkg.dllName}...`)
    const bar = createBar('Building', pkg.dllName)
    
    let csproj: string | undefined
    let csprojWasPatched = false
    let program: string | undefined
    let programWasPatched = false
    let nugetConfigWasPlaced = false
    const filesToRemove: string[] = []
    
    const nugetConfig = path.join(pkg.dir, 'NuGet.Config')

    try {
        
        program = (await fs_readFile(pkg.program, fs_opts))!
        const patchedProgram = program.replace(/(?<!\/\/)(Console\.SetWindowSize)/, '//$1')
        if(patchedProgram != program){
            await fs_writeFile(pkg.program, patchedProgram, fs_opts)
            programWasPatched = true
        }

        csproj = (await fs_readFile(pkg.csProj, fs_opts))!
        const patchedCSProj = csproj.replace(
            /(<PackageReference Include="MoonSharp\.Debugger" Version="2\.0\.0" \/>)/,
            '<!-- $1 -->'
        )
        if(patchedCSProj != csproj){
            await fs_writeFile(pkg.csProj, patchedCSProj, fs_opts)
            csprojWasPatched = true
        }

        if(!(await fs_exists(nugetConfig, fs_opts, false))){
            await fs_writeFile(nugetConfig, nugetConfigContent, fs_opts)
            nugetConfigWasPlaced = true
        }

        const maps = path.join(pkg.dir, 'Content', 'AvCsharp-Scripts', 'Maps')
        const map1bts = path.join(maps, 'Map1', 'BehaviourTrees')
        const map2bts = path.join(maps, 'Map2', 'BehaviourTrees')
        await Promise.all(
            (await fs_readdir(map1bts, opts)).map(async (fileName) => {
                const srcBT = path.join(map1bts, fileName)
                const dstBT = path.join(map2bts, fileName)
                if(!(await fs_exists(dstBT, opts, false))){
                    let content = await fs_readFile(srcBT, { ...opts, encoding: 'utf8' })
                    if(content){
                        content = content.replace(
                            'namespace BehaviourTrees.Map1;',
                            'namespace BehaviourTrees.Map2;'
                        )
                        await fs_writeFile(dstBT, content, { ...opts, encoding: 'utf8' })
                        filesToRemove.push(dstBT)
                    }
                }
            })
        )

        sdkSubprocess = spawn(sdkPkg.exe, [
            'build',
            ...'--nologo -v q /p:WarningLevel=0 /clp:ErrorsOnly'.split(' '),
            '.' /*pkg.csProj*/
        ], {
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

        if(csproj && csprojWasPatched)
            await fs_writeFile(pkg.csProj, csproj, fs_opts)

        if(nugetConfigWasPlaced)
            await fs_removeFile(nugetConfig, fs_opts)

        await Promise.all(
            filesToRemove.map(async filePath => {
                return fs_removeFile(filePath, opts)
            })
        )
    }

    if(!await fs_exists(pkg.dll, opts))
        throw new Error(`Unable to build ${pkg.dllName}`)
}
