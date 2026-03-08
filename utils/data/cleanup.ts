import type { AbortOptions } from "@libp2p/interface";
import { downloads, fs_readdir, fs_removeFile } from "./fs";
import embedded from './embedded/embedded'
import { sdkPkg } from "./packages/sdk";
import path from 'node:path'
import { gitPkg } from "./packages";
import { fbPkg } from "./upgrade";

const regexes = [
    /^dotnet-sdk-(?:.*?)-(?:win|linux)-x64(?:\.zip|\.tar.gz)?(?:\.torrent)?$/,
    /^PortableGit-(?:.*?)-64-bit.7z.exe(?:\.torrent)?$/,
    /^bun-(?:.*?)-(?:windows|linux)-x64-baseline.exe$/,
    /^(?:7zzs|7za)-(?:.*?)-(?:windows|linux)-x64\.exe$/,
    /^aria2c-(?:.*?)-(?:win|linux)-(?:64bit|x64)(?:.*?)\.exe$/,
    /^node_datachannel-(?:.*?)\.node$/,
    /^Fishbones-(?:.*?)-(Windows|Linux)-x64\.zip(?:\.torrent)?$/,
    /^index-(?:.*?)\.js$/,
]

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
