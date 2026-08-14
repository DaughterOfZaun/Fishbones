import type { AbortOptions } from "@libp2p/interface";
import { DeferredView, render } from "../ui/remote/view";
import { base, button, checkbox, form, icon, icon_button, label, line, list, option, text } from "../ui/remote/types";
import { getOrLoadVersionFile, parseVersionFileString, saveVersionFileInBackground } from "../utils/data/upgrade";
import { versionFileToBase64, versionFileToJSON, type ParsedVersionFile } from '../utils/data/upgrade'
import { args } from "../utils/args";
import { bwPkg } from "../utils/data/packages/game-server-bw";
import { AUTO_LOCALE, DEFAULT_LOCALE, systemLocale, systemLocaleSupported, tr, usedLocale } from "../utils/translation";
import { GC_LOCATION_AUTO, GC_LOCATION_C_DRIVE, GC_LOCATION_CUSTOM, GC_LOCATION_DOWNLOADS, gcLocationFromIndexToString, gcLocationFromStringToIndex, gc126Pkg } from "../utils/data/packages/game-client-126";
import { WINE_CMD_AUTO, WINE_CMD_AUTO_IDX, WINE_CMD_AUTO_TEMPLATE, WINE_CMD_CUSTOM_IDX } from "../utils/data/packages/wine";
import { profileIcons, profileIconsCount } from "../utils/data/constants/profile-icons";
import { gc420Pkg } from "../utils/data/packages/game-client-420";
import { gcCB3Pkg } from "../utils/data/packages/game-client-cb3";
import { sanitize_str } from "../utils/data/constants/values/inputable";
//import { logger } from "../utils/log";
//import { inspect } from 'node:util'
import type { MRs } from "./mrs";

enum DownloadSource {
    Torrents_and_Mega = 3,
    Torrents = 2,
    Mega = 1,
    Web = 0,
}

export async function startup(mrs: MRs, opts: Required<AbortOptions>){

    const isAuto = args.wineCommand.value == WINE_CMD_AUTO

    const areAnyUpdatesEnabled = () => {
        return args.selfUpgrade.value
            || args.updateBWServer.value
            || args.updateTGServer.value
    }
    const isS1Enabled = () => {
        return args.installS1Client.value
            || args.installBWServer.value
    }
    const isS4Enabled = () => {
        return args.installS4Client.value
            || args.installTGServer.value
            || args.installCBServer.value
    }

    const view: DeferredView<{ selectMR?: true }> = render('Startup', form({

        EnableUpdates: checkbox(areAnyUpdatesEnabled(), (on) => {
            
            args.selfUpgrade.set(on)
            args.updateBWServer.set(on)
            args.updateTGServer.set(on)
            args.save()

            view.update(form({
                UpdateLauncher: checkbox(on),
                UpdateServer: checkbox(on),
                UpdateTGServer: checkbox(on),
            }))
        }),

        EnableS1: checkbox(isS1Enabled(), (on) => {

            args.installS1Client.set(on)
            args.installBWServer.set(on)
            args.save()

            view.update(form({
                InstallS1Client: checkbox(on),
                InstallBWServer: checkbox(on),
            }))
        }),

        EnableS4: checkbox(isS4Enabled(), (on) => {

            args.installS4Client.set(on)
            args.installTGServer.set(on)
            args.installCBServer.set(false)
            args.save()

            view.update(form({
                InstallS4Client: checkbox(on),
                InstallTGServer: checkbox(on),
                InstallCBServer: checkbox(false),
            }))
        }),

        EnableInternet: checkbox(args.globalDiscovery.value, (on) => args.globalDiscovery.save(on)),
        UpdateLauncher: checkbox(args.selfUpgrade.value, (on) => args.selfUpgrade.save(on)),
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
        UpdateServer: checkbox(args.updateBWServer.value, (on) => args.updateBWServer.save(on)),
        ServerOrigin: option(
            bwPkg.remotes.map((origin, id) => ({ id, text: origin.name })),
            args.bwRemoteIdx.value,
            (index) => args.bwRemoteIdx.save(index),
        ),
        //EditServerOrigins: button(),
        ForceEnglish: checkbox(
            !systemLocaleSupported || usedLocale != systemLocale && usedLocale == DEFAULT_LOCALE,
            (on) => args.usedLocale.save(on ? DEFAULT_LOCALE : AUTO_LOCALE),
            !systemLocaleSupported || usedLocale == systemLocale && usedLocale == DEFAULT_LOCALE,
        ),

        ...clientLocation(() => view, gcCB3Pkg, 'installS0Client', 'InstallS0Client', 'S0ClientLocation', 'S0ClientCustomLocation', 'gcCB3Location'),
        ...clientLocation(() => view, gc126Pkg, 'installS1Client', 'InstallS1Client', 'S1ClientLocation', 'S1ClientCustomLocation', 'gc126Location'),
        ...clientLocation(() => view, gc420Pkg, 'installS4Client', 'InstallS4Client', 'S4ClientLocation', 'S4ClientCustomLocation', 'gc420Location'),
        
        InstallLoLSrver: checkbox(args.installLoLSrver.value, (on) => args.installLoLSrver.save(on)),
        InstallBWServer: checkbox(args.installBWServer.value, (on) => args.installBWServer.save(on)),
        InstallCBServer: checkbox(args.installCBServer.value, (on) => args.installCBServer.save(on)),
        InstallTGServer: checkbox(args.installTGServer.value, (on) => args.installTGServer.save(on)),
        UpdateTGServer: checkbox(args.updateTGServer.value, (on) => args.updateTGServer.save(on)),
        
        LinuxSpecificOptions: base(process.platform == 'linux'),
        WineCommandType: option(
            [
                { id: WINE_CMD_AUTO_IDX, text: tr("automatic command") },
                { id: WINE_CMD_CUSTOM_IDX, text: tr("custom command") },
            ],
            isAuto ? WINE_CMD_AUTO_IDX : WINE_CMD_CUSTOM_IDX,
            (index) => {
                const isAuto = index == WINE_CMD_AUTO_IDX
                if(isAuto) args.wineCommand.save(WINE_CMD_AUTO)
                view.get('WineCustomCommand').update(line(
                    isAuto ? WINE_CMD_AUTO_TEMPLATE : undefined,
                    undefined,
                    !isAuto,
                ))
            }
        ),
        WineCustomCommand: line(
            isAuto ? WINE_CMD_AUTO_TEMPLATE : args.wineCommand.value,
            (template) => args.wineCommand.set(template),
            !isAuto,
        ),

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
            $type: 'base',
            visible: false,
        }),

        DirectUpgrade: button(() => {
            directUpgrade(opts) //.catch(err => { logger.log('Direct upgrade failed:', inspect(err)) })
        }),

        Play: button(() => view.resolve({})),
        Test: button(() => view.resolve({ selectMR: true })),
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

    //args.selfUpgrade.on('change', onAnyUpdateOptionChanged)
    //args.updateBWServer.on('change', onAnyUpdateOptionChanged)
    //args.updateTGServer.on('change', onAnyUpdateOptionChanged)
    //view.addCleanupCallback(() => {
    //    args.selfUpgrade.off('change', onAnyUpdateOptionChanged)
    //    args.updateBWServer.off('change', onAnyUpdateOptionChanged)
    //    args.updateTGServer.off('change', onAnyUpdateOptionChanged)
    //})
    //function onAnyUpdateOptionChanged(){
    //    view.update(form({
    //        EnableUpdates: checkbox(areAnyUpdatesEnabled()),
    //    }))
    //}

    return view.promise.then((v) => {
        args.save()
        return v
    })
}

function clientLocation(
    getView: () => DeferredView<any>,
    gcPkg: { dir: string },
    installClient: 'installS0Client' | 'installS1Client' | 'installS4Client',
    InstallClient: string,
    ClientLocation: string,
    CustomClientLocation: string,
    gcLocation: 'gc126Location' | 'gc420Location' | 'gcCB3Location'
){
    const GC_LOCATION_CUSTOM_IDX = gcLocationFromStringToIndex[GC_LOCATION_CUSTOM]!
    const index = gcLocationFromStringToIndex[args[gcLocation].value] ?? GC_LOCATION_CUSTOM_IDX
    const isCustom = index == GC_LOCATION_CUSTOM_IDX
    return {
        [InstallClient]: checkbox(args[installClient].value, (on) => {
            args[installClient].save(on)
        }),
        [ClientLocation]: option(
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
                view.get(CustomClientLocation).update(line(gcPkg.dir, undefined, isCustom))
            },
        ),
        [CustomClientLocation]: line(gcPkg.dir, (text) => {
            args.gc126Location.save(text)
        }, isCustom),
    }
}

function directUpgrade(opts: Required<AbortOptions>){
    
    let parsedVersionFile: ParsedVersionFile | undefined
    
    const view = render('DirectUpgrade', form({
        TextToCopy: text(),
        BinaryToCopy: text(),
        PastedText: text(),
        PastedBinary: text(undefined, (str: string) => {
            void parseVersionFileString(str, opts, true).then(({ err, res: vf }) => {
                view.get('PastedText').update(text( vf ? versionFileToJSON(vf) : '' ))
                view.get('Error').update(label(err?.message ?? '', !!err))
                view.get('Apply').update(button(void 0, !!err))
                parsedVersionFile = vf
            })
        }),
        Cancel: button(() => view.resolve()),
        Apply: button(() => {
            if(parsedVersionFile)
                saveVersionFileInBackground(parsedVersionFile)
            view.get('PastedBinary').update(text(''))
            view.get('PastedText').update(text(''))
            view.resolve()
        }),
        Warning: label(''),
        Error: label(''),
    }), opts)

    getOrLoadVersionFile(opts).then((vf) => {
        if(vf){
            view.get('BinaryToCopy').update(text(versionFileToBase64(vf)))
            view.get('TextToCopy').update(text(versionFileToJSON(vf)))
        } else {
            const text = tr('The file is unavailable, please try updating at least once.')
            view.get('Warning').update(label(text))
        }
    }, () => {
        // Ignore.
    })
}
