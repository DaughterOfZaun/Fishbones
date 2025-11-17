import { createNode, stop } from './node/node'
import { main } from './tui/tui'
import { TITLE } from './utils/constants-build'
import { logger } from './utils/log'
import { checkbox, console_log, ExitPromptError, input } from './ui/remote/remote'
import { registerShutdownHandler, setInsideUI, shutdown, shutdownOptions, unwrapAbortError } from './utils/process/process'
import { repair } from './utils/data/repair'
//import * as umplex from './network/umplex'
import type { AbortOptions } from '@libp2p/interface'
import { args } from './utils/args'
import { render } from './ui/remote/view'
import { button, form, label, list } from './ui/remote/types'
import { gsPkg } from './utils/data/packages'
import { loadSkins } from './utils/data/constants/champions'

logger.log(`${'-'.repeat(35)} ${TITLE} started ${'-'.repeat(35)}`)

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace GitLab {
    export type MergeRequest = {
        iid: number
        title: string
        description: string
        reference: string
        author: {
            username: string
            name: string
        }
    }
}

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
        if(args.mr.enabled){
            args.mr.enabled = false

            const view = render<number | null>('MergeRequests', form({
                Cancel: button(() => view.resolve(null)),
                List: list(),
            }), opts, [
                {
                    regex: /List\/(?<iid>\d+)\/Button:pressed/,
                    listener(m){
                        const iid = parseInt(m.groups!.iid!)
                        view.resolve(iid)
                    },
                }
            ])

            let mrs: GitLab.MergeRequest[] | undefined
            try {
                mrs = await (await fetch(gsPkg.gitLabMRs)).json() as never
            } catch(err) {
                console_log('Fetching a list of open requests failed:', Bun.inspect(err))
            }
            
            if(mrs){
                view.get('List').setItems(
                    Object.fromEntries(
                        mrs.map(mr => {
                            const mrForm = form({
                                Button: button(),
                                Title: label(mr.title),
                                Info: label(`${mr.reference} · created by ${mr.author.name}`) //TODO: ${'20 hours ago'}
                            })
                            return [ mr.iid, mrForm ]
                        })
                    )
                )
                const selected = await view.promise
                if(selected){
                    args.mr.enabled = true
                    args.mr.value = selected
                }
            }
        }
    }

    if(args.repair.enabled) try {
        const result = await repair(opts)
        if(result?.mustExit) return
    } catch(err) {
        console_log('Repairing of some critical component has failed.')
        throw err
    }

    const port = args.port.value
    const node = await createNode(port, opts)
    //console.log('node.peerId is', node.peerId.toString())
    registerShutdownHandler(async () => {
        await stop(node)
        //umplex.shutdown()
    })

    await loadSkins(opts)
    
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
