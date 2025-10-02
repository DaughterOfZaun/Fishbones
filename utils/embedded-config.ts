type SupportedPlatforms = 'windows' | 'linux'
export const config = {

    ariaExe: {
        windows: './thirdparty/Motrix/extra/win32/x64/engine/aria2c.exe',
        linux: './thirdparty/Motrix/extra/linux/x64/engine/aria2c',
    } as Partial<Record<SupportedPlatforms, string>>,
    ariaConf: {
        windows: './thirdparty/Motrix/extra/win32/x64/engine/aria2.conf',
        linux: './thirdparty/Motrix/extra/linux/x64/engine/aria2.conf',
    } as Partial<Record<SupportedPlatforms, string>>,
    
    s7zExe: {
        windows: './node_modules/7z-bin/bin/win/x64/7z.exe',
        linux: './node_modules/7z-bin/bin/linux/x64/7zzs',
    } as Partial<Record<SupportedPlatforms, string>>,
    s7zDll: {
        windows: './node_modules/7z-bin/bin/win/x64/7z.dll',
    } as Partial<Record<SupportedPlatforms, string>>,

    gc420ZipTorrent: '', //'./Fishbones_Data/League of Legends_UNPACKED.7z.torrent',
    gs420PkgZipTorrent: '', //'./Fishbones_Data/Chronobreak.GameServer.7z.torrent',

    gcZipTorrent: './Fishbones_Data/playable_client_126.7z.torrent',
    gsPkgZipTorrent: './Fishbones_Data/ChildrenOfTheGrave-Gameserver.7z.torrent',
    gsPkgZip: {
        linux: './Fishbones_Data/ChildrenOfTheGrave-Gameserver.7z'
    } as Partial<Record<SupportedPlatforms, string>>,

    sdkForWinZipTorrent: './Fishbones_Data/dotnet-sdk-9.0.300-win-x64.zip.torrent',
    sdkForLinuxZipTorrent: './Fishbones_Data/dotnet-sdk-9.0.300-linux-x64.tar.gz.torrent',

    d3dx9_39_dll: './thirdparty/directx_Jun2010_redist/Aug2008_d3dx9_39_x64/d3dx9_39.dll',

    godotExe: '', //'/home/user/.local/share/godot/export_templates/4.5.stable/windows_release_x86_64.exe',
    godotPck: '', //'./dist/RemoteUI.pck',

    gitZipTorrent: './Fishbones_Data/PortableGit-2.51.0.2-64-bit.7z.exe.torrent',
    gitZip: {
        //windows: './thirdparty/git/PortableGit-2.51.0.2-64-bit.7z.exe'
    }

} as const
