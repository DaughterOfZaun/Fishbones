import type { AbortOptions, MessageStream, Stream } from "@libp2p/interface"
import { pbStream as pbStream1, type ProtobufDecoder, type ProtobufEncoder, type ProtobufMessageStream, type ProtobufStreamOpts } from "@libp2p/utils"

export type ReadonlyMessageStream<T, S extends MessageStream = MessageStream> = Pick<ProtobufMessageStream<T, S>, 'read' | 'unwrap'> & { iter(): AsyncGenerator<Awaited<T>, void, unknown> }
export type WriteonlyMessageStream<T, S extends MessageStream = MessageStream> = Pick<ProtobufMessageStream<T, S>, 'write' | 'writeV' | 'unwrap'>
export type ProtobufEncoderDecoder<T> = { encode: ProtobufEncoder<T>, decode: ProtobufDecoder<T> }

export { pbStream2 as pbStream }
function pbStream2<S extends Stream>(stream: S, opts?: Partial<ProtobufStreamOpts>){
    const pbStream = pbStream1<S>(stream, opts)
    const pb = pbStream.pb.bind(pbStream)
    return Object.assign(pbStream, {
        pb: <I, O>(
            inputDecoder: ProtobufEncoderDecoder<I>,
            outputEncoder: ProtobufEncoderDecoder<O>,
        ) => {
            const inputStream = pb(inputDecoder)
            const outputStream = pb(outputEncoder)
            return {
                read: inputStream.read,
                write: outputStream.write,
                writeV: outputStream.writeV,
                unwrap: () => pbStream,
                iter: () => iter(stream, inputStream)
            }
        }
    })
}

export async function * iter<T>(stream: Stream, wrapped: { read(opts?: AbortOptions): Promise<T> }, opts?: AbortOptions){
    
    for(;;){
        yield await wrapped.read(opts)
    }

    //const onRemoteCloseWrite = (): void => {
    //    source.end()
    //    stream.removeEventListener('message', onMessage)
    //    stream.removeEventListener('close', onClose)
    //    stream.removeEventListener('remoteCloseWrite', onRemoteCloseWrite)
    //}
    //const onClose = (evt: StreamCloseEvent): void => {
    //    source.end(evt.error)
    //    if (evt.error != null) {
    //    onError?.reject(evt.error)
    //    }
    //    stream.removeEventListener('message', onMessage)
    //    stream.removeEventListener('close', onClose)
    //    stream.removeEventListener('remoteCloseWrite', onRemoteCloseWrite)
    //}
    //stream.addEventListener('message', onMessage)
    //stream.addEventListener('close', onClose, {
    //    once: true
    //})
    //stream.addEventListener('remoteCloseWrite', onRemoteCloseWrite, {
    //    once: true
    //})
}
