import fs from 'node:fs/promises'
import { spawn } from 'node:child_process'

const SEC = 1000
const checkInterval = 1 * SEC

//src: https://stackoverflow.com/questions/46937581/sleep-in-node-js
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms))

//src: https://stackoverflow.com/questions/14390930/how-to-check-if-an-arbitrary-pid-is-running-using-node-js
const processExists = (pid: number) => {
    try {
        process.kill(pid, 0)
        return true
    } catch(err){
        return false
    }
}

const [ exe, js, pidStr, from, to ] = process.argv

if(pidStr){
    const pid = parseInt(pidStr)
    while(processExists(pid)){
        await sleep(checkInterval)
    }
}

if(from && to){
    await fs.rename(from, to)
}

if(to){
    spawn(to, {
        stdio: 'ignore',
        detached: true,
    }).unref()
}

//process.exit()
