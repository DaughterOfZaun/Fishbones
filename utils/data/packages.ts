import path from 'node:path'
import type { AbortOptions } from '@libp2p/interface'
import { console_log_fs_err, downloads, fs_exists, fs_moveFile } from './fs'
import { extractFile } from '../../ui/remote/remote'
import { gc126Pkg } from './packages/game-client-126'
import { gc420Pkg } from './packages/game-client-420'
import { bwPkg } from './packages/game-server-bw'
import { cbPkg } from "./packages/game-server-cb"
import { tgPkg } from './packages/game-server-tg'
import { gitPkg } from './packages/git'
import { modPck1 } from './packages/modpack-levels'
import { sdkPkg } from './packages/sdk'
import { fbPkg } from './upgrade'
import { tr } from '../translation'

export type { PkgInfo, PkgInfoCSProj, PkgInfoGit } from './packages/shared'
export { bwPkg, cbPkg, gc126Pkg, gc420Pkg, sdkPkg, gitPkg, modPck1 }

export const packages = [ gc126Pkg, gc420Pkg, bwPkg, cbPkg, tgPkg, gitPkg, modPck1, sdkPkg, fbPkg ]

if(false) //TODO:
for(const a of packages)
    for(const b of packages)
        if(a != b)
            console.assert(
                new Set(a.topLevelEntries).isDisjointFrom(new Set(b.topLevelEntries)),
                'Packages %s and %s intersecting at the top level',
                a.dirName, b.dirName
            )

export async function repairTorrents(opts: Required<AbortOptions>){
    return Promise.all(packages.filter(pkg => {
        return pkg.zipTorrent && pkg.zipTorrentEmbedded
    }).map(async pkg => {
        if(!await fs_exists(pkg.zipTorrent, opts)) try {
            await extractFile(pkg.zipTorrentEmbedded, pkg.zipTorrent, opts)
        } catch(err) {
            console_log_fs_err(tr('Extracting embedded torrent file failed', {}), `${pkg.zipTorrentEmbedded} -> ${pkg.zipTorrent}`, err)
        }
        await fs_moveFile(path.join(downloads, `${pkg.zipInfoHashV1}.torrent`), pkg.zipTorrent, opts, false)
    }))
}
