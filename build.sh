mv node_modules node_modules_linux_npm
mv node_modules_win_npm node_modules
#rm -r ./dist/*
#bun build --target=bun --sourcemap=none --outdir=dist --outfile=index.js ./index.ts #--minify-syntax
#cp dist/index.js dist/index.bak.js
#cp ./node_modules/node-datachannel/build/Release/node_datachannel.node ./dist/node_datachannel-9q4zjwmp.node
#cp ./node_modules/@ipshipyard/node-datachannel/build/Release/node_datachannel.node ./dist/node_datachannel-9q4zjwmp.node
bun run build.ts
#bun build --compile --target=bun-windows-x64 --sourcemap=inline --outfile=./dist/Fishbones.exe ./dist/index.js
bun build --compile --target=bun-windows-x64 --sourcemap=inline --outfile=./dist/Fishbones.exe ./index.ts
mv node_modules node_modules_win_npm
mv node_modules_linux_npm node_modules
chmod 666 ./dist/Fishbones.exe
