import { ptr, type Pointer } from "bun:ffi";
import type { UTPAddress } from "./address"
import { UTPSocket } from "./socket"
import { utp_check_timeouts, utp_context_get_option, utp_context_set_option, utp_create_socket, utp_destroy, utp_issue_deferred_acks, utp_process_icmp_error, utp_process_icmp_fragmentation, utp_process_udp } from "./symbols";
import type { UTPError, UTPFlags, UTPOptions, UTPState } from "./enums";

const contexts = new Map<Pointer, UTPContext>()

export class UTPContext {
    
    public handler?: {
        accept?: (socket: UTPSocket, address: UTPAddress) => void | number
        firewall?: (address: UTPAddress) => void | number
        read?: (socket: UTPSocket, buf: Uint8Array) => void | number
        state_change?: (socket: UTPSocket, state: UTPState) => void | number
        error?: (socket: UTPSocket, err: UTPError) => void | number
        send?: (socket: UTPSocket, buf: Uint8Array, address: UTPAddress, flags: UTPFlags) => void | number
        log?: (socket: UTPSocket, buf: string) => void | number
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
        //console.log('utp_destroy', this.handle)
        return utp_destroy(this.handle)
    }
    //set_callback(callback_name: UTPCallback, proc: unknown){}
    //set_userdata(userdata: unknown){}
    //get_userdata(){}
    set_option(opt: UTPOptions, val: number){
        //console.log('utp_context_set_option', this.handle, opt, val)
        return utp_context_set_option(this.handle, opt, val)
    }
    get_option(opt: UTPOptions){
        //console.log('utp_context_get_option', this.handle, opt)
        return utp_context_get_option(this.handle, opt)
    }
    process_udp(buf: Uint8Array, to: UTPAddress){
        //console.log('process_udp', this.handle, buf, buf.length, to.buffer, to.buffer.length)
        return utp_process_udp(this.handle, ptr(buf), buf.length, ptr(to.buffer), to.buffer.length)
    }
    process_icmp_error(buf: Uint8Array, to: UTPAddress){
        //console.log('utp_process_icmp_error', this.handle, buf, buf.length, to.buffer, to.buffer.length)
        return utp_process_icmp_error(this.handle, ptr(buf), buf.length, ptr(to.buffer), to.buffer.length)
    }
    process_icmp_fragmentation(buf: Uint8Array, to: UTPAddress, next_hop_mtu: number){
        //console.log('utp_process_icmp_fragmentation', this.handle, buf, buf.length, to.buffer, to.buffer.length, next_hop_mtu)
        return utp_process_icmp_fragmentation(this.handle, ptr(buf), buf.length, ptr(to.buffer), to.buffer.length, next_hop_mtu)
    }
    check_timeouts(){
        //console.log('utp_check_timeouts', this.handle)
        return utp_check_timeouts(this.handle)
    }
    issue_deferred_acks(){
        //console.log('utp_issue_deferred_acks', this.handle)
        return utp_issue_deferred_acks(this.handle)
    }
    //get_context_stats(){}
    create_socket(){
        //console.log('utp_create_socket', this.handle)
        const socket = utp_create_socket(this.handle)
        return UTPSocket.fromHandle(socket)
    }
}
