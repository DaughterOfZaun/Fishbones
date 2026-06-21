import type { VersionFile } from "../../message/version";
import { sortInplace } from "../helpers";

export function compressVersionFile(vf: VersionFile){
    const { replacements, windows, linux } = vf
    
    console.assert(replacements.length <= 32)
    sortInplace(replacements, str => str.length, 'dsc')
    for(let i = 0; i < replacements.length - 1; i++){
        for(let j = i + 1; j < replacements.length; j++){
            replacements[i] = replacements[i]!.replaceAll(replacements[j]!, String.fromCharCode(j))
        }
    }

    if(windows) compressPackage(windows, replacements)
    if(linux) compressPackage(linux, replacements)
}
function compressPackage(pkg: VersionFile.PackageInfo, replacements: string[]){
    const { vfWebSeeds, zipWebSeeds, zipTorrentWebSeeds } = pkg
    compressInplace(vfWebSeeds, replacements)
    compressInplace(zipWebSeeds, replacements)
    compressInplace(zipTorrentWebSeeds, replacements)
}
function compressInplace(array: string[], replacements: string[]){
    for(let i = 0; i < array.length; i++)
        for(let j = replacements.length - 1; j >= 0; j--)
            array[i] = array[i]!.replaceAll(replacements[j]!, String.fromCharCode(j))
}