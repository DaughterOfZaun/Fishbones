mv node_modules node_modules_linux_deno
mv node_modules_win_npm node_modules
rm -r ./dist/*
bun build --target=bun --sourcemap=none --outdir=dist --outfile=index.js ./index.ts #--minify-syntax
cp ./node_modules/node-datachannel/build/Release/node_datachannel.node ./dist/node_datachannel-9q4zjwmp.node
bun run build.ts
bun build --compile --target=bun-windows-x64 --sourcemap=inline --outfile=./dist/Fishbones.exe ./dist/index.js
mv node_modules node_modules_win_npm
mv node_modules_linux_deno node_modules
