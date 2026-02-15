<p align="center" width="100%">
    <br>
    <br>
    <br>
    <br>
    <big><a width="100%" href="https://github.com/DaughterOfZaun/Fishbones/releases/download/v0.0.4/Fishbones-0.0.3.34-Windows-x64.zip">> DOWNLOAD <</a></big>
    <br>
    <br>
    <br>
    <br>
    <br>
    <br>
    <sub><a href="https://github.com/DaughterOfZaun/Fishbones/releases">all downloads</a></sub><br>
    <sup><a href="https://discord.gg/tdxas6nKXP">discord</a></sup>
</p>

## Building from source (for developers)
- Clone the repository
- Download [7z2501-extra.7z](https://www.7-zip.org/a/7z2501-extra.7z) and extract `x64/7za.exe` to `./thirdparty/7z` as `7za-2501-windows-x64.exe`
- Download [aria2-1.37.0-win-64bit-build1.zip](https://github.com/aria2/aria2/releases/download/release-1.37.0/aria2-1.37.0-win-64bit-build1.zip) and extract `aria2c.exe` to `./thirdparty/aria2` as `aria2c-1.37.0-win-64bit-build1.exe`
- Download [bun-windows-x64-baseline.zip](https://github.com/oven-sh/bun/releases/download/bun-v1.3.5/bun-windows-x64-baseline.zip) and extract `bun.exe` to `./thirdparty/bun` as `bun-1.3.5-windows-x64-baseline.exe`
- Download [Godot_v4.6-stable_win64.exe.zip](https://github.com/godotengine/godot-builds/releases/download/4.6-stable/Godot_v4.6-stable_win64.exe.zip) and extract `Godot_v4.6-stable_win64.exe` to `./dist` as `Godot_v4.6-stable_win64.exe`
- Download [Godot_v4.6-stable_export_templates.tpz](https://github.com/godotengine/godot-builds/releases/download/4.6-stable/Godot_v4.6-stable_export_templates.tpz) (1.26 GB)
- Download [directx_Jun2010_redist.exe](https://download.microsoft.com/download/8/4/a/84a35bf1-dafe-4ae8-82af-ad2ae20b6b14/directx_Jun2010_redist.exe) and extract `Aug2008_d3dx9_39_x64.cab/d3dx9_39.dll` to `./thirdparty/directx_Jun2010_redist/Aug2008_d3dx9_39_x64` as `d3dx9_39.dll`
- Download [trackers_best.txt](https://raw.githubusercontent.com/ngosang/trackerslist/master/trackers_best.txt) to `./thirdparty` as `trackers.txt`
- Run `./dist/Godot_v4.6-stable_win64.exe`
    - Navigate `Import` -> select `./remote-ui/project.godot` -> `Open` -> `Import`
    - Navigate `Editor` -> `Manage Export Templates` -> `Install from File` -> select `Godot_v4.6-stable_export_templates.tpz` -> Open
- Run a command
```bash
./thirdparty/bun-1.3.5-windows-x64-baseline.exe run ./build.ts install embeds protons bun godot release windows 0.0.3.34
```
- Run `./dist/Fishbones.exe`
