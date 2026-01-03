import { createNode, stop } from './node/node'
import { main } from './tui/tui'
import { TITLE } from './utils/constants-build'
import { logger } from './utils/log'
import { console_log, ExitPromptError, input } from './ui/remote/remote'
import { registerShutdownHandler, setInsideUI, shutdown, shutdownOptions, unwrapAbortError } from './utils/process/process'
import { repair } from './utils/data/repair'
//import * as umplex from './network/umplex'
import type { AbortOptions } from '@libp2p/interface'
import { args } from './utils/args'
import { loadSkins } from './utils/data/constants/champions'
import * as pages from './tui/masteries/pages'
import { loadConfig } from './utils/config'
import { startup } from './tui/startup'
import { mrs } from './tui/mrs'
import { tr } from './utils/translation'

logger.log(`${'-'.repeat(35)} ${TITLE} started ${'-'.repeat(35)}`)

async function index(opts: Required<AbortOptions>){
    
    if(args.setup.enabled){
        
        await loadConfig(opts)
        await startup(opts)

        if(args.port.enabled){ //TODO: Rework.
            const passed = await input({
                message: `Enter ${args.port.desc}`,
                default: args.port.value.toString()
            })
            const parsed = parseInt(passed)
            if(isFinite(parsed) && parsed > 0)
                args.port.value = parsed
        }

        if(args.mr.enabled){
            args.mr.enabled = false
            const selected = await mrs(opts)
            if(selected){
                args.mr.enabled = true
                args.mr.value = selected
                args.update.enabled = true
            }
        }
    }

    if(args.repair.enabled) try {
        const result = await repair(opts)
        if(result?.mustExit) return
    } catch(err) {
        console_log(tr('Repairing of some critical component has failed.', {}))
        throw err
    }

    const port = args.port.value
    const node = await createNode(port, opts)
    //console.log('node.peerId is', node.peerId.toString())
    registerShutdownHandler(async () => {
        await stop(node)
        //umplex.shutdown()
    })

    await Promise.all([
        loadSkins(opts),
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
