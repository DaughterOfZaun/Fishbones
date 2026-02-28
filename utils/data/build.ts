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

const filesToRevert = new Map<string, string>()
const filesToRemove = new Set<string>()

async function patch(filePath: string, patcher: (fileContent: string) => string, fs_opts: ReadWriteFileOpts){
    const fileContent = await fs_readFile(filePath, fs_opts)
    if(fileContent){
        const patchedContent = patcher(fileContent)
        if(patchedContent != fileContent){
            if(await fs_writeFile(filePath, patchedContent, fs_opts))
                filesToRevert.set(filePath, fileContent)
        }
    }
}

async function create(filePath: string, fileContent: string, fs_opts: ReadWriteFileOpts){
    if(!(await fs_exists(filePath, fs_opts, false))){
        if(await fs_writeFile(filePath, fileContent, fs_opts))
            filesToRemove.add(filePath)
    }
}

async function copy(filePathFrom: string, filePathTo: string, patcher: (fileContent: string) => string, opts: Required<AbortOptions>){
    if(!(await fs_exists(filePathTo, opts, false))){
        let fileContent = await fs_readFile(filePathFrom, { ...opts, encoding: 'utf8' })
        if(fileContent){
            fileContent = patcher(fileContent)
            if(await fs_writeFile(filePathTo, fileContent, { ...opts, encoding: 'utf8' }))
                filesToRemove.add(filePathTo)
        }
    }
}

async function revert(fs_opts: ReadWriteFileOpts) {
    return Promise.all([
        ...filesToRevert.entries().map(async ([filePath, fileContent]) => {
            if(await fs_writeFile(filePath, fileContent, fs_opts))
                filesToRevert.delete(filePath)
        }),
        ...filesToRemove.values().map(async (filePath) => {
            if(await fs_removeFile(filePath, fs_opts))
                filesToRemove.delete(filePath)
        })
    ])
}

export async function build(pkg: PkgInfoCSProj, opts: Required<AbortOptions>){

    const fs_opts: ReadWriteFileOpts = { ...opts, encoding: 'utf8', rethrow: false }

    if(!args.build.enabled){
        console.log(`Pretending to build ${pkg.dllName}...`)
        return
    }
    
    //console_log(`Building ${pkg.dllName}...`)
    const bar = createBar('Building', pkg.dllName)
    
    const nugetConfig = path.join(pkg.dir, 'NuGet.Config')

    try {

        await Promise.all([

            patch(pkg.program, program => program.replace(/(?<!\/\/)(Console\.SetWindowSize)/, '//$1'), fs_opts),

            patch(pkg.csProj, csproj => csproj.replace(
                /(<PackageReference Include="MoonSharp\.Debugger" Version="2\.0\.0" \/>)/,
                '<!-- $1 -->'
            ), fs_opts),

            create(nugetConfig, nugetConfigContent, fs_opts),

            (async () => {

                const maps = path.join(pkg.dir, 'Content', 'AvCsharp-Scripts', 'Maps')
                const map1bts = path.join(maps, 'Map1', 'BehaviourTrees')
                const map2bts = path.join(maps, 'Map2', 'BehaviourTrees')

                const fileNames = await fs_readdir(map1bts, opts)
                await Promise.all(
                    fileNames.map(async (fileName) => {
                        const srcBT = path.join(map1bts, fileName)
                        const dstBT = path.join(map2bts, fileName)
                        return copy(srcBT, dstBT, content => content.replace(
                            'namespace BehaviourTrees.Map1;',
                            'namespace BehaviourTrees.Map2;'
                        ), fs_opts)
                    })
                )
            })(),

            ...pkg.allCSProjs.map(async (filePath) => {
                filePath = path.join(pkg.dir, ...filePath.split('/'))
                return patch(filePath, csproj => csproj.replace(
                    /<TargetFramework>.*<\/TargetFramework>/,
                    `<TargetFramework>${sdkPkg.target}</TargetFramework>`
                ), fs_opts)
            }),
        ])

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
        
        await revert(fs_opts)
    }

    if(!await fs_exists(pkg.dll, opts))
        throw new Error(`Unable to build ${pkg.dllName}`)
}
