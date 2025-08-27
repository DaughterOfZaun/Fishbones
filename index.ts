import * as Data from './data'
import { createNode } from './index-node'
import { main } from './index-tui'
import { TITLE } from './utils/constants'
import { callShutdownHandlers, console_log, logger } from './utils/data-shared'

const ABORT_ERR = 20
const ERR_UNHANDLED_ERROR = 'ERR_UNHANDLED_ERROR'

process.on('SIGINT', () => shutdown(true))
process.on('SIGTERM', () => shutdown(true))
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
        shutdown(false)
    }
})

let sigints = 0
function shutdown(count: boolean){
    sigints += +count
    if(sigints < 2){
        node.stop()
        callShutdownHandlers(false)
        setTimeout(() => shutdown(true), 10_000).unref()
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

if(!process.argv.includes('--no-repair')) //try {
    await Data.repair()
//} catch(err) {
//    console_log('Data repair failed:', Bun.inspect(err))
//}

const port = parseInt(getNamedArg('--port', '5119'))
const node = await createNode(port)
//console.log('node.peerId is', node.peerId.toString())

await main(node)
