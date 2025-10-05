import { connectByPlainTextPeerInfoString, createNode, getPlainTextPeerInfoString } from "./index-node-simple"
import { Circuit } from '@multiformats/multiaddr-matcher'
import { input } from '@inquirer/prompts'

enum Role { Client, Server }
const role =
    process.argv.includes('server') ? Role.Server :
    process.argv.includes('client') ? Role.Client :
    undefined!
console.assert(role !== undefined)

const node = await createNode()

const node_stop = () => {
    const promise = node.stop()
    if(typeof promise === 'object'){
        promise.catch?.(err => {
            console.log('An unexpected exception occurred:', err)
        })
    }
}

const ABORT_ERR = 20
const ERR_UNHANDLED_ERROR = 'ERR_UNHANDLED_ERROR'
process.on('uncaughtException', (err: Error & { code?: string, context?: Error & { code?: number } }) => {
    if(
        err.message.startsWith('Unhandled error. (') &&
        err.message.endsWith(')') &&
        err.code === ERR_UNHANDLED_ERROR &&
        err.context?.code === ABORT_ERR &&
        err.context?.name === 'AbortError' &&
        err.context?.message === 'The operation was aborted.'
    ){ /* Ignore */ } else {
        console.log('An unexpected exception occurred:', err)
        node_stop()
    }
})

//src: signal-exit/signals.js
const signals = [ 'SIGHUP', 'SIGINT', 'SIGTERM' ]
if (process.platform !== 'win32')
    signals.push('SIGALRM', 'SIGABRT', 'SIGVTALRM', 'SIGXCPU', 'SIGXFSZ', 'SIGUSR2', 'SIGTRAP', 'SIGSYS', 'SIGQUIT', 'SIGIOT')
if (process.platform === 'linux')
    signals.push('SIGIO', 'SIGPOLL', 'SIGPWR', 'SIGSTKFLT');
for(const signal of signals)
    process.on(signal, () => node_stop())

let editorOpened = false
node.addEventListener('peer:discovery', (evt) => {
    if(editorOpened) return
    const peerInfo = evt.detail
    console.log('Discovered:', peerInfo.id.toString())
})
node.addEventListener('connection:open', (event) => {
    if(editorOpened) return
    const type = Circuit.matches(event.detail.remoteAddr) ? 'Circuit' : 'Direct'
    console.log(type, 'connection opened to:', event.detail.remoteAddr.toString())
})
node.addEventListener('connection:close', (event) => {
    if(editorOpened) return
    const type = Circuit.matches(event.detail.remoteAddr) ? 'Circuit' : 'Direct'
    console.log(type, 'connection closed to:', event.detail.remoteAddr.toString())
})

if(role === Role.Server){
    node.addEventListener('self:peer:update', () => {
        console.log('Copy text here', getPlainTextPeerInfoString(node))
    })
}
if(role === Role.Client){
    editorOpened = true
    const str = await input({
        message: 'Paste text here'
    })
    editorOpened = false
    const opts = { signal: new AbortController().signal }
    await connectByPlainTextPeerInfoString(node, str, opts)
}
