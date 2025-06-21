import { pbStream as pbStreamOrig, type Decoder, type Encoder, type ProtobufStream } from 'it-protobuf-stream'
import type { Duplex } from 'it-stream-types'

type DecoderProto<T> = { decode: Decoder<T> }
type EncoderProto<T> = { encode: Encoder<T> }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDuplex = Duplex<any, any, any>

type AbortOptions = { signal: AbortSignal }

//// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type ReadonlyMessageStream<I, S> = {
    read: (options?: AbortOptions) => Promise<I>
    unwrap: () => ProtobufStream<S>
}

//// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type WriteonlyMessageStream<O, S> = {
    write: (data: O, options?: AbortOptions) => Promise<void>,
    writeV: (data: O[], options?: AbortOptions) => Promise<void>,
    unwrap: () => ProtobufStream<S>
}

export type MessageStream<I, O, S> = {
    read: (options?: AbortOptions) => Promise<I>
    write: (data: O, options?: AbortOptions) => Promise<void>,
    writeV: (data: O[], options?: AbortOptions) => Promise<void>,
    unwrap: () => ProtobufStream<S>
}

export
function pbStream<S extends AnyDuplex>
(...args: Parameters<typeof pbStreamOrig<S>>)
{
    //const [duplex, options] = args
    const W = pbStreamOrig(...args)
    return Object.assign(W, {
        pb: <I, O>(
                inProto: DecoderProto<I>,
                outProto: EncoderProto<O> //= inProto as unknown as EncoderProto<O>
            ): MessageStream<I, O, S> => ({
            read: (options?: AbortOptions) => W.read(inProto, options),
            write: (data: O, options?: AbortOptions) => W.write(data, outProto, options),
            writeV: (data: O[], options?: AbortOptions) => W.writeV(data, outProto, options),
            unwrap: () => W
        })
    })
}
