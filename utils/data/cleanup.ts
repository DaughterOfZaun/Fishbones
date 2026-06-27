import type { AbortOptions } from "@libp2p/interface";
import { downloads, fs_readdir, fs_removeFile } from "./fs";
import embedded from './embedded/embedded'
import { sdkPkg } from "./packages/sdk";
import path from 'node:path'
import { gitPkg } from "./packages";
import { fbPkg } from "./upgrade";
import { platform } from "../constants-build"

const platformRegex = {
    Windows: /win|windows|Windows/,
    Linux: /linux|Linux/,
}[platform]

const regexes = [
    /^dotnet-sdk-(?:.*?)-(?<platform>)-x64(?:\.zip|\.tar\.gz)?(?:\.torrent)?$/,
    /^PortableGit-(?:.*?)-64-bit.7z.exe(?:\.torrent)?$/,
    /^bun-(?:.*?)-(?<platform>)-x64-baseline.exe$/,
    /^node-v(?:.*?)-(?<platform>)-x64.exe$/,
    /^(?:7zzs|7za)-(?:.*?)-(?<platform>)-x64\.exe$/,
    /^aria2c-(?:.*?)-(?<platform>)-(?:64bit|x64)(?:.*?)\.exe$/,
    /^node_datachannel-(?:.*?)\.node$/,
    /^Fishbones-(?:.*?)-(?<platform>)-x64\.zip(?:\.torrent)?$/,
    /^index-(?:.*?)\.js(?:\.map)?$/,
].map(regex => {
    const src = regex.source
        .replaceAll('(?<platform>)', `(?:${platformRegex.source})`)
    return new RegExp(src, regex.flags)
})

export async function cleanup(opts: Required<AbortOptions>){
    
    const filesToRemove = new Set<string>()

    for(const fileName of await fs_readdir(downloads, opts))
        if(regexes.some(regex => regex.test(fileName)))
            filesToRemove.add(fileName)

    for(const fileName of await fs_readdir(fbPkg.dir, opts))
        if(/Fishbones\.(?:.*?)\.exe/.test(fileName))
            filesToRemove.add(path.join(fbPkg.dirName, fileName))

    filesToRemove.delete(sdkPkg.dirName)
    filesToRemove.delete(sdkPkg.zipName)
    filesToRemove.delete(sdkPkg.zipTorrentName)

    filesToRemove.delete(gitPkg.dirName)
    filesToRemove.delete(gitPkg.zipName)
    filesToRemove.delete(gitPkg.zipTorrentName)

    filesToRemove.delete(path.basename(embedded.ariaExe))
    filesToRemove.delete(path.basename(embedded.s7zExe))
    filesToRemove.delete(path.basename(embedded.bunExe))
    filesToRemove.delete(path.basename(embedded.indexJS))
    filesToRemove.delete(path.basename(embedded.dataChannelLib))

    filesToRemove.delete(fbPkg.dirName)
    filesToRemove.delete(fbPkg.zipName)
    filesToRemove.delete(fbPkg.zipTorrentName)

    //console.log([...filesToRemove].join('\n'))
    return Promise.all([
        ...filesToRemove.values().map(async (fileName) => {
            return fs_removeFile(path.join(downloads, fileName), { ...opts, recursive: true })
        }),
    ])
}
