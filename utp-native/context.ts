import { type Pointer } from "bun:ffi";
import type { UTPAddress } from "./address"
import { UTPSocket } from "./socket"
import { utp_context_set_option, utp_create_socket, utp_destroy } from "./symbols";

const contexts = new Map<Pointer, UTPContext>()

export class UTPContext {
    public handler?: {
        accept?: (socket: UTPSocket, address: UTPAddress) => void
        firewall?: (address: UTPAddress) => void
    }
    private constructor(private readonly handle: Pointer){}
    static fromHandle(handle: Pointer){
        let context = contexts.get(handle)
        if(!context){
            context = new UTPContext(handle)
            contexts.set(handle, context)
        }
        return context
    }

    destroy(){
        return utp_destroy(this.handle)
    }
    //set_callback(callback_name: UTPCallback, proc: unknown){}
    //set_userdata(userdata: unknown){}
    //get_userdata(){}
    set_option(opt: number, val: number){
        return utp_context_set_option(this.handle, opt, val)
    }
    get_option(opt: number){}
    process_udp(buf: Buffer, to: UTPAddress){}
    process_icmp_error(buf: Buffer, to: UTPAddress){}
    process_icmp_fragmentation(buf: Buffer, to: UTPAddress, next_hop_mtu: number){}
    check_timeouts(){}
    issue_deferred_acks(){}
    get_context_stats(){}
    create_socket(){
        return UTPSocket.fromHandle(utp_create_socket(this.handle)!)
    }
}
