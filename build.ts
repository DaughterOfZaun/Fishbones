import { promises as fs } from 'node:fs'

let file: string, js: string

file = './node_modules/@ipshipyard/node-datachannel/dist/esm/lib/node-datachannel.mjs'
js = await fs.readFile(file, 'utf8')
js = js.replace(`
import cjsUrl from 'node:url';
import cjsPath from 'node:path';
import cjsModule from 'node:module';
const __filename = cjsUrl.fileURLToPath(import.meta.url);
const __dirname = cjsPath.dirname(__filename);
const require = cjsModule.createRequire(import.meta.url);
const nodeDataChannel = require("../../../build/Release/node_datachannel.node");
`.trim(), `
import nodeDataChannel from "../../../build/Release/node_datachannel.node";
`.trim())
await fs.writeFile(file, js, 'utf8')

file = './node_modules/webrtc-polyfill/node_modules/node-datachannel/lib/node-datachannel.js'
js = await fs.readFile(file, 'utf8')
js = js.replace(`
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
`.trim(), '')
js = js.replace(`
const nodeDataChannel = require('../build/Release/node_datachannel.node');
`.trim(), `
import nodeDataChannel from "../build/Release/node_datachannel.node";
`.trim())
await fs.writeFile(file, js, 'utf8')

file = './node_modules/@achingbrain/ssdp/dist/src/ssdp.js'
js = await fs.readFile(file, 'utf8')
js = js.replace(`import { createRequire } from 'node:module';`, '')
js = js.replace(`
const req = createRequire(import.meta.url);
const { name, version } = req('../../package.json');
`.trim(), `
import { name, version } from '../../package.json';
`.trim())
await fs.writeFile(file, js, 'utf8')

/*
const replacements = [
    {
        from: `
import { createRequire } from "module";
var require2 = createRequire(import.meta.url);
var nodeDataChannel = require2("../build/Release/node_datachannel.node");
var node_datachannel_default = nodeDataChannel;
        `.trim(),
        fromMinified: `
import { createRequire } from "module";
var require2 = createRequire(import.meta.url), nodeDataChannel = require2("../build/Release/node_datachannel.node"), node_datachannel_default = nodeDataChannel;
        `.trim(),
        to: `
import node_datachannel_default from "./node_datachannel-9q4zjwmp.node";
        `.trim(),
    },
    {
        from: `
import cjsUrl from "url";
import cjsPath from "path";
import cjsModule from "module";
var __filename2 = cjsUrl.fileURLToPath(import.meta.url);
var __dirname2 = cjsPath.dirname(__filename2);
var require3 = cjsModule.createRequire(import.meta.url);
var nodeDataChannel2 = require3("../../../build/Release/node_datachannel.node");
        `.trim(),
        to: `const nodeDataChannel2 = node_datachannel_default;`.trim(),
    },
    {
        from: `
        import cjsUrl from "url";
import cjsPath from "path";
import cjsModule from "module";
var __filename2 = cjsUrl.fileURLToPath(import.meta.url);
var __dirname2 = cjsPath.dirname(__filename2);
var require2 = cjsModule.createRequire(import.meta.url);
var nodeDataChannel = require2("../../../build/Release/node_datachannel.node");
        `.trim(),
        to: `import nodeDataChannel from "./node_datachannel-9q4zjwmp.node";`.trim(),
    },
    {
        from: `
var req = createRequire2(import.meta.url);
var { name: name3, version: version2 } = req("../../package.json");
        `.trim(),
        to: `
var { name: name3, version: version2 } = { "name": "@achingbrain/ssdp", "version": "4.2.2" };
        `.trim(),
    },
]

let js = await fs.readFile('./dist/index.js', 'utf8')
for(const r of replacements){
    js = js.replace(r.from, r.to)
    if(r.fromMinified)
        js = js.replace(r.fromMinified, r.to)
}
js = js.replace(/var (\w+) = "(\.\/.*?-\w{8}\.\w*)";/g, (m, what, where) => {
    return `import ${what} from "${where}" with { type: 'file' };`
})
await fs.writeFile('./dist/index.js', js, 'utf8')
*/