import type { MessageStream } from "@libp2p/interface"
import { pbStream as pbStream1, type ProtobufDecoder, type ProtobufEncoder, type ProtobufMessageStream } from "@libp2p/utils"

export type ReadonlyMessageStream<T, S extends MessageStream = MessageStream> = Pick<ProtobufMessageStream<T, S>, 'read' | 'unwrap'>
export type WriteonlyMessageStream<T, S extends MessageStream = MessageStream> = Pick<ProtobufMessageStream<T, S>, 'write' | 'writeV' | 'unwrap'>
export type ProtobufEncoderDecoder<T> = { encode: ProtobufEncoder<T>, decode: ProtobufDecoder<T> }

export { pbStream2 as pbStream }
function pbStream2<S extends MessageStream = MessageStream>(...args: Parameters<typeof pbStream1<S>>){
    const pbs = pbStream1<S>(...args)
    return Object.assign(pbs, {
        pb: <I, O>(
            inputDecoder: ProtobufEncoderDecoder<I>,
            outputEncoder: ProtobufEncoderDecoder<O>,
        ) => {
            const inputStream = pbs.pb(inputDecoder)
            const outputStream = pbs.pb(outputEncoder)
            return {
                read: inputStream.read,
                write: outputStream.write,
                writeV: outputStream.writeV,
                unwrap: () => pbs,
            }
        }
    })
}
