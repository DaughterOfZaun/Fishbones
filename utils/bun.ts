import dgram from 'node:dgram'

interface BinaryTypeList {
    //arraybuffer: ArrayBuffer;
    buffer: Buffer;
    //uint8array: Uint8Array<ArrayBuffer>;
}
type BinaryType = keyof BinaryTypeList;

export interface SocketOptions<DataBinaryType extends BinaryType = 'buffer'> {
    hostname?: string;
    port?: number;
    binaryType?: DataBinaryType;
    socket?: SocketHandler<DataBinaryType>;
}

export interface ReceiveFlags {
    truncated: boolean;
}

export interface SocketHandler<DataBinaryType extends BinaryType = 'buffer'> {
    data?(
        socket: Socket<DataBinaryType>,
        data: BinaryTypeList[DataBinaryType],
        port: number,
        address: string,
        flags: ReceiveFlags,
    ): void | Promise<void>;
    drain?(socket: Socket<DataBinaryType>): void | Promise<void>;
    error?(socket: Socket<DataBinaryType>, error: Error): void | Promise<void>;
}

interface SocketAddress {
    address: string;
    port: number;
    family: "IPv4" | "IPv6";
}

export interface BaseUDPSocket {
    readonly hostname: string;
    readonly port: number;
    readonly address: SocketAddress;
    readonly binaryType: BinaryType;
    readonly closed: boolean;
    //ref(): void;
    //unref(): void;
    close(): void;
    //setBroadcast(enabled: boolean): boolean;
    //setTTL(ttl: number): number;
    //setMulticastTTL(ttl: number): number;
    //setMulticastLoopback(enabled: boolean): boolean;
    //setMulticastInterface(interfaceAddress: string): boolean;
    //addMembership(multicastAddress: string, interfaceAddress?: string): boolean;
    //dropMembership(multicastAddress: string, interfaceAddress?: string): boolean;
    //addSourceSpecificMembership(sourceAddress: string, groupAddress: string, interfaceAddress?: string): boolean;
    //dropSourceSpecificMembership(sourceAddress: string, groupAddress: string, interfaceAddress?: string): boolean;
}

//type Data = string | ArrayBufferView | ArrayBufferLike
//type Data = string | NodeJS.ArrayBufferView | readonly any[]
type Data = Buffer | Uint8Array

export interface Socket<DataBinaryType extends BinaryType = 'buffer'> extends BaseUDPSocket {
    sendMany(packets: readonly (Data | string | number)[]): number;
    send(data: Data, port: number, address: string): boolean;
    reload(handler: SocketHandler<DataBinaryType>): void;
}

export async function udpSocket<DataBinaryType extends BinaryType = 'buffer'>(options: SocketOptions<DataBinaryType>): Promise<Socket<DataBinaryType>> {

    const server = dgram.createSocket('udp4')

    let { hostname, port, socket: handler } = options
    hostname ??= '0.0.0.0'
    handler ??= {}
    port ??= 0

    let resolve: (res: Socket<DataBinaryType>) => void = undefined!
    let reject: (err: Error) => void = undefined!
    let cleanup: () => true = undefined!

    const onlistening = () => {
        const wrapper = new Wrapper<DataBinaryType>(server, hostname, port, handler)
        cleanup() && resolve(wrapper)
    }
    const onerror = (err: Error) => {
        cleanup() && reject(err)
    }

    server.addListener('listening', onlistening)
    server.addListener('error', onerror)
    cleanup = () => {
        server.removeListener('listening', onlistening)
        server.removeListener('error', onerror)
        return true
    }

    const promise = new Promise<Socket<DataBinaryType>>((res, rej) => {
        resolve = res
        reject = rej
    })
    
    server.bind(port, hostname)

    return promise
}

class Wrapper<DataBinaryType extends BinaryType = 'buffer'> implements Socket<DataBinaryType> {
    
    public get binaryType(): BinaryType { return "buffer" }
    public get address(): SocketAddress {
        const { address, port, family } = this.server.address()
        const familyTyped = family as SocketAddress['family']
        console.assert(
            familyTyped == 'IPv4' || familyTyped == 'IPv6',
            `Assertion falied: server.address.family is not IPv4 or IPv6`
        )
        return { address, port, family: familyTyped }
    }

    private _closed: boolean = false
    public get closed(){ return this._closed }
    private set closed(to: boolean){ this._closed = to }

    //TODO: Can (and should) address, hostname and port be cached?
    public get hostname(){ return this.server.address().address }
    public get port(){ return this.server.address().port }

    constructor(
        private readonly server: dgram.Socket,
        hostname: string,
        port: number,
        private handler: SocketHandler<DataBinaryType>,
    ){
        this.server.addListener('message', (data, rinfo) => {
            this.handler.data?.(this, data, rinfo.port, rinfo.address, undefined!)
        })
        this.server.addListener('error', (err) => {
            this.handler.error?.(this, err)
        })
    }

    public sendMany(packets: readonly (Data | string | number)[]): number {
        throw new Error("Method not implemented.");
    }

    public send(data: Data, port: number, address: string): boolean {
        let success = true
        this.server.send(data, port, address, (err, bytes) => { success = !err && bytes == data.length })
        return success
    }

    public reload(handler: SocketHandler<DataBinaryType>): void {
        this.handler = handler
    }
    
    public close(): void {
        this.server.close()
        this.closed = true
    }
}
