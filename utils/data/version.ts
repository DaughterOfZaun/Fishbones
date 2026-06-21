import type { Record } from "@libp2p/interface";
import { VersionFile } from "../../message/version";
import { sortInplace } from "../helpers";
import { VERSION_FILE_CODEC, VERSION_FILE_DOMAIN } from "../constants-build";

export class VersionFileRecord implements Record {
    domain = VERSION_FILE_DOMAIN
    codec = VERSION_FILE_CODEC
    marshaled?: Uint8Array
    constructor(
        private vf: VersionFile,
    ){}
    marshal(){
        if(!this.marshaled)
            this.marshaled = VersionFile.encode(this.vf)
        return this.marshaled
    }
    equals(other: unknown){
        return (
            other instanceof VersionFileRecord &&
            other.vf == this.vf
        )
    }
}

export function compressVersionFile(vf: VersionFile){
    const { replacements, windows, linux, releasesUrl: releasesURL } = vf
    
    console.assert(replacements.length <= 32)
    sortInplace(replacements, str => str.length, 'dsc')
    for(let i = 0; i < replacements.length - 1; i++)
        for(let j = i + 1; j < replacements.length; j++)
            replacements[i] = replacements[i]!.replaceAll(replacements[j]!, String.fromCharCode(j))

    if(windows) compressVersionFilePackage(windows, replacements)
    if(linux) compressVersionFilePackage(linux, replacements)
    if(releasesURL) vf.releasesUrl = compressString(releasesURL, replacements)
}
function compressVersionFilePackage(pkg: VersionFile.PackageInfo, replacements: string[]){
    const { vfWebSeeds, zipWebSeeds, zipTorrentWebSeeds } = pkg
    compressArrayOfStringsInplace(vfWebSeeds, replacements)
    compressArrayOfStringsInplace(zipWebSeeds, replacements)
    compressArrayOfStringsInplace(zipTorrentWebSeeds, replacements)
}
function compressArrayOfStringsInplace(array: string[], replacements: string[]){
    for(let i = 0; i < array.length; i++)
        array[i] = compressString(array[i]!, replacements)
}
function compressString(str: string, replacements: string[]){
    for(let j = replacements.length - 1; j >= 0; j--)
        str = str.replaceAll(replacements[j]!, String.fromCharCode(j))
    return str
}

export function decompressVersionFile(vf: VersionFile){
    const { replacements, windows, linux, releasesUrl: releasesURL } = vf

    //console.assert(replacements.length <= 32)
    for(let i = 0; i < replacements.length - 1; i++)
        for(let j = i + 1; j < replacements.length; j++)
            replacements[i] = replacements[i]!.replaceAll(String.fromCharCode(j), replacements[j]!)
    
    if(windows) decompressVersionFilePackage(windows, replacements)
    if(linux) decompressVersionFilePackage(linux, replacements)
    if(releasesURL) vf.releasesUrl = decompressString(releasesURL, replacements)
}
function decompressVersionFilePackage(pkg: VersionFile.PackageInfo, replacements: string[]){
    const { vfWebSeeds, zipWebSeeds, zipTorrentWebSeeds } = pkg
    decompressArrayOfStringsInplace(vfWebSeeds, replacements)
    decompressArrayOfStringsInplace(zipWebSeeds, replacements)
    decompressArrayOfStringsInplace(zipTorrentWebSeeds, replacements)
}
function decompressArrayOfStringsInplace(array: string[], replacements: string[]){
    for(let i = 0; i < array.length; i++)
        array[i] = decompressString(array[i]!, replacements)
}
function decompressString(str: string, replacements: string[]){
    for(let j = replacements.length - 1; j >= 0; j--)
        str = str.replaceAll(String.fromCharCode(j), replacements[j]!)
    return str
}
