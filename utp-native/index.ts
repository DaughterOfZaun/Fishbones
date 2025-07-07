
import { JSCallback, toBuffer, type Pointer } from "bun:ffi";

import * as utp_callback_arguments from './structs/utp_callback_arguments'
import { UTPContext } from "./context";
import { UTPSocket } from "./socket";
import { ptr_t, utp_init, utp_set_callback, void_t } from "./symbols";
import { UTPCallback } from "./enums";

const utp_callback_arguments_get_context = (args: Pointer) => UTPContext.fromHandle(utp_callback_arguments.get_context(args))
const utp_callback_arguments_get_socket = (args: Pointer) => UTPSocket.fromHandle(utp_callback_arguments.get_socket(args))
const utp_callback_arguments_get_buf = (args: Pointer) => toBuffer(utp_callback_arguments.get_buf(args), 0, utp_callback_arguments.get_len(args))
const utp_callback_arguments_get_address = (args: Pointer) => utp_callback_arguments.get_address(args)

const callback_log = new JSCallback((args: Pointer) => {
    console.log('callback_log')
    const socket = utp_callback_arguments_get_socket(args)
    const buf = toBuffer(utp_callback_arguments.get_buf(args)).toString('utf8')
    socket.handler?.log?.(buf)
}, { args: [ ptr_t /*args*/ ], returns: void_t })

const callback_sendto = new JSCallback((args: Pointer) => {
    console.log('callback_sendto')
    const socket = utp_callback_arguments_get_socket(args)
    const buf = utp_callback_arguments_get_buf(args)
    const address = utp_callback_arguments_get_address(args)
    const flags = utp_callback_arguments.get_flags(args)
    socket.handler?.send?.(buf, address, flags)
}, { args: [ ptr_t /*args*/ ], returns: void_t })

const callback_on_error = new JSCallback((args: Pointer) => {
    console.log('callback_on_error')
    const socket = utp_callback_arguments_get_socket(args)
    const error_code = utp_callback_arguments.get_error_code(args)
    socket.handler?.error?.(error_code)
}, { args: [ ptr_t /*args*/ ], returns: void_t })

const callback_on_state_change = new JSCallback((args: Pointer) => {
    console.log('callback_on_state_change')
    const socket = utp_callback_arguments_get_socket(args)
    const state = utp_callback_arguments.get_state(args)
    socket.handler?.state_change?.(state)
}, { args: [ ptr_t /*args*/ ], returns: void_t })

const callback_on_read = new JSCallback((args: Pointer) => {
    console.log('callback_on_read')
    const socket = utp_callback_arguments_get_socket(args)
    const buf = utp_callback_arguments_get_buf(args)
    socket.handler?.read?.(buf)
}, { args: [ ptr_t /*args*/ ], returns: void_t })

const callback_on_firewall = new JSCallback((args: Pointer) => {
    console.log('callback_on_firewall')
    const context = utp_callback_arguments_get_context(args)
    const address = utp_callback_arguments_get_address(args)
    context.handler?.firewall?.(address)
}, { args: [ ptr_t /*args*/ ], returns: void_t })

const callback_on_accept = new JSCallback((args: Pointer) => {
    console.log('callback_on_accept')
    const context = utp_callback_arguments_get_context(args)
    const socket = utp_callback_arguments_get_socket(args)
    const address = utp_callback_arguments_get_address(args)
    context.handler?.accept?.(socket, address)
}, { args: [ ptr_t /*args*/ ], returns: void_t })

export const init = (version = 2) => {
    const handle = utp_init(version)!
    const context = UTPContext.fromHandle(handle)
    
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