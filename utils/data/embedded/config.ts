export type SupportedPlatforms = 'windows' | 'linux'
export type Config = Record<string, string | Partial<Record<SupportedPlatforms, string>>>
export const config = {

    ariaExe: {
        windows: './thirdparty/aria2/aria2c-1.37.0-win-64bit-build1.exe',
        linux: './thirdparty/aria2/aria2c-1.36.0-linux-x64.exe',
    },
    //ariaConf: {
    //    windows: './thirdparty/Motrix/extra/win32/x64/engine/aria2.conf',
    //    linux: './thirdparty/Motrix/extra/linux/x64/engine/aria2.conf',
    //},
    
    s7zExe: {
        windows: './thirdparty/7z/7za-2501-windows-x64.exe',
        linux: './thirdparty/7z/7zzs-2501-linux-x64.exe',
    },
    //s7zDll: {
    //    windows: './node_modules/7z-bin/bin/win/x64/7z.dll',
    //},

    gc420ZipTorrent: '', //'./Fishbones_Data/League of Legends_UNPACKED.7z.torrent',
    gs420PkgZipTorrent: '', //'./Fishbones_Data/Chronobreak.GameServer.7z.torrent',

    gcZipTorrent: './Fishbones_Data/playable_client_126.7z.torrent',
    gsPkgZipTorrent: './Fishbones_Data/ChildrenOfTheGrave-Gameserver.7z.torrent',
    gsPkgZip: {
        //linux: './Fishbones_Data/ChildrenOfTheGrave-Gameserver.7z'
    },

    sdkForWinZipTorrent: {
        windows: './Fishbones_Data/dotnet-sdk-9.0.300-win-x64.zip.torrent',
    },
    sdkForLinuxZipTorrent: {
        linux: './Fishbones_Data/dotnet-sdk-9.0.300-linux-x64.tar.gz.torrent',
    },

    d3dx9_39_dll: './thirdparty/directx_Jun2010_redist/Aug2008_d3dx9_39_x64/d3dx9_39.dll',

    godotExe: '', //'/home/user/.local/share/godot/export_templates/4.5.stable/windows_release_x86_64.exe',
    godotPck: '', //'./dist/RemoteUI.pck',

    gitZipTorrent: {
        windows: './Fishbones_Data/PortableGit-2.51.0.2-64-bit.7z.exe.torrent',
    },
    gitZip: {
        //windows: './thirdparty/git/PortableGit-2.51.0.2-64-bit.7z.exe'
    },

    //icon: './remote-ui/icons/icon.png',

    bunExe: {
        windows: './thirdparty/bun/bun-1.3.2-windows-x64-baseline.exe',
        linux: './thirdparty/bun/bun-1.3.2-linux-x64-baseline.exe',
    },

    indexJS: './dist/index.js',

    //trackersTxt: './Fishbones_Data/trackers.txt',

    dataChannelLib: {
        linux: './dist/node_datachannel-bfgv6pn8.node',
        windows: './dist/node_datachannel-8fg8wz1b.node',
    }

}
