import type { AbortOptions } from "@libp2p/interface";
import { render } from "../ui/remote/view";
import { button, checkbox, form, option } from "../ui/remote/types";
import { args } from "../utils/args";
import { gsPkg } from "../utils/data/packages";

enum DownloadSource {
    Torrents_and_Mega = 3,
    Torrents = 2,
    Mega = 1,
}

export async function startup(opts: Required<AbortOptions>){

    const remotes = [
        //{
        //    name: 'last used',
        //    remoteName: undefined!,
        //    originURL: undefined!,
        //    gitLabMRs: undefined!,
        //},
        {
            name: 'skelsoft',
            remoteName: 'origin',
            originURL: 'https://gitgud.io/skelsoft/brokenwings.git',
            gitLabMRs: 'https://gitgud.io/api/v4/projects/40035/merge_requests?state=opened',
        },
        {
            name: 'ice-cream-man',
            remoteName: 'ice-cream-man',
            originURL: 'https://gitgud.io/IceCreamMan/CoTG.git',
            gitLabMRs: 'https://gitgud.io/api/v4/projects/43500/merge_requests?state=opened',
        },
    ]

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
            -1,
            (index) => {
                const remote = remotes[index]
                if(remote){
                    gsPkg.gitLabMRs = remote.gitLabMRs
                    gsPkg.gitOriginURL = remote.originURL
                    gsPkg.gitRemoteName = remote.remoteName
                }
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