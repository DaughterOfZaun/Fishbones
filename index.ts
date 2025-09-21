import { createNode } from './index-node'
import { main } from './index-tui'
import { TITLE } from './utils/constants'
import { logger } from './utils/data-shared'
import { console_log, ExitPromptError } from './ui/remote'
import { registerShutdownHandler, setInsideUI, shutdown, shutdownOptions, unwrapAbortError } from './utils/data-process'
import { repair } from './utils/data-repair'
import * as umplex from './network/umplex'
import * as RemoteUI from './ui/remote'
import type { AbortOptions } from '@libp2p/interface'

function getNamedArg(name: string, defaultValue: string){
    const index = process.argv.indexOf(name)
    return (index >= 0 && index + 1 < process.argv.length) ?
        process.argv[index + 1]! :
        defaultValue
}

logger.log(`${'-'.repeat(35)} ${TITLE} started ${'-'.repeat(35)}`)

async function index(opts: Required<AbortOptions>){

    const repairEnabled = !process.argv.includes('--no-repair')
    if(await RemoteUI.repairAndStart(repairEnabled, opts)){
        return //process.exit(0)
    } else if(repairEnabled){
        await repair(opts)
    }

    const port = parseInt(getNamedArg('--port', '5119'))
    const node = await createNode(port, opts)
    //console.log('node.peerId is', node.peerId.toString())
    registerShutdownHandler(async () => {
        //await node.services.pubsubPeerWithDataDiscovery?.beforeStop()
        //await node.services.pubsubPeerDiscovery?.stop()
        //await node.services.torrentPeerDiscovery?.beforeStop()
        //await node.services.torrentPeerDiscovery?.stop()
        //await node_services_upnpNAT?.stop()
        await node.stop()
        umplex.shutdown()
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
