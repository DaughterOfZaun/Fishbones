import { type Pointer } from "bun:ffi";
import type { UTPAddress } from "./address";
import { utp_close, utp_connect, utp_getsockopt, utp_read_drained, utp_setsockopt, utp_shutdown, utp_write } from "./symbols";
import type { UTPOptions, UTPShutdown } from "./enums";

const sockets = new Map<Pointer, UTPSocket>()

export class UTPSocket {
    
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
    setsockopt(opt: UTPOptions, val: number){
        return utp_setsockopt(this.handle, opt, val)
    }
    getsockopt(opt: UTPOptions){
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
    shutdown(how: UTPShutdown){
        return utp_shutdown(this.handle, how)
    }
    close(){
        return utp_close(this.handle)
    }
}
