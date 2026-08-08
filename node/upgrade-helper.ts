import fs from 'node:fs'
import { spawn as cp_spawn } from 'node:child_process'
import { logger, type Loggable } from '../utils/log'
import { inspect } from 'node:util'

const LOG_PREFIX = 'UPGRADE-HELPER'

const checkInterval = 1000
const retryInterval = 1000
const retryCount = 3

//src: https://stackoverflow.com/questions/46937581/sleep-in-node-js
function sleep(ms: number){
    logger.log(LOG_PREFIX, 'sleep', ms)
    return new Promise(res => setTimeout(res, ms))
}

//src: https://stackoverflow.com/questions/14390930/how-to-check-if-an-arbitrary-pid-is-running-using-node-js
function processExists(pid: number){
    return try_catch('processExists', pid, () => process.kill(pid, 0))
}

function rename(from: string, to: string){
    return try_catch('rename', from, to, () => fs.renameSync(from, to))
}

function spawn(exe: string){
    return try_catch('spawn', exe, () => cp_spawn(exe, { stdio: 'ignore', detached: true }).unref())
}

type Callback = () => void
function try_catch(...args: [...Loggable[], cb: Callback]){
    const cb = args.pop() as Callback
    try {
        cb()
        logger.log(LOG_PREFIX, ...args, true)
        return true
    } catch (err) {
        logger.log(LOG_PREFIX, ...args, false, inspect(err))
        return false
    }
}

const exe = process.argv[0]!
const js = process.argv[1]!
const pid = parseInt(process.argv[2]!)
const oldExe = process.argv[3]!
const tmpExe = process.argv[4]!
const newExe = process.argv[5]!
logger.log(LOG_PREFIX, exe, js, pid, oldExe, tmpExe, newExe)

if(rename(oldExe, tmpExe)){
    rename(newExe, oldExe)
} else {
    while(processExists(pid))
        await sleep(checkInterval)
    for(let i = 0; i < retryCount; i++){
        if(rename(oldExe, tmpExe)){
            rename(newExe, oldExe)
        } else {
            await sleep(retryInterval)
            continue
        }
        break
    }
}

spawn(oldExe)

//process.exit()
