//src: https://github.com/electron/packager/blob/main/src/resedit.ts

import { Data, NtExecutable, NtExecutableResource, Resource } from 'resedit'
import fs from 'node:fs/promises'

export type ExePaths = {
    exePath: string
}

export type ExeMetadata = {
    productVersion?: string
    fileVersion?: string
    legalCopyright?: string
    productName?: string
    iconPath?: string
    //asarIntegrity?: Record<string, Pick<FileRecord['integrity'], 'algorithm' | 'hash'>>
    win32Metadata?: Win32MetadataOptions
}

export interface Win32MetadataOptions {
    CompanyName?: string
    FileDescription?: string
    OriginalFilename?: string
    ProductName?: string
    InternalName?: string
    //'requested-execution-level'?: 'asInvoker' | 'highestAvailable' | 'requireAdministrator'
    //'application-manifest'?: string
}

type ParsedVersionNumerics = [number, number, number, number]

function parseVersionString(str: string): ParsedVersionNumerics {
    const parts = str.split('.')
    if(parts.length === 0 || parts.length > 4)
        throw new Error(`Incorrectly formatted version string: "${str}". Should have at least one and at most four components`)
    return parts.map((part) => {
        const parsed = parseInt(part, 10)
        if (isNaN(parsed))
            throw new Error(`Incorrectly formatted version string: "${str}". Component "${part}" could not be parsed as an integer`)
        return parsed
    }) as ParsedVersionNumerics
}

export async function resedit(
    //exePath: string,
    exeData: Buffer,
    options: ExeMetadata,
){
    //let exeData = await fs.readFile(exePath)

    const exe = NtExecutable.from(exeData)
    const res = NtExecutableResource.from(exe)
    
    if(options.iconPath){
        const existingIconGroups = Resource.IconGroupEntry.fromEntries(res.entries)
        if(existingIconGroups.length !== 1)
            throw new Error('Failed to parse win32 executable resources, failed to locate existing icon group')
        const iconData = await fs.readFile(options.iconPath)
        const iconFile = Data.IconFile.from(iconData)
        Resource.IconGroupEntry.replaceIconsForResource(
            res.entries,
            existingIconGroups[0]!.id,
            existingIconGroups[0]!.lang,
            iconFile.icons.map((item) => item.data),
        )
    }

    const versionInfo = Resource.VersionInfo.fromEntries(res.entries)
    if(versionInfo.length !== 1)
        throw new Error('Failed to parse win32 executable resources, failed to locate existing version info')
    if(options.fileVersion)
        versionInfo[0]!.setFileVersion(...parseVersionString(options.fileVersion))
    if(options.productVersion)
        versionInfo[0]!.setProductVersion(...parseVersionString(options.productVersion))
    const languageInfo = versionInfo[0]!.getAllLanguagesForStringValues()
    if(languageInfo.length !== 1)
        throw new Error('Failed to parse win32 executable resources, failed to locate existing language info')
    
    const newStrings: Record<string, string> = {
        CompanyName: options.win32Metadata?.CompanyName || '',
        FileDescription: options.win32Metadata?.FileDescription || '',
        FileVersion: options.fileVersion || '',
        InternalName: options.win32Metadata?.InternalName || '',
        LegalCopyright: options.legalCopyright || '',
        OriginalFilename: options.win32Metadata?.OriginalFilename || '',
        ProductName: options.productName || '',
        ProductVersion: options.productVersion || '',
    }
    for (const key of Object.keys(newStrings)) {
        if (!newStrings[key])
            delete newStrings[key]
    }
    versionInfo[0]!.setStringValues(languageInfo[0]!, newStrings)
    versionInfo[0]!.outputToResourceEntries(res.entries)

    res.outputResource(exe)
    exeData = Buffer.from(exe.generate())
    //await fs.writeFile(exePath, exeData)
    return exeData
}
