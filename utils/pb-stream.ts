import type { AbortOptions, MessageStream, Stream, StreamCloseEvent } from "@libp2p/interface"
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
                iter: (opts?: AbortOptions) => {
                    return iter(stream, inputStream, opts)
                }
            }
        }
    })
}

export async function * iter<T>(stream: Stream, wrapped: { read(opts?: AbortOptions): Promise<T> }, opts?: AbortOptions){
    
    let throwException = true
    const controller = new AbortController()

    stream.addEventListener('close', onclose)
    stream.addEventListener('remoteCloseWrite', onclose)
    opts?.signal?.addEventListener('abort', onabort)
    function cleanup(){
        stream.removeEventListener('close', onclose)
        stream.removeEventListener('remoteCloseWrite', onclose)
        opts?.signal?.removeEventListener('abort', onabort)
        return true
    }
    function onclose(evt?: StreamCloseEvent){
        cleanup()
        throwException = !!evt?.error
        controller.abort(evt?.error)
    }
    function onabort(){
        cleanup()
        throwException = true
        controller.abort(opts?.signal?.reason)
    }

    for(;;){
        try {
            yield await wrapped.read(opts)
        } catch(err) {
            if(throwException)
                throw err
            break
        }
    }
}
