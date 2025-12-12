import type { AbortOptions } from "@libp2p/interface";
import { render } from "../ui/remote/view";
import { button, checkbox, form, option } from "../ui/remote/types";
import { args } from "../utils/args";
import { gsPkg } from "../utils/data/packages";
import { downloads, fs_readFile, fs_writeFile } from "../utils/data/fs";
import { safeOptions } from "../utils/process/process";
import path from 'node:path'

enum DownloadSource {
    Torrents_and_Mega = 3,
    Torrents = 2,
    Mega = 1,
}

const remotes = [
    {
        name: 'skelsoft',
        remoteName: 'origin',
        originURL: 'https://gitgud.io/skelsoft/brokenwings.git',
        gitLabMRs: 'https://gitgud.io/api/v4/projects/40035/merge_requests?state=opened',
        gitBranchName: 'master',
    },
    {
        name: 'ice-cream-man',
        remoteName: 'ice-cream-man',
        originURL: 'https://gitgud.io/IceCreamMan/CoTG.git',
        gitLabMRs: 'https://gitgud.io/api/v4/projects/43500/merge_requests?state=opened',
        gitBranchName: 'master',
    },
]
function setRemoteByIndex(index: number){
    const remote = remotes[index]
    if(remote){
        gsPkg.gitLabMRs = remote.gitLabMRs
        gsPkg.gitOriginURL = remote.originURL
        gsPkg.gitRemoteName = remote.remoteName
        gsPkg.gitBranchName = remote.gitBranchName
    }
}

type Config = typeof defaultConfig
const REMOTE_IDX = 'game-server-git-remote-index'
const defaultConfig = {
    [REMOTE_IDX]: 0,
}

let config = Object.assign({}, defaultConfig)
export async function loadConfig(opts: Required<AbortOptions>){
    const configJSON = await fs_readFile(configFile, { ...opts, encoding: 'utf8' })
    if(configJSON){
        config = JSON.parse(configJSON) as Config
    } else {
        await saveConfig(defaultConfig, opts)
    }

    setRemoteByIndex(config[REMOTE_IDX])
    
    return config
}

const configFile = path.join(downloads, 'config.json')
async function saveConfig(config: Config, opts: Required<AbortOptions>){
    return fs_writeFile(configFile, JSON.stringify(config, null, 4), { ...opts, encoding: 'utf8' })
}

export async function startup(opts: Required<AbortOptions>){
    
    const view = render('Startup', form({
        EnableInternet: checkbox(args.allowInternet.enabled, (on) => args.allowInternet.enabled = on),
        UpdateLauncher: checkbox(args.upgrade.enabled, (on) => args.upgrade.enabled = on),
        DownloadSource: option(
            [
                { id: DownloadSource.Torrents_and_Mega, text: 'torrents + mega.nz' },
                { id: DownloadSource.Torrents, text: 'torrents' },
                { id: DownloadSource.Mega, text: 'mega.nz' },
            ],
            (+args.torrentDownload.enabled << 1) | (+args.megaDownload.enabled),
            (index) => {
                args.torrentDownload.enabled = (index & DownloadSource.Torrents) != 0
                args.megaDownload.enabled = (index & DownloadSource.Mega) != 0
            }
        ),
        UpdateServer: checkbox(args.update.enabled, (on) => args.update.enabled = on),
        ServerOrigin: option(
            remotes.map((origin, id) => ({ id, text: origin.name })),
            config[REMOTE_IDX],
            (index) => {
                setRemoteByIndex(index)
                config[REMOTE_IDX] = index
                void saveConfig(config, safeOptions)
            }
        ),
        //EditServerOrigins: button(),
        Play: button(() => view.resolve()),
        Test: button(() => {
            args.mr.enabled = true
            view.resolve()
        }),
    }), opts)
    return view.promise
}