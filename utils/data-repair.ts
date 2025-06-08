import { build } from "./data-build"
import { download, repairAria2 } from "./data-download"
import { gcPkg, gsPkg, PkgInfo, repairTorrents, sdkPkg } from "./data-packages"
import { repairServerSettingsJsonc } from "./data-server"
import { downloads, fs_ensure_dir, fs_exists, fs_exists_and_size_eq } from "./data-shared"
import { repairTorrentsTxt } from "./data-trackers"
import { DataError, repair7z, unpack } from "./data-unpack"

export async function repair(){
    //console.log('Running data check and repair...')

    await fs_ensure_dir(downloads)
    
    await Promise.all([
        repairServerSettingsJsonc(),
        repairTorrentsTxt(),
        repairTorrents(),
        repair7z(),
        repairAria2(),
    ] as Promise<unknown>[])

    await Promise.all([
        Promise.all([
            repairArchived(sdkPkg),
            repairArchived(gsPkg),
        ]).then(async () => {
            if(!await fs_exists(gsPkg.dll))
                await build(gsPkg)
            await fs_ensure_dir(gsPkg.infoDir)
        }),
        repairArchived(gcPkg),
    ] as Promise<unknown>[])
}

async function repairArchived(pkg: PkgInfo){
    if(await fs_exists(pkg.checkUnpackBy)){
        return // OK
    } else if(await fs_exists_and_size_eq(pkg.zip, pkg.zipSize)){
        try {
            await unpack(pkg)
            return // OK
        } catch(err) {
            if(!(err instanceof DataError))
                throw err
        }
    }
    if(await fs_exists(pkg.zipTorrent)){
        await download(pkg, 'torrent')
        await unpack(pkg)
    } else {
        await download(pkg, 'magnet')
        await unpack(pkg)
    }
}
