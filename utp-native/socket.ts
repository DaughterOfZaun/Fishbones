import { type Pointer } from "bun:ffi";
import type { UTPError, UTPFlags, UTPState } from "./enums";
import type { UTPAddress } from "./address";
import { utp_connect, utp_getsockopt, utp_read_drained, utp_setsockopt, utp_shutdown, utp_write } from "./symbols";

const sockets = new Map<Pointer, UTPSocket>()

export class UTPSocket {
    public handler?: {
        read?: (buf: Buffer) => void
        state_change?: (state: UTPState) => void
        error?: (err: UTPError) => void
        send?: (buf: Buffer, address: UTPAddress, flags: UTPFlags) => void
        log?: (buf: string) => void
    }
    private constructor(private readonly handle: Pointer){}
    static fromHandle(handle: Pointer){
        let socket = sockets.get(handle)
        if(!socket){
            socket = new UTPSocket(handle)
            sockets.set(handle, socket)
        }
        return socket
    }

    //set_userdata(userdata: unknown){}
    //get_userdata(){}
    setsockopt(opt: number, val: number){
        return utp_setsockopt(this.handle, opt, val)
    }
    getsockopt(opt: number){
        return utp_getsockopt(this.handle, opt)
    }
    connect(to: UTPAddress){
        return utp_connect(this.handle, to.buffer, to.buffer.length)
    }
    write(buf: Buffer){
        return utp_write(this.handle, buf, buf.length)
    }
    //writev(bufs: Buffer[]){}
    //getpeername(): UTPAddress {}
    read_drained(){
        return utp_read_drained(this.handle)
    }
    //get_delays(): { ours: number, theirs: number, age: number } {}
    //get_stats(){}
    //get_context(){}
    shutdown(how: number){
        return utp_shutdown(this.handle, how)
    }
    close(){}
}
