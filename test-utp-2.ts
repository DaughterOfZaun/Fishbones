import os from 'node:os'

import { dlopen, JSCallback, read, toArrayBuffer, toBuffer, type Pointer } from "bun:ffi";
const int = 'int' as const
const ptr_t = 'ptr' as const
const void_t = 'void' as const
const ssize_t = 'int32_t' as const
const size_t = 'uint32_t' as const
const socklen_t = 'uint32_t' as const
const uint16 = 'uint16_t' as const
const callback = 'callback' as const

let src = `
utp_context*	utp_init						(int version);
void			utp_destroy						(utp_context *ctx);
void			utp_set_callback				(utp_context *ctx, int callback_name, utp_callback_t *proc);
void*			utp_context_set_userdata		(utp_context *ctx, void *userdata);
void*			utp_context_get_userdata		(utp_context *ctx);
int				utp_context_set_option			(utp_context *ctx, int opt, int val);
int				utp_context_get_option			(utp_context *ctx, int opt);
int				utp_process_udp					(utp_context *ctx, const byte *buf, size_t len, const struct sockaddr *to, socklen_t tolen);
int				utp_process_icmp_error			(utp_context *ctx, const byte *buffer, size_t len, const struct sockaddr *to, socklen_t tolen);
int				utp_process_icmp_fragmentation	(utp_context *ctx, const byte *buffer, size_t len, const struct sockaddr *to, socklen_t tolen, uint16 next_hop_mtu);
void			utp_check_timeouts				(utp_context *ctx);
void			utp_issue_deferred_acks			(utp_context *ctx);
utp_context_stats* utp_get_context_stats		(utp_context *ctx);
utp_socket*		utp_create_socket				(utp_context *ctx);
void*			utp_set_userdata				(utp_socket *s, void *userdata);
void*			utp_get_userdata				(utp_socket *s);
int				utp_setsockopt					(utp_socket *s, int opt, int val);
int				utp_getsockopt					(utp_socket *s, int opt);
int				utp_connect						(utp_socket *s, const struct sockaddr *to, socklen_t tolen);
ssize_t			utp_write						(utp_socket *s, void *buf, size_t count);
ssize_t			utp_writev						(utp_socket *s, struct utp_iovec *iovec, size_t num_iovecs);
int				utp_getpeername					(utp_socket *s, struct sockaddr *addr, socklen_t *addrlen);
void			utp_read_drained				(utp_socket *s);
int				utp_get_delays					(utp_socket *s, uint32 *ours, uint32 *theirs, uint32 *age);
utp_socket_stats* utp_get_stats					(utp_socket *s);
utp_context*	utp_get_context					(utp_socket *s);
void			utp_shutdown					(utp_socket *s, int how);
void			utp_close						(utp_socket *s);
`

type ReplaceCallback = (...args: string[]) => string
const bindgen = () => {
    src = src.replace(/(?<type>\w+)(?<typeIsPtr>\*)?\s+(?<name>\w+)\s*\((?<args>.*)\);/gm, ((m, type, typeIsPtr, name, args) => {
        args = args.split(', ').map(arg => arg.replace(/(?:const )?(?:struct )?(?<type>\w+) (?<typeIsPtr>\*)?(?<name>\w+)/, ((m, type, typeIsPtr, name) => {
            return `${typeIsPtr ? 'ptr_t' : type.replace('void', 'voidt')} /*${name}*/`
        }) as ReplaceCallback)).join(', ')
        return `${name}: { args: [${args}], returns: ${typeIsPtr ? 'ptr_t' : type.replace('void', 'void_t')} },`
    }) as ReplaceCallback)
    console.log(src)
}
if(Math.random() == 1)
    bindgen()

const {
    symbols: {
        utp_init,
        utp_destroy,
        utp_set_callback,
        utp_context_set_userdata,
        utp_context_get_userdata,
        utp_context_set_option,
        utp_context_get_option,
        utp_process_udp,
        utp_process_icmp_error,
        utp_process_icmp_fragmentation,
        utp_check_timeouts,
        utp_issue_deferred_acks,
        utp_get_context_stats,
        utp_create_socket,
        utp_set_userdata,
        utp_get_userdata,
        utp_setsockopt,
        utp_getsockopt,
        utp_connect,
        utp_write,
        utp_writev,
        utp_getpeername,
        utp_read_drained,
        utp_get_delays,
        utp_get_stats,
        utp_get_context,
        utp_shutdown,
        utp_close,
    },
    close
} = dlopen(
    `./node_modules/utp-native/prebuilds/linux-x64/node.napi.node`,
    {
        utp_init: { args: [int /*version*/] as const, returns: ptr_t },
        utp_destroy: { args: [ptr_t /*ctx*/] as const, returns: void_t },
        utp_set_callback: { args: [ptr_t /*ctx*/, int /*callback_name*/, callback /*proc*/] as const, returns: void_t },
        utp_context_set_userdata: { args: [ptr_t /*ctx*/, ptr_t /*userdata*/] as const, returns: ptr_t },
        utp_context_get_userdata: { args: [ptr_t /*ctx*/] as const, returns: ptr_t },
        utp_context_set_option: { args: [ptr_t /*ctx*/, int /*opt*/, int /*val*/] as const, returns: int },
        utp_context_get_option: { args: [ptr_t /*ctx*/, int /*opt*/] as const, returns: int },
        utp_process_udp: { args: [ptr_t /*ctx*/, ptr_t /*buf*/, size_t /*len*/, ptr_t /*to*/, socklen_t /*tolen*/] as const, returns: int },
        utp_process_icmp_error: { args: [ptr_t /*ctx*/, ptr_t /*buffer*/, size_t /*len*/, ptr_t /*to*/, socklen_t /*tolen*/] as const, returns: int },
        utp_process_icmp_fragmentation: { args: [ptr_t /*ctx*/, ptr_t /*buffer*/, size_t /*len*/, ptr_t /*to*/, socklen_t /*tolen*/, uint16 /*next_hop_mtu*/] as const, returns: int },
        utp_check_timeouts: { args: [ptr_t /*ctx*/] as const, returns: void_t },
        utp_issue_deferred_acks: { args: [ptr_t /*ctx*/] as const, returns: void_t },
        utp_get_context_stats: { args: [ptr_t /*ctx*/] as const, returns: ptr_t },
        utp_create_socket: { args: [ptr_t /*ctx*/] as const, returns: ptr_t },
        utp_set_userdata: { args: [ptr_t /*s*/, ptr_t /*userdata*/] as const, returns: ptr_t },
        utp_get_userdata: { args: [ptr_t /*s*/] as const, returns: ptr_t },
        utp_setsockopt: { args: [ptr_t /*s*/, int /*opt*/, int /*val*/] as const, returns: int },
        utp_getsockopt: { args: [ptr_t /*s*/, int /*opt*/] as const, returns: int },
        utp_connect: { args: [ptr_t /*s*/, ptr_t /*to*/, socklen_t /*tolen*/] as const, returns: int },
        utp_write: { args: [ptr_t /*s*/, ptr_t /*buf*/, size_t /*count*/] as const, returns: ssize_t },
        utp_writev: { args: [ptr_t /*s*/, ptr_t /*iovec*/, size_t /*num_iovecs*/] as const, returns: ssize_t },
        utp_getpeername: { args: [ptr_t /*s*/, ptr_t /*addr*/, ptr_t /*addrlen*/] as const, returns: int },
        utp_read_drained: { args: [ptr_t /*s*/] as const, returns: void_t },
        utp_get_delays: { args: [ptr_t /*s*/, ptr_t /*ours*/, ptr_t /*theirs*/, ptr_t /*age*/] as const, returns: int },
        utp_get_stats: { args: [ptr_t /*s*/] as const, returns: ptr_t },
        utp_get_context: { args: [ptr_t /*s*/] as const, returns: ptr_t },
        utp_shutdown: { args: [ptr_t /*s*/, int /*how*/] as const, returns: void_t },
        utp_close: { args: [ptr_t /*s*/] as const, returns: void_t },
    }
)

enum UTPCallback {
    ON_FIREWALL = 0,
    ON_ACCEPT,
    ON_CONNECT,
    ON_ERROR,
    ON_READ,
    ON_OVERHEAD_STATISTICS,
    ON_STATE_CHANGE,
    GET_READ_BUFFER_SIZE,
    ON_DELAY_SAMPLE,
    GET_UDP_MTU,
    GET_UDP_OVERHEAD,
    GET_MILLISECONDS,
    GET_MICROSECONDS,
    GET_RANDOM,
    LOG,
    SENDTO,
}

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
const sizeof_uint32 = 32 / 8
const sizeof_int = 32 / 8
const utp_callback_arguments = {
    get_context(args: Pointer) { return UTPContext.fromHandle(read.ptr(args, 0) as Pointer) }, // sizeof_ptr_t
    get_socket(args: Pointer) { return UTPSocket.fromHandle(read.ptr(args, sizeof_ptr_t) as Pointer) }, // sizeof_ptr_t
    //get_len(args: Pointer) { return read[`i${bits}`](args, sizeof_ptr_t * 2) }, // sizeof_ptr_t
    get_flags(args: Pointer) { return read.u32(args, sizeof_ptr_t * 3) }, // sizeof_uint32
    get_callback_type(args: Pointer) { return read.i32(args, sizeof_ptr_t * 3 + sizeof_uint32) }, // sizeof_int
    get_buf(args: Pointer) {
        const ptr = read.ptr(args, sizeof_ptr_t * 3 + sizeof_uint32 + sizeof_int) as Pointer
        const len = read[`i${bits}`](args, sizeof_ptr_t * 2) //get_len(args)
        return toBuffer(ptr, 0, Number(len))
    }, // sizeof_ptr_t

    get_state(args: Pointer){ return read.i32(args, sizeof_ptr_t * 3 + sizeof_uint32 + sizeof_int + sizeof_ptr_t) },
    get_error_code(args: Pointer){ return read.i32(args, sizeof_ptr_t * 3 + sizeof_uint32 + sizeof_int + sizeof_ptr_t) },
    get_address(args: Pointer){ return read.ptr(args, sizeof_ptr_t * 3 + sizeof_uint32 + sizeof_int + sizeof_ptr_t) as Pointer },
}

const contexts = new Map<Pointer, UTPContext>()
const sockets = new Map<Pointer, UTPSocket>()

const callback_log = new JSCallback((args: Pointer) => {
    console.log('callback_log')
}, { args: [ ptr_t /*args*/ ], returns: void_t })

const callback_sendto = new JSCallback((args: Pointer) => {
    console.log('callback_sendto')
    const socket = utp_callback_arguments.get_socket(args)
    const buf = utp_callback_arguments.get_buf(args)
    const address = utp_callback_arguments.get_address(args)
    const flags = utp_callback_arguments.get_flags(args)
    socket.handler?.send?.(buf, address, flags)
}, { args: [ ptr_t /*args*/ ], returns: void_t })

const callback_on_error = new JSCallback((args: Pointer) => {
    console.log('callback_on_error')
    const socket = utp_callback_arguments.get_socket(args)
    const error_code = utp_callback_arguments.get_error_code(args)
    socket.handler?.error?.(error_code)
}, { args: [ ptr_t /*args*/ ], returns: void_t })

const callback_on_state_change = new JSCallback((args: Pointer) => {
    console.log('callback_on_state_change')
    const socket = utp_callback_arguments.get_socket(args)
    const state = utp_callback_arguments.get_state(args)
    socket.handler?.state_change?.(state)
}, { args: [ ptr_t /*args*/ ], returns: void_t })

const callback_on_read = new JSCallback((args: Pointer) => {
    console.log('callback_on_read')
    const socket = utp_callback_arguments.get_socket(args)
    const buf = utp_callback_arguments.get_buf(args)
    socket.handler?.read?.(buf)
}, { args: [ ptr_t /*args*/ ], returns: void_t })

const callback_on_firewall = new JSCallback((args: Pointer) => {
    console.log('callback_on_firewall')
    const context = utp_callback_arguments.get_context(args)
    const address = utp_callback_arguments.get_address(args)
    context.handler?.firewall?.(address)
}, { args: [ ptr_t /*args*/ ], returns: void_t })

const callback_on_accept = new JSCallback((args: Pointer) => {
    console.log('callback_on_accept')
    const context = utp_callback_arguments.get_context(args)
    const socket = utp_callback_arguments.get_socket(args)
    const address = utp_callback_arguments.get_address(args)
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

class UTPAddress {

}

class UTPContext {
    public handler?: {
        accept?: (socket: UTPSocket) => void
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
}

enum UTPError {
	CONNREFUSED = 0,
	CONNRESET,
	TIMEDOUT,
}

enum UTPState {
    CONNECT = 1,
    WRITABLE = 2,
    EOF = 3,
    DESTROYING = 4,
}

class UTPSocket {
    public handler?: {
        read?: (buf: Buffer) => void
        state_change?: (state: UTPState) => void
        error?: (err: UTPError) => void
        send?: (buf: Buffer, address: UTPAddress, flags: UTPFlags) => void
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
}

console.log('begin')

const ctx = init()

enum AddressFamily {
    INET = 2,
    INET6 = 10,
}

type BELE = 'BE' | 'LE'
const BELE: BELE = os.endianness()
Buffer.prototype.writeUint16 = Buffer.prototype[`writeUint16${BELE}`]
type BufferType = ReturnType<(typeof Buffer<ArrayBuffer>)['alloc']>
declare global {
    interface Buffer {
        writeUint16: BufferType[`writeUint16${BELE}`]
    }
}

const SOCKADDR_STORAGE_SIZE = 128
const addr = Buffer.alloc(SOCKADDR_STORAGE_SIZE)
addr.writeUint16(AddressFamily.INET, 0)
addr.writeUint8(127, 2)
addr.writeUint8(0, 3)
addr.writeUint8(0, 4)
addr.writeUint8(1, 5)

const addrlen = 16 // 28 for IPv6
utp_connect(socket, addr, addrlen)

utp_destroy(ctx)

console.log('end')
