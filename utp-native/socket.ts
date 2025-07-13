import { ptr, type Pointer } from "bun:ffi";
import type { UTPAddress } from "./address";
import { utp_close, utp_connect, utp_getsockopt, utp_read_drained, utp_setsockopt, utp_shutdown, utp_write } from "./symbols";
import type { UTPOptions, UTPShutdown } from "./enums";

const sockets = new Map<Pointer, UTPSocket>()

export class UTPSocket {
    
    private constructor(private readonly handle: Pointer){}

    static fromHandle(handle: Pointer){
        let socket = sockets.get(handle)
        if(socket){
            //console.log('fromHandle', 'found', handle)
        } else {
            //console.log('fromHandle', 'created', handle)
            socket = new UTPSocket(handle)
            sockets.set(handle, socket)
        }
        return socket
    }

    //set_userdata(userdata: unknown){}
    //get_userdata(){}
    setsockopt(opt: UTPOptions, val: number){
        //console.log('utp_setsockopt', this.handle, opt, val)
        return utp_setsockopt(this.handle, opt, val)
    }
    getsockopt(opt: UTPOptions){
        //console.log('utp_getsockopt', this.handle, opt)
        return utp_getsockopt(this.handle, opt)
    }
    connect(to: UTPAddress){
        //console.log('utp_connect', this.handle, to.buffer, to.buffer.length)
        return utp_connect(this.handle, ptr(to.buffer), to.buffer.length)
    }
    write(buf: Uint8Array){
        //console.log('utp_write', this.handle, buf, buf.length)
        return utp_write(this.handle, ptr(buf), buf.length)
    }
    //writev(bufs: Uint8Array[]){}
    //getpeername(): UTPAddress {}
    read_drained(){
        //console.log('utp_read_drained', this.handle)
        return utp_read_drained(this.handle)
    }
    //get_delays(): { ours: number, theirs: number, age: number } {}
    //get_stats(){}
    //get_context(){}
    shutdown(how: UTPShutdown){
        //console.log('utp_shutdown', this.handle, how)
        return utp_shutdown(this.handle, how)
    }
    close(){
        //console.log('utp_close', this.handle)
        return utp_close(this.handle)
    }
}
