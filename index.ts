import { ExitPromptError } from '@inquirer/core'
import { createNode } from './index-node'
import { main } from './index-tui'
import { TITLE } from './utils/constants'
import { console_log, logger } from './utils/data-shared'
import { callShutdownHandlers, MAIN_PROCESS_EXIT_TIMEOUT, registerShutdownHandler, shutdownController, shutdownOptions } from './utils/data-process'
import { repair } from './utils/data-repair'

const ABORT_ERR = 20
const ERR_UNHANDLED_ERROR = 'ERR_UNHANDLED_ERROR'

//src: signal-exit/signals.js
const signals = [ 'SIGHUP', 'SIGINT', 'SIGTERM' ]
if (process.platform !== 'win32')
    signals.push('SIGALRM', 'SIGABRT', 'SIGVTALRM', 'SIGXCPU', 'SIGXFSZ', 'SIGUSR2', 'SIGTRAP', 'SIGSYS', 'SIGQUIT', 'SIGIOT')
if (process.platform === 'linux')
    signals.push('SIGIO', 'SIGPOLL', 'SIGPWR', 'SIGSTKFLT');

for(const signal of signals)
    process.on(signal, () => {
        const force = !!shuttingDownAlready
        shutdown(force, 'signal')
    })

process.on('uncaughtException', (err: Error & { code?: string, context?: Error & { code?: number } }) => {
    if(
        //err.message.startsWith('Unhandled error. (') &&
        //err.message.endsWith(')') &&
        err.code === ERR_UNHANDLED_ERROR &&
        err.context?.code === ABORT_ERR//&&
        //err.context?.name === 'AbortError' &&
        //err.context?.message === 'The operation was aborted.'
    ){
        // Ignore.
    } else {
        console_log('UNCAUGHT EXCEPTION', Bun.inspect(err))
        shutdown(false, 'exception')
    }
})

let isInsideOfUI = false
let shuttingDownAlready = 0
function shutdown(force: boolean, source: 'signal' | 'exception' | 'call'){
    shuttingDownAlready++
    if(!force){
        if(shuttingDownAlready == 1){
            shutdownController.abort(new ExitPromptError())
            setTimeout(() => shutdown(true, 'call'), MAIN_PROCESS_EXIT_TIMEOUT).unref()
        }
        if(isInsideOfUI && source === 'signal'){ /* Ignore */ }
        else callShutdownHandlers(false)
    } else {
        callShutdownHandlers(true)
        process.exit()
    }
}

function getNamedArg(name: string, defaultValue: string){
    const index = process.argv.indexOf(name)
    return (index >= 0 && index + 1 < process.argv.length) ?
        process.argv[index + 1]! :
        defaultValue
}

logger.log(`${'-'.repeat(35)} ${TITLE} started ${'-'.repeat(35)}`)

if(!process.argv.includes('--no-repair')) try {
    isInsideOfUI = true
    await repair(shutdownOptions)
    isInsideOfUI = false
} catch(err) {
    if(!(err instanceof ExitPromptError))
        console_log('Data repair failed:', Bun.inspect(err))
    shutdown(false, 'call')
}

try {
    const port = parseInt(getNamedArg('--port', '5119'))
    const node = await createNode(port, shutdownOptions)
    //console.log('node.peerId is', node.peerId.toString())
    registerShutdownHandler(() => {
        //await node.services.pubsubPeerWithDataDiscovery?.beforeStop()
        //await node.services.pubsubPeerDiscovery?.stop()
        //await node.services.torrentPeerDiscovery?.beforeStop()
        //await node.services.torrentPeerDiscovery?.stop()
        //await node_services_upnpNAT?.stop()
        return node.stop()
    })

    isInsideOfUI = true
    await main(node, shutdownOptions)
    isInsideOfUI = false
} catch(err) {
    if(!(err instanceof ExitPromptError))
        console_log('A fatal error occurred:', Bun.inspect(err))
} finally {
    shutdown(false, 'call')
}
