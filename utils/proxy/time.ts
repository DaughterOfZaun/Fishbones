import { NtpTimeSync } from "ntp-time-sync"
import type { Startable } from "@libp2p/interface"
import { console_log } from "../../ui/remote/remote"
import { tr } from "../translation"

const SYNC_TIME_INTERVAL = 15 * 60 * 1000

export function time(){
    return () => new TimeService()
}

const timeSync = NtpTimeSync.getInstance()
class TimeService implements Startable {

    syncInterval: ReturnType<typeof setInterval> | null = null
    //lastResult: NtpTimeResult | null = null
    lastResult_offset: number = 0

    public start(){
        if(!this.syncInterval){
            this.syncInterval = setInterval(this.syncTime, SYNC_TIME_INTERVAL)
            this.syncTime()
        }
    }

    private syncTime = () => {
        void timeSync.getTime().then(result => {
            const { offset, precision } = result
            //this.lastResult = result
            this.lastResult_offset = offset
            console_log(tr(`Time synchronization successful. Offset: {offset}. Precision: {precision}`, { offset, precision }))
        })
    }
    
    public stop(){
        if(this.syncInterval){
            clearInterval(this.syncInterval)
            this.syncInterval = null
        }
    }

    public now(){
        return Date.now() + this.lastResult_offset
    }
}