import type { AbortOptions } from "@libp2p/interface";
import { DeferredView, render } from "../ui/remote/view";
import { button, checkbox, form, line, option } from "../ui/remote/types";
import { args } from "../utils/args";
import { gsPkg } from "../utils/data/packages/game-server";
import { AUTO_LOCALE, DEFAULT_LOCALE, systemLocale, systemLocaleSupported, tr, usedLocale } from "../utils/translation";
import { GC_LOCATION_AUTO, GC_LOCATION_C_DRIVE, GC_LOCATION_CUSTOM, GC_LOCATION_DOWNLOADS, gcLocationFromIndexToString, gcLocationFromStringToIndex, gcPkg } from "../utils/data/packages/game-client";
import { gc420Pkg } from "../utils/data/packages/game-client-420";

enum DownloadSource {
    Torrents_and_Mega = 3,
    Torrents = 2,
    Mega = 1,
    Web = 0,
}

export async function startup(opts: Required<AbortOptions>){

    let view: DeferredView<void>
    view = render('Startup', form({
        EnableInternet: checkbox(args.allowInternet.value, (on) => args.allowInternet.save(on)),
        UpdateLauncher: checkbox(args.upgrade.value, (on) => args.upgrade.save(on)),
        InstallModPack: checkbox(args.installModPack.value, (on) => args.installModPack.save(on)),
        DownloadSource: option(
            [
                { id: DownloadSource.Torrents_and_Mega, text: tr('web + torrents + mega.nz') },
                { id: DownloadSource.Torrents, text: tr('web + torrents') },
                { id: DownloadSource.Mega, text: tr('web + mega.nz') },
                { id: DownloadSource.Web, text: tr('web') },
            ],
            (+args.torrentDownload.value << 1) | (+args.megaDownload.value),
            (index) => {
                args.torrentDownload.save((index & DownloadSource.Torrents) != 0)
                args.megaDownload.save((index & DownloadSource.Mega) != 0)
            }
        ),
        UpdateServer: checkbox(args.update.value, (on) => args.update.save(on)),
        ServerOrigin: option(
            gsPkg.remotes.map((origin, id) => ({ id, text: origin.name })),
            args.remoteIdx.value,
            (index) => {
                //gsPkg.setRemoteByIndex(index)
                args.remoteIdx.save(index)
                //void saveConfig(config, safeOptions)
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
                    args.usedLocale.save(locale)
                },
            }
        },

        ...clientLocation(() => view, gcPkg, 'installS1Client', 'InstallS1Client', 'S1ClientLocation', 'S1ClientCustomLocation', 'gcLocation'),
        ...clientLocation(() => view, gc420Pkg, 'installS4Client', 'InstallS4Client', 'S4ClientLocation', 'S4ClientCustomLocation', 'gc420Location'),
        //InstallS4Server: checkbox(args.installS4Server.value, (on) => args.installS4Server.value = on),

        Play: button(() => view.resolve()),
        Test: button(() => {
            args.selectMR.set(true)
            view.resolve()
        }),
    }), opts)

    return view.promise.then(() => {
        args.installS4Server.set(args.installS4Client.value) //HACK:
    })
}

function clientLocation(getView: () => DeferredView<void>, gcPkg: { dir: string }, installS1Client: 'installS1Client' | 'installS4Client', InstallS1Client: string, S1ClientLocation: string, S1ClientCustomLocation: string, gcLocation: 'gcLocation' | 'gc420Location'){
    const GC_LOCATION_CUSTOM_IDX = gcLocationFromStringToIndex[GC_LOCATION_CUSTOM]!
    const index = gcLocationFromStringToIndex[args[gcLocation].value] ?? GC_LOCATION_CUSTOM_IDX
    const isCustom = index == GC_LOCATION_CUSTOM_IDX
    return {
        [InstallS1Client]: checkbox(args[installS1Client].value, (on) => {
            args[installS1Client].save(on)
        }),
        [S1ClientLocation]: option(
            [
                { id: gcLocationFromStringToIndex[GC_LOCATION_AUTO]!, text: tr('automatic location') },
                { id: gcLocationFromStringToIndex[GC_LOCATION_C_DRIVE]!, text: tr('C drive') },
                { id: gcLocationFromStringToIndex[GC_LOCATION_DOWNLOADS]!, text: tr('Fishbones_Data folder') },
                { id: GC_LOCATION_CUSTOM_IDX, text: tr('custom location') },
            ],
            index,
            (index) => {
                const view = getView()
                const isCustom = index == GC_LOCATION_CUSTOM_IDX
                if(!isCustom) args[gcLocation].save(gcLocationFromIndexToString[index]!)
                view.get(S1ClientCustomLocation).update(line(gcPkg.dir, undefined, isCustom))
            },
        ),
        [S1ClientCustomLocation]: line(gcPkg.dir, (text) => {
            args.gcLocation.save(text)
        }, isCustom),
    }
}
