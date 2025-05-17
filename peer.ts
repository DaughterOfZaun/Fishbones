/* eslint-disable import/export */
/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unnecessary-boolean-literal-compare */
/* eslint-disable @typescript-eslint/no-empty-interface */

import { type Codec, decodeMessage, type DecodeOptions, encodeMessage, MaxLengthError, message } from 'protons-runtime'
import { alloc as uint8ArrayAlloc } from 'uint8arrays/alloc'
import type { Uint8ArrayList } from 'uint8arraylist'

export interface Peer {
  publicKey: Uint8Array
  addrs: Uint8Array[]
  data?: Peer.AdditionalData
}

export namespace Peer {
  export interface AdditionalData {
    name: string
    serverSettings?: Peer.AdditionalData.ServerSettings
    gameInfos: Peer.AdditionalData.GameInfo[]
  }

  export namespace AdditionalData {
    export interface ServerSettings {
      name: string
      maps: number
      modes: number
      tickRate: number
      champions: number[]
    }

    export namespace ServerSettings {
      let _codec: Codec<ServerSettings>

      export const codec = (): Codec<ServerSettings> => {
        if (_codec == null) {
          _codec = message<ServerSettings>((obj, w, opts = {}) => {
            if (opts.lengthDelimited !== false) {
              w.fork()
            }

            if ((obj.name != null && obj.name !== '')) {
              w.uint32(10)
              w.string(obj.name)
            }

            if ((obj.maps != null && obj.maps !== 0)) {
              w.uint32(21)
              w.fixed32(obj.maps)
            }

            if ((obj.modes != null && obj.modes !== 0)) {
              w.uint32(29)
              w.fixed32(obj.modes)
            }

            if ((obj.tickRate != null && obj.tickRate !== 0)) {
              w.uint32(32)
              w.uint32(obj.tickRate)
            }

            if (obj.champions != null) {
              for (const value of obj.champions) {
                w.uint32(45)
                w.fixed32(value)
              }
            }

            if (opts.lengthDelimited !== false) {
              w.ldelim()
            }
          }, (reader, length, opts = {}) => {
            const obj: any = {
              name: '',
              maps: 0,
              modes: 0,
              tickRate: 0,
              champions: []
            }

            const end = length == null ? reader.len : reader.pos + length

            while (reader.pos < end) {
              const tag = reader.uint32()

              switch (tag >>> 3) {
                case 1: {
                  obj.name = reader.string()
                  break
                }
                case 2: {
                  obj.maps = reader.fixed32()
                  break
                }
                case 3: {
                  obj.modes = reader.fixed32()
                  break
                }
                case 4: {
                  obj.tickRate = reader.uint32()
                  break
                }
                case 5: {
                  if (opts.limits?.champions != null && obj.champions.length === opts.limits.champions) {
                    throw new MaxLengthError('Decode error - map field "champions" had too many elements')
                  }

                  obj.champions.push(reader.fixed32())
                  break
                }
                default: {
                  reader.skipType(tag & 7)
                  break
                }
              }
            }

            return obj
          })
        }

        return _codec
      }

      export const encode = (obj: Partial<ServerSettings>): Uint8Array => {
        return encodeMessage(obj, ServerSettings.codec())
      }

      export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<ServerSettings>): ServerSettings => {
        return decodeMessage(buf, ServerSettings.codec(), opts)
      }
    }

    export interface GameInfo {
      name: string
      map: number
      mode: number
      players: number
      playersMax: number
      features: number
      passwordProtected: boolean
    }

    export namespace GameInfo {
      let _codec: Codec<GameInfo>

      export const codec = (): Codec<GameInfo> => {
        if (_codec == null) {
          _codec = message<GameInfo>((obj, w, opts = {}) => {
            if (opts.lengthDelimited !== false) {
              w.fork()
            }

            if ((obj.name != null && obj.name !== '')) {
              w.uint32(10)
              w.string(obj.name)
            }

            if ((obj.map != null && obj.map !== 0)) {
              w.uint32(16)
              w.uint32(obj.map)
            }

            if ((obj.mode != null && obj.mode !== 0)) {
              w.uint32(24)
              w.uint32(obj.mode)
            }

            if ((obj.players != null && obj.players !== 0)) {
              w.uint32(40)
              w.uint32(obj.players)
            }

            if ((obj.playersMax != null && obj.playersMax !== 0)) {
              w.uint32(48)
              w.uint32(obj.playersMax)
            }

            if ((obj.features != null && obj.features !== 0)) {
              w.uint32(61)
              w.fixed32(obj.features)
            }

            if ((obj.passwordProtected != null && obj.passwordProtected !== false)) {
              w.uint32(64)
              w.bool(obj.passwordProtected)
            }

            if (opts.lengthDelimited !== false) {
              w.ldelim()
            }
          }, (reader, length, opts = {}) => {
            const obj: any = {
              name: '',
              map: 0,
              mode: 0,
              players: 0,
              playersMax: 0,
              features: 0,
              passwordProtected: false
            }

            const end = length == null ? reader.len : reader.pos + length

            while (reader.pos < end) {
              const tag = reader.uint32()

              switch (tag >>> 3) {
                case 1: {
                  obj.name = reader.string()
                  break
                }
                case 2: {
                  obj.map = reader.uint32()
                  break
                }
                case 3: {
                  obj.mode = reader.uint32()
                  break
                }
                case 5: {
                  obj.players = reader.uint32()
                  break
                }
                case 6: {
                  obj.playersMax = reader.uint32()
                  break
                }
                case 7: {
                  obj.features = reader.fixed32()
                  break
                }
                case 8: {
                  obj.passwordProtected = reader.bool()
                  break
                }
                default: {
                  reader.skipType(tag & 7)
                  break
                }
              }
            }

            return obj
          })
        }

        return _codec
      }

      export const encode = (obj: Partial<GameInfo>): Uint8Array => {
        return encodeMessage(obj, GameInfo.codec())
      }

      export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<GameInfo>): GameInfo => {
        return decodeMessage(buf, GameInfo.codec(), opts)
      }
    }

    let _codec: Codec<AdditionalData>

    export const codec = (): Codec<AdditionalData> => {
      if (_codec == null) {
        _codec = message<AdditionalData>((obj, w, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            w.fork()
          }

          if ((obj.name != null && obj.name !== '')) {
            w.uint32(10)
            w.string(obj.name)
          }

          if (obj.serverSettings != null) {
            w.uint32(18)
            Peer.AdditionalData.ServerSettings.codec().encode(obj.serverSettings, w)
          }

          if (obj.gameInfos != null) {
            for (const value of obj.gameInfos) {
              w.uint32(26)
              Peer.AdditionalData.GameInfo.codec().encode(value, w)
            }
          }

          if (opts.lengthDelimited !== false) {
            w.ldelim()
          }
        }, (reader, length, opts = {}) => {
          const obj: any = {
            name: '',
            gameInfos: []
          }

          const end = length == null ? reader.len : reader.pos + length

          while (reader.pos < end) {
            const tag = reader.uint32()

            switch (tag >>> 3) {
              case 1: {
                obj.name = reader.string()
                break
              }
              case 2: {
                obj.serverSettings = Peer.AdditionalData.ServerSettings.codec().decode(reader, reader.uint32(), {
                  limits: opts.limits?.serverSettings
                })
                break
              }
              case 3: {
                if (opts.limits?.gameInfos != null && obj.gameInfos.length === opts.limits.gameInfos) {
                  throw new MaxLengthError('Decode error - map field "gameInfos" had too many elements')
                }

                obj.gameInfos.push(Peer.AdditionalData.GameInfo.codec().decode(reader, reader.uint32(), {
                  limits: opts.limits?.gameInfos$
                }))
                break
              }
              default: {
                reader.skipType(tag & 7)
                break
              }
            }
          }

          return obj
        })
      }

      return _codec
    }

    export const encode = (obj: Partial<AdditionalData>): Uint8Array => {
      return encodeMessage(obj, AdditionalData.codec())
    }

    export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<AdditionalData>): AdditionalData => {
      return decodeMessage(buf, AdditionalData.codec(), opts)
    }
  }

  let _codec: Codec<Peer>

  export const codec = (): Codec<Peer> => {
    if (_codec == null) {
      _codec = message<Peer>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if ((obj.publicKey != null && obj.publicKey.byteLength > 0)) {
          w.uint32(10)
          w.bytes(obj.publicKey)
        }

        if (obj.addrs != null) {
          for (const value of obj.addrs) {
            w.uint32(18)
            w.bytes(value)
          }
        }

        if (obj.data != null) {
          w.uint32(26)
          Peer.AdditionalData.codec().encode(obj.data, w)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length, opts = {}) => {
        const obj: any = {
          publicKey: uint8ArrayAlloc(0),
          addrs: []
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              obj.publicKey = reader.bytes()
              break
            }
            case 2: {
              if (opts.limits?.addrs != null && obj.addrs.length === opts.limits.addrs) {
                throw new MaxLengthError('Decode error - map field "addrs" had too many elements')
              }

              obj.addrs.push(reader.bytes())
              break
            }
            case 3: {
              obj.data = Peer.AdditionalData.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.data
              })
              break
            }
            default: {
              reader.skipType(tag & 7)
              break
            }
          }
        }

        return obj
      })
    }

    return _codec
  }

  export const encode = (obj: Partial<Peer>): Uint8Array => {
    return encodeMessage(obj, Peer.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<Peer>): Peer => {
    return decodeMessage(buf, Peer.codec(), opts)
  }
}
