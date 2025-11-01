import * as utp_callback_arguments from './structs/utp_callback_arguments'
import { UTPContext } from "./context";
import { UTPSocket } from "./socket";
import { utp_init, utp_set_callback } from "./symbols";
import { asPointer, JSCallback, ptr_t, toBuffer, uint64, type Pointer } from "./ffi";
import { UTPCallback } from "./enums";
import { UTPAddress } from "./address";

const utp_callback_arguments_get_context = (args: Pointer) => UTPContext.fromHandle(utp_callback_arguments.get_context(args))
const utp_callback_arguments_get_socket = (args: Pointer) => UTPSocket.fromHandle(utp_callback_arguments.get_socket(args))
const utp_callback_arguments_get_buf = (args: Pointer) => {
    const buf_ptr = utp_callback_arguments.get_buf(args)
    //console.log('utp_callback_arguments_get_buf', 'ptr', buf_ptr)
    const len = utp_callback_arguments.get_len(args)
    //console.log('utp_callback_arguments_get_buf', 'len', len)
    const buf = toBuffer(buf_ptr, 0, len)
    //console.log('utp_callback_arguments_get_buf', 'buf', buf)
    return buf
}
const utp_callback_arguments_get_address = (args: Pointer) => UTPAddress.fromPointer(utp_callback_arguments.get_address(args))

const callback_definition = { args: [ptr_t /*args*/] as const, returns: uint64 }

const callback_log = new JSCallback((args: Pointer) => {
    args = asPointer(args)
    //console.log('callback_log')
    const context = utp_callback_arguments_get_context(args)
    const socket = utp_callback_arguments_get_socket(args)
    const buf = toBuffer(utp_callback_arguments.get_buf(args)).toString('utf8')
    return context.handler?.log?.(socket, buf) ?? 0
}, callback_definition)

const callback_sendto = new JSCallback((args: Pointer) => {
    args = asPointer(args)
    //console.log('callback_sendto')
    const context = utp_callback_arguments_get_context(args)
    const socket = utp_callback_arguments_get_socket(args)
    const buf = utp_callback_arguments_get_buf(args)
    const address = utp_callback_arguments_get_address(args)
    const flags = utp_callback_arguments.get_flags(args)
    return context.handler?.send?.(socket, buf, address, flags) ?? 0
}, callback_definition)

const callback_on_error = new JSCallback((args: Pointer) => {
    args = asPointer(args)
    //console.log('callback_on_error')
    const context = utp_callback_arguments_get_context(args)
    const socket = utp_callback_arguments_get_socket(args)
    const error_code = utp_callback_arguments.get_error_code(args)
    return context.handler?.error?.(socket, error_code) ?? 0
}, callback_definition)

const callback_on_state_change = new JSCallback((args: Pointer) => {
    args = asPointer(args)
    //console.log('callback_on_state_change')
    const context = utp_callback_arguments_get_context(args)
    const socket = utp_callback_arguments_get_socket(args)
    const state = utp_callback_arguments.get_state(args)
    return context.handler?.state_change?.(socket, state) ?? 0
}, callback_definition)

const callback_on_read = new JSCallback((args: Pointer) => {
    args = asPointer(args)
    //console.log('callback_on_read')
    const context = utp_callback_arguments_get_context(args)
    const socket = utp_callback_arguments_get_socket(args)
    const buf = utp_callback_arguments_get_buf(args)
    return context.handler?.read?.(socket, buf) ?? 0
}, callback_definition)

const callback_on_firewall = new JSCallback((args: Pointer) => {
    args = asPointer(args)
    //console.log('callback_on_firewall')
    const context = utp_callback_arguments_get_context(args)
    const address = utp_callback_arguments_get_address(args)
    return context.handler?.firewall?.(address) ?? 0
}, callback_definition)

const callback_on_accept = new JSCallback((args: Pointer) => {
    args = asPointer(args)
    //console.log('callback_on_accept')
    const context = utp_callback_arguments_get_context(args)
    const socket = utp_callback_arguments_get_socket(args)
    const address = utp_callback_arguments_get_address(args)
    return context.handler?.accept?.(socket, address) ?? 0
}, callback_definition)

export const init = (version = 2, handler?: UTPContext['handler']) => {
    //console.log('utp_init', version)
    const handle = utp_init(version)
    const context = UTPContext.fromHandle(handle)
    context.handler = handler

    //console.log('utp_set_callback', handle)
    utp_set_callback(handle, UTPCallback.LOG, callback_log.ptr);
    utp_set_callback(handle, UTPCallback.SENDTO, callback_sendto.ptr);
    utp_set_callback(handle, UTPCallback.ON_ERROR, callback_on_error.ptr);
    utp_set_callback(handle, UTPCallback.ON_STATE_CHANGE, callback_on_state_change.ptr);
    utp_set_callback(handle, UTPCallback.ON_READ, callback_on_read.ptr);
    utp_set_callback(handle, UTPCallback.ON_FIREWALL, callback_on_firewall.ptr);
    utp_set_callback(handle, UTPCallback.ON_ACCEPT, callback_on_accept.ptr);

    return context
}

export default { init }
