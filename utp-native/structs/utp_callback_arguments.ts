import { type Pointer, read } from 'bun:ffi'

/*
typedef struct {
    utp_context *context;
    utp_socket *socket;
    size_t len;
    uint32 flags;
    int callback_type;
    const byte *buf;

    union {
        const struct sockaddr *address;
        int send;
        int sample_ms;
        int error_code;
        int state;
    };

    union {
        socklen_t address_len;
        int type;
    };
} utp_callback_arguments;
*/

const bits = 64 as const
const sizeof_ptr_t = bits / 8
const sizeof_size_t = bits / 8
const sizeof_uint32 = 32 / 8
const sizeof_int = 32 / 8

let offset = 0
const context_offset = offset; offset += sizeof_ptr_t; export const get_context = (args: Pointer) => read.ptr(args, context_offset) as Pointer
const socket_offset = offset; offset += sizeof_ptr_t; export const get_socket = (args: Pointer) => read.ptr(args, socket_offset) as Pointer
const len_offset = offset; offset += sizeof_size_t; export const get_len = (args: Pointer) => read[`u${bits}`](args, len_offset)
const flags_offset = offset; offset += sizeof_uint32; export const get_flags = (args: Pointer) => read.u32(args, flags_offset)
const callback_type_offset = offset; offset += sizeof_int; export const get_callback_type = (args: Pointer) => read.i32(args, callback_type_offset)
const buf_offset = offset; offset += sizeof_ptr_t; export const get_buf = (args: Pointer) => read.ptr(args, buf_offset) as Pointer

const first_union_offset = offset;
offset = Math.max(offset, first_union_offset + sizeof_ptr_t); export const get_address = (args: Pointer) => read.ptr(args, first_union_offset) as Pointer
offset = Math.max(offset, first_union_offset + sizeof_int); export const get_send = (args: Pointer) => read.i32(args, first_union_offset)
offset = Math.max(offset, first_union_offset + sizeof_int); export const get_sample_ms = (args: Pointer) => read.i32(args, first_union_offset)
offset = Math.max(offset, first_union_offset + sizeof_int); export const get_error_code = (args: Pointer) => read.i32(args, first_union_offset)
offset = Math.max(offset, first_union_offset + sizeof_int); export const get_state = (args: Pointer) => read.i32(args, first_union_offset)

const second_union_offset = offset;
offset = Math.max(offset, second_union_offset + sizeof_uint32); export const get_address_len = (args: Pointer) => read.u32(args, second_union_offset)
offset = Math.max(offset, second_union_offset + sizeof_int); export const get_type = (args: Pointer) => read.i32(args, second_union_offset)
