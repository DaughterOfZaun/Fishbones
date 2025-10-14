import { createNode } from './index-node-simple'
import { main } from './index-tui'
import { TITLE } from './utils/constants-build'
import { logger } from './utils/data-shared'
import { checkbox, console_log, ExitPromptError, input } from './ui/remote'
import { registerShutdownHandler, setInsideUI, shutdown, shutdownOptions, unwrapAbortError } from './utils/data-process'
import { repair } from './utils/data-repair'
//import * as umplex from './network/umplex'
import type { AbortOptions } from '@libp2p/interface'
import { args } from './utils/args'

logger.log(`${'-'.repeat(35)} ${TITLE} started ${'-'.repeat(35)}`)

async function index(opts: Required<AbortOptions>){
    
    if(args.setup.enabled){
        const optionsEnabled = await checkbox({
            message: 'Select the desired options',
            choices: args.customizable.map(({ desc: name, enabled: checked }, value) => ({ name, value, checked }))
        })
        for(let i = 0; i < args.customizable.length; i++)
            args.customizable[i]!.enabled = optionsEnabled.includes(i)
        
        if(args.port.enabled){ //TODO: Rework.
            const passed = await input({
                message: `Enter ${args.port.desc}`,
                default: args.port.value.toString()
            })
            const parsed = parseInt(passed)
            if(isFinite(parsed) && parsed > 0)
                args.port.value = parsed
        }
    }

    if(args.repair.enabled)
        await repair(opts)

    const port = args.port.value
    const node = await createNode(port, opts)
    //console.log('node.peerId is', node.peerId.toString())
    registerShutdownHandler(async () => {
        //await node.services.pubsubPeerWithDataDiscovery?.beforeStop()
        //await node.services.pubsubPeerDiscovery?.stop()
        //await node.services.torrentPeerDiscovery?.beforeStop()
        //await node.services.torrentPeerDiscovery?.stop()
        //await node_services_upnpNAT?.stop()
        await node.stop()
        //umplex.shutdown()
    })

    await main(node, opts)
}

try {

    setInsideUI(true)
    await index(shutdownOptions)
    setInsideUI(false)
    shutdown('call')

} catch(unk_err: unknown) {
    
    setInsideUI(false)
    
    const err = unwrapAbortError(unk_err)
    if(err instanceof ExitPromptError){
        shutdown('timeout')
    } else {
        console_log('A fatal error occurred:', Bun.inspect(err))
        shutdown('exception')
    }
}
