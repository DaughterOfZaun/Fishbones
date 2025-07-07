import { type Pointer } from "bun:ffi";
import type { UTPError, UTPFlags, UTPState } from "./enums";
import type { UTPAddress } from "./address";

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
    setsockopt(opt: number, val: number){}
    getsockopt(opt: number){}
    connect(to: UTPAddress){}
    write(buf: Buffer){}
    writev(bufs: Buffer[]){}
    //getpeername(): UTPAddress {}
    read_drained(){}
    //get_delays(): { ours: number, theirs: number, age: number } {}
    get_stats(){}
    //get_context(){}
    shutdown(how: number){}
    close(){}
}
