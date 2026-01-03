import type { AbortOptions } from "@libp2p/interface";
import { render } from "../ui/remote/view";
import { button, checkbox, form, option } from "../ui/remote/types";
import { args } from "../utils/args";
import { gsPkg } from "../utils/data/packages";
import { safeOptions } from "../utils/process/process";
import { AUTO_LOCALE, DEFAULT_LOCALE, setUsedLocale, systemLocale, systemLocaleSupported, tr, usedLocale } from "../utils/translation";
import { config, LOCALE_STR, REMOTE_IDX, saveConfig } from "../utils/config";

enum DownloadSource {
    Torrents_and_Mega = 3,
    Torrents = 2,
    Mega = 1,
    Web = 4,
}

export async function startup(opts: Required<AbortOptions>){

    const view = render('Startup', form({
        EnableInternet: checkbox(args.allowInternet.enabled, (on) => args.allowInternet.enabled = on),
        UpdateLauncher: checkbox(args.upgrade.enabled, (on) => args.upgrade.enabled = on),
        InstallModPack: checkbox(args.installModPack.enabled, (on) => args.installModPack.enabled = on),
        DownloadSource: option(
            [
                { id: DownloadSource.Torrents_and_Mega, text: tr('web + torrents + mega.nz') },
                { id: DownloadSource.Torrents, text: tr('web + torrents') },
                { id: DownloadSource.Mega, text: tr('web + mega.nz') },
                { id: DownloadSource.Web, text: tr('web') },
            ],
            (+args.torrentDownload.enabled << 1) | (+args.megaDownload.enabled),
            (index) => {
                args.torrentDownload.enabled = (index & DownloadSource.Torrents) != 0
                args.megaDownload.enabled = (index & DownloadSource.Mega) != 0
            }
        ),
        UpdateServer: checkbox(args.update.enabled, (on) => args.update.enabled = on),
        ServerOrigin: option(
            gsPkg.remotes.map((origin, id) => ({ id, text: origin.name })),
            config[REMOTE_IDX],
            (index) => {
                gsPkg.setRemoteByIndex(index)
                config[REMOTE_IDX] = index
                void saveConfig(config, safeOptions)
            }
        ),
        //EditServerOrigins: button(),
        ForceEnglish: {
            $type: 'checkbox',
            button_pressed: !systemLocaleSupported || usedLocale != systemLocale && usedLocale == DEFAULT_LOCALE,
            disabled: !systemLocaleSupported || systemLocale === DEFAULT_LOCALE,
            $listeners: {
                toggled(on){
                    const locale = on ? DEFAULT_LOCALE : AUTO_LOCALE
                    setUsedLocale(locale)
                    config[LOCALE_STR] = locale
                    void saveConfig(config, safeOptions)
                },
            }
        },
        Play: button(() => view.resolve()),
        Test: button(() => {
            args.mr.enabled = true
            view.resolve()
        }),
    }), opts)
    return view.promise
}
