import { promises as fs } from 'node:fs'

const node_datachannel_default_import = `
import { createRequire } from "module";
var require2 = createRequire(import.meta.url);
var nodeDataChannel = require2("../build/Release/node_datachannel.node");
var node_datachannel_default = nodeDataChannel;
`.trim()
const node_datachannel_import = `
import node_datachannel_default from "./node_datachannel-9q4zjwmp.node";
`.trim()

let js = await fs.readFile('./dist/index.js', 'utf8')
js = js.replace(node_datachannel_default_import, node_datachannel_import)
js = js.replace(/var (\w+) = "(\.\/.*?-\w{8}\.\w*)";/g, (m, what, where) => {
    return `import ${what} from "${where}" with { type: 'file' };`
})
await fs.writeFile('./dist/index.js', js, 'utf8')