import { createNode, stop } from './node/node'
import { main } from './tui/tui'
import { TITLE } from './utils/constants-build'
import { logger } from './utils/log'
import { console_log, ExitPromptError, input } from './ui/remote/remote'
import { registerShutdownHandler, setInsideUI, shutdown, shutdownOptions, unwrapAbortError } from './utils/process/process'
import { repair } from './utils/data/repair'
import { cleanup } from './utils/data/cleanup'
//import * as umplex from './network/umplex'
import type { AbortOptions } from '@libp2p/interface'
import { args, loadConfig } from './utils/args'
import * as pages from './tui/masteries/pages'
import { startup } from './tui/startup'
import { mrs } from './tui/mrs'
import { tr } from './utils/translation'

logger.log(`${'-'.repeat(35)} ${TITLE} started ${'-'.repeat(35)}`)

async function index(opts: Required<AbortOptions>){
    
    if(args.setup.value){
        
        await loadConfig(opts)
        await startup(opts)

        if(args.selectMR.value){
            args.selectMR.set(false)
            const selected = await mrs(opts)
            if(selected){
                args.mrNumber.set(selected)
                args.update.set(true)
            }
        }
    }

    if(args.repair.value) try {
        const result = await repair(opts)
        if(result?.mustExit) return
    } catch(err) {
        console_log(tr('Repairing of some critical component has failed.', {}))
        throw err
    }

    try {
        await cleanup(opts)
    } catch(err) {
        console_log(tr('Out-of-date data cleanup failed.', {}), Bun.inspect(err))
    }

    const port = args.port.value
    const node = await createNode(port, opts)
    //console.log('node.peerId is', node.peerId.toString())
    registerShutdownHandler(async () => {
        await stop(node)
        //umplex.shutdown()
    })

    await Promise.all([
        pages.load(opts),
    ])
    
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
        console_log(tr('A fatal error occurred:', {}), Bun.inspect(err))
        shutdown('exception')
    }
}
