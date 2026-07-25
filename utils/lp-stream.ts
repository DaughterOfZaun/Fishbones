import { type AbortOptions, type Stream, TypedEventEmitter, StreamMessageEvent } from "@libp2p/interface"
import { LengthPrefixedDecoder, type LengthPrefixedDecoderInit } from "@libp2p/utils"
import { Uint8ArrayList } from "uint8arraylist"
import * as varint from 'uint8-varint'

export type LengthEncoderFunction = (value: number) => Uint8ArrayList | Uint8Array
export interface LengthPrefixedEncoderInit {
    lengthEncoder?: LengthEncoderFunction
}
export class LengthPrefixedEncoder {
    lengthEncoder: LengthEncoderFunction
    constructor(init: LengthPrefixedEncoderInit = {}){
        this.lengthEncoder = init.lengthEncoder ?? varint.encode
    }
    encode(data: Uint8ArrayList | Uint8Array){
        return new Uint8ArrayList(this.lengthEncoder(data.byteLength), data)
    }
}

export type LengthPrefixedStreamInit = LengthPrefixedEncoderInit & LengthPrefixedDecoderInit
//type LengthPrefixedStreamEvents = Pick<MessageStreamEvents, 'message'>
export type LengthPrefixedStreamEvents = {
    message: StreamMessageEvent
}
export class LengthPrefixedStream extends TypedEventEmitter<LengthPrefixedStreamEvents> {
    private stream: Stream
    private encoder: LengthPrefixedEncoder
    private decoder: LengthPrefixedDecoder
    constructor(stream: Stream, init: LengthPrefixedStreamInit = {}){
        super()
        this.stream = stream
        this.encoder = new LengthPrefixedEncoder(init)
        this.decoder = new LengthPrefixedDecoder(init)
        this.onMessage = this.onMessage.bind(this)
        this.stream.addEventListener('message', this.onMessage)
    }
    public send(data: Uint8ArrayList | Uint8Array){
        return this.stream.send(this.encoder.encode(data))
    }
    public close(opts?: AbortOptions){
        this.stream.removeEventListener('message', this.onMessage)
        return this.stream.close(opts)
    }
    private onMessage(event: StreamMessageEvent){
        for(const chunk of this.decoder.decode(event.data))
            this.safeDispatchEvent('message', new StreamMessageEvent(chunk))
    }
}
