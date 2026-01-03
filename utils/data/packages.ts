import path from 'node:path'
import type { AbortOptions } from '@libp2p/interface'
import { console_log_fs_err, downloads, fs_exists, fs_moveFile } from './fs'
import { extractFile } from '../../ui/remote/remote'
import { gsPkg } from './packages/game-server'
import { gcPkg } from './packages/game-client'
import { sdkPkg } from './packages/sdk'
import { gitPkg } from './packages/git'
import { modPck1 } from './packages/modpack-levels'
import { winePkg } from './packages/wine'
import { tr } from '../translation'

export type { PkgInfo, PkgInfoCSProj, PkgInfoGit } from './packages/shared'
export { gsPkg, gcPkg, sdkPkg, gitPkg, modPck1, winePkg }

export const packages = [ gsPkg, gcPkg, sdkPkg, gitPkg, modPck1 ]

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
