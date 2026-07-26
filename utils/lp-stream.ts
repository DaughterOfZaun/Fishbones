import { type AbortOptions, type Stream, StreamMessageEvent } from "@libp2p/interface"
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

export class LengthPrefixedStream {
    private stream: Stream
    private encoder: LengthPrefixedEncoder
    private decoder: LengthPrefixedDecoder
    public ondata?: (data: Uint8Array | Uint8ArrayList) => void
    public onerror?: (err: Error) => void
    public onclose?: () => void
    constructor(stream: Stream, init: LengthPrefixedStreamInit = {}){
        this.stream = stream
        this.encoder = new LengthPrefixedEncoder(init)
        this.decoder = new LengthPrefixedDecoder(init)
        this.stream.addEventListener('message', (event) => {
            for(const chunk of this.decoder.decode(event.data)) try {
                this.ondata?.(chunk)
            } catch(err) {
                this.onerror?.(err as Error)
            }
        })
        this.stream.addEventListener('close', (event) => {
            if(event.error)
                this.onerror?.(event.error)
            this.onclose?.()
        })
        this.stream.addEventListener('remoteCloseWrite', (event) => {
            this.onclose?.()
        })
    }
    public send(data: Uint8ArrayList | Uint8Array){
        try {
            return this.stream.send(this.encoder.encode(data))
        } catch(err){
            this.onerror?.(err as Error)
            return false
        }
    }
    public close(opts?: AbortOptions){
        this.stream.close(opts).catch((err) => {
            this.onerror?.(err)
        })
    }
}
