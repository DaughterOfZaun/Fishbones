## Building from source (for developers)

- Clone the repository
- Download [7z2601-extra.7z](https://www.7-zip.org/a/7z2601-extra.7z) and extract `x64/7za.exe` to `./thirdparty/7z` as `7za-2601-windows-x64.exe`
- Download [aria2-1.37.0-win-64bit-build1.zip](https://github.com/aria2/aria2/releases/download/release-1.37.0/aria2-1.37.0-win-64bit-build1.zip) and extract `aria2c.exe` to `./thirdparty/aria2` as `aria2c-1.37.0-win-64bit-build1.exe`
- ~~Download [bun-windows-x64-baseline.zip](https://github.com/oven-sh/bun/releases/download/bun-v1.3.13/bun-windows-x64-baseline.zip) and extract `bun.exe` to `./thirdparty/bun` as `bun-1.3.13-windows-x64-baseline.exe`~~
- Download [node-v26.3.0-win-x64.zip](https://nodejs.org/dist/v26.3.0/node-v26.3.0-win-x64.zip) and extract `node.exe` to `./thirdparty/node` as `node-v26.3.0-win-x64.exe`
- Download [Godot_v4.6.3-stable_win64.exe.zip](https://github.com/godotengine/godot-builds/releases/download/4.6.3-stable/Godot_v4.6.3-stable_win64.exe.zip) and extract `Godot_v4.6.3-stable_win64.exe` to `./dist` as `Godot_v4.6.3-stable_win64.exe`
- Download [Godot_v4.6.3-stable_export_templates.tpz](https://github.com/godotengine/godot-builds/releases/download/4.6.3-stable/Godot_v4.6.3-stable_export_templates.tpz) (1.26 GB)
- Download [directx_Jun2010_redist.exe](https://download.microsoft.com/download/8/4/a/84a35bf1-dafe-4ae8-82af-ad2ae20b6b14/directx_Jun2010_redist.exe) and extract `Aug2008_d3dx9_39_x64.cab/d3dx9_39.dll` to `./thirdparty/directx_Jun2010_redist/Aug2008_d3dx9_39_x64` as `d3dx9_39.dll`
- Download [trackers_best.txt](https://raw.githubusercontent.com/ngosang/trackerslist/master/trackers_best.txt) to `./thirdparty` as `trackers.txt`
- Run `./dist/Godot_v4.6-stable_win64.exe`
  - Navigate `Import existing project` -> select `./remote-ui/project.godot` -> `Open` -> `Import`
  - Navigate `Editor` -> `Manage Export Templates` -> `Install from File` -> select `Godot_v4.6.3-stable_export_templates.tpz` -> Open
- Run the following command

```bash
bun run ./build.ts install patch-modules embeds protons bun godot release windows 0.0.3.50
```

- Run `./dist/Fishbones.exe`
