/* eslint-disable import/export */
/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unnecessary-boolean-literal-compare */
/* eslint-disable @typescript-eslint/no-empty-interface */

import { type Codec, decodeMessage, type DecodeOptions, encodeMessage, MaxLengthError, message } from 'protons-runtime'
import type { Uint8ArrayList } from 'uint8arraylist'

export interface LobbyMessage {
  joinRequest?: JoinRequest
  leaveRequest?: LeaveRequest
  joinNotification: JoinNotification[]
  leaveNotification: JoinNotification[]
}

export namespace LobbyMessage {
  let _codec: Codec<LobbyMessage>

  export const codec = (): Codec<LobbyMessage> => {
    if (_codec == null) {
      _codec = message<LobbyMessage>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (obj.joinRequest != null) {
          w.uint32(10)
          JoinRequest.codec().encode(obj.joinRequest, w)
        }

        if (obj.leaveRequest != null) {
          w.uint32(18)
          LeaveRequest.codec().encode(obj.leaveRequest, w)
        }

        if (obj.joinNotification != null) {
          for (const value of obj.joinNotification) {
            w.uint32(26)
            JoinNotification.codec().encode(value, w)
          }
        }

        if (obj.leaveNotification != null) {
          for (const value of obj.leaveNotification) {
            w.uint32(34)
            JoinNotification.codec().encode(value, w)
          }
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length, opts = {}) => {
        const obj: any = {
          joinNotification: [],
          leaveNotification: []
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              obj.joinRequest = JoinRequest.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.joinRequest
              })
              break
            }
            case 2: {
              obj.leaveRequest = LeaveRequest.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.leaveRequest
              })
              break
            }
            case 3: {
              if (opts.limits?.joinNotification != null && obj.joinNotification.length === opts.limits.joinNotification) {
                throw new MaxLengthError('Decode error - map field "joinNotification" had too many elements')
              }

              obj.joinNotification.push(JoinNotification.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.joinNotification$
              }))
              break
            }
            case 4: {
              if (opts.limits?.leaveNotification != null && obj.leaveNotification.length === opts.limits.leaveNotification) {
                throw new MaxLengthError('Decode error - map field "leaveNotification" had too many elements')
              }

              obj.leaveNotification.push(JoinNotification.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.leaveNotification$
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

  export const encode = (obj: Partial<LobbyMessage>): Uint8Array => {
    return encodeMessage(obj, LobbyMessage.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<LobbyMessage>): LobbyMessage => {
    return decodeMessage(buf, LobbyMessage.codec(), opts)
  }
}

export interface JoinRequest {
  team?: number
}

export namespace JoinRequest {
  let _codec: Codec<JoinRequest>

  export const codec = (): Codec<JoinRequest> => {
    if (_codec == null) {
      _codec = message<JoinRequest>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (obj.team != null) {
          w.uint32(8)
          w.int32(obj.team)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length, opts = {}) => {
        const obj: any = {}

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              obj.team = reader.int32()
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

  export const encode = (obj: Partial<JoinRequest>): Uint8Array => {
    return encodeMessage(obj, JoinRequest.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<JoinRequest>): JoinRequest => {
    return decodeMessage(buf, JoinRequest.codec(), opts)
  }
}

export interface LeaveRequest {}

export namespace LeaveRequest {
  let _codec: Codec<LeaveRequest>

  export const codec = (): Codec<LeaveRequest> => {
    if (_codec == null) {
      _codec = message<LeaveRequest>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length, opts = {}) => {
        const obj: any = {}

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
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

  export const encode = (obj: Partial<LeaveRequest>): Uint8Array => {
    return encodeMessage(obj, LeaveRequest.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<LeaveRequest>): LeaveRequest => {
    return decodeMessage(buf, LeaveRequest.codec(), opts)
  }
}

export interface JoinNotification {
  peer?: Peer
  team: number
}

export namespace JoinNotification {
  let _codec: Codec<JoinNotification>

  export const codec = (): Codec<JoinNotification> => {
    if (_codec == null) {
      _codec = message<JoinNotification>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (obj.peer != null) {
          w.uint32(10)
          Peer.codec().encode(obj.peer, w)
        }

        if ((obj.team != null && obj.team !== 0)) {
          w.uint32(16)
          w.int32(obj.team)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length, opts = {}) => {
        const obj: any = {
          team: 0
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              obj.peer = Peer.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.peer
              })
              break
            }
            case 2: {
              obj.team = reader.int32()
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

  export const encode = (obj: Partial<JoinNotification>): Uint8Array => {
    return encodeMessage(obj, JoinNotification.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<JoinNotification>): JoinNotification => {
    return decodeMessage(buf, JoinNotification.codec(), opts)
  }
}

export interface LeaveNotification {
  peer?: Peer
}

export namespace LeaveNotification {
  let _codec: Codec<LeaveNotification>

  export const codec = (): Codec<LeaveNotification> => {
    if (_codec == null) {
      _codec = message<LeaveNotification>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (obj.peer != null) {
          w.uint32(10)
          Peer.codec().encode(obj.peer, w)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length, opts = {}) => {
        const obj: any = {}

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              obj.peer = Peer.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.peer
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

  export const encode = (obj: Partial<LeaveNotification>): Uint8Array => {
    return encodeMessage(obj, LeaveNotification.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<LeaveNotification>): LeaveNotification => {
    return decodeMessage(buf, LeaveNotification.codec(), opts)
  }
}

export interface Peer {
  name: string
}

export namespace Peer {
  let _codec: Codec<Peer>

  export const codec = (): Codec<Peer> => {
    if (_codec == null) {
      _codec = message<Peer>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if ((obj.name != null && obj.name !== '')) {
          w.uint32(10)
          w.string(obj.name)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length, opts = {}) => {
        const obj: any = {
          name: ''
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              obj.name = reader.string()
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
