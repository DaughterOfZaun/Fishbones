import type { AbortOptions } from "@libp2p/interface";
import { DeferredView, render } from "../ui/remote/view";
import { base, button, checkbox, form, icon, icon_button, line, list, option } from "../ui/remote/types";
import { args } from "../utils/args";
import { bwPkg } from "../utils/data/packages/game-server-bw";
import { AUTO_LOCALE, DEFAULT_LOCALE, systemLocale, systemLocaleSupported, tr, usedLocale } from "../utils/translation";
import { GC_LOCATION_AUTO, GC_LOCATION_C_DRIVE, GC_LOCATION_CUSTOM, GC_LOCATION_DOWNLOADS, gcLocationFromIndexToString, gcLocationFromStringToIndex, gc126Pkg } from "../utils/data/packages/game-client-126";
import { profileIcons, profileIconsCount } from "../utils/data/constants/profile-icons";
import { gc420Pkg } from "../utils/data/packages/game-client-420";
import { sanitize_str } from "../utils/data/constants/values/inputable";

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
            bwPkg.remotes.map((origin, id) => ({ id, text: origin.name })),
            args.remoteIdx.value,
            (index) => args.remoteIdx.save(index),
        ),
        //EditServerOrigins: button(),
        ForceEnglish: checkbox(
            !systemLocaleSupported || usedLocale != systemLocale && usedLocale == DEFAULT_LOCALE,
            (on) => args.usedLocale.save(on ? DEFAULT_LOCALE : AUTO_LOCALE),
            !systemLocaleSupported || systemLocale === DEFAULT_LOCALE,
        ),

        ...clientLocation(() => view, gc126Pkg, 'installS1Client', 'InstallS1Client', 'S1ClientLocation', 'S1ClientCustomLocation', 'gc126Location'),
        ...clientLocation(() => view, gc420Pkg, 'installS4Client', 'InstallS4Client', 'S4ClientLocation', 'S4ClientCustomLocation', 'gc420Location'),
        
        InstallCBServer: checkbox(args.installCBServer.value, (on) => args.installCBServer.save(on)),
        InstallTGServer: checkbox(args.installTGServer.value, (on) => args.installTGServer.save(on)),

        ProfilePanel: form({
            Icon: icon_button(
                `${profileIcons}:${args.usericon.value}`,
                () => view.update(form({
                    IconPicker: base(true),
                })),
            ),
            Username: line(
                args.username.value,
                (input) => {
                    const text = sanitize_str(input)
                    view.get('ProfilePanel/Username').update({
                        $type: 'line', self_modulate: (!input || input != text) ? '#db7676' : '#ffffff'
                    })
                    args.username.set(text || args.username.defaultValue)
                }
            ),
        }),
        IconPicker: form({
            Icons: list(
                Object.fromEntries(
                    Array(profileIconsCount).fill(0).map((v, i) => {
                        return [ i, icon(`${profileIcons}:${i}`) ]
                    })
                )
            )
        }, {
            visible: false,
        },),

        Play: button(() => view.resolve()),
        Test: button(() => {
            args.selectMR.set(true)
            view.resolve()
        }),
    }), opts, [
        {
            regex: /^\.\/IconPicker\/Icons\/(?<index>\d+):pressed$/,
            listener: function (m){
                const index = parseInt(m.groups!.index!)
                args.usericon.set(index)
                view.update(form({
                    IconPicker: base(false),
                    ProfilePanel: form({
                        Icon: icon(`${profileIcons}:${index}`),
                    }),
                }))
            }
        }
    ])

    return view.promise.then(() => {
        args.save()
    })
}

function clientLocation(getView: () => DeferredView<void>, gcPkg: { dir: string }, installS1Client: 'installS1Client' | 'installS4Client', InstallS1Client: string, S1ClientLocation: string, S1ClientCustomLocation: string, gcLocation: 'gc126Location' | 'gc420Location'){
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
            args.gc126Location.save(text)
        }, isCustom),
    }
}
