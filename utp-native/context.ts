import { type Pointer } from "bun:ffi";
import type { UTPAddress } from "./address"
import { UTPSocket } from "./socket"
import { utp_check_timeouts, utp_context_get_option, utp_context_set_option, utp_create_socket, utp_destroy, utp_issue_deferred_acks, utp_process_icmp_error, utp_process_icmp_fragmentation, utp_process_udp } from "./symbols";

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
    get_option(opt: number){
        return utp_context_get_option(this.handle, opt)
    }
    process_udp(buf: Buffer, to: UTPAddress){
        return utp_process_udp(this.handle, buf, buf.length, to.buffer, to.buffer.length)
    }
    process_icmp_error(buf: Buffer, to: UTPAddress){
        return utp_process_icmp_error(this.handle, buf, buf.length, to.buffer, to.buffer.length)
    }
    process_icmp_fragmentation(buf: Buffer, to: UTPAddress, next_hop_mtu: number){
        return utp_process_icmp_fragmentation(this.handle, buf, buf.length, to.buffer, to.buffer.length, next_hop_mtu)
    }
    check_timeouts(){
        return utp_check_timeouts(this.handle)
    }
    issue_deferred_acks(){
        return utp_issue_deferred_acks(this.handle)
    }
    //get_context_stats(){}
    create_socket(handler: UTPSocket['handler']){
        const socket = UTPSocket.fromHandle(utp_create_socket(this.handle)!)
        socket.handler = handler
    }
}
