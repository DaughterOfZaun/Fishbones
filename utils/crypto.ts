//src: @chainsafe/libp2p-noise/src/crypto/index.ts

import { defaultCrypto } from '../node_modules/@chainsafe/libp2p-noise/src/crypto/index.ts'
import { newInstance, ChaCha20Poly1305 } from '@chainsafe/as-chacha20poly1305'
import type { ICryptoInterface } from '@chainsafe/libp2p-noise'

const ctx = newInstance()
const asImpl = new ChaCha20Poly1305(ctx)

const asCrypto: Pick<ICryptoInterface, 'chaCha20Poly1305Encrypt' | 'chaCha20Poly1305Decrypt'> = {
  chaCha20Poly1305Encrypt (plaintext, nonce, ad, k) {
    return asImpl.seal(k, nonce, plaintext.subarray(), ad)
  },
  chaCha20Poly1305Decrypt (ciphertext, nonce, ad, k, dst) {
    const plaintext = asImpl.open(k, nonce, ciphertext.subarray(), ad, dst)
    if (!plaintext) {
      throw new Error('Invalid chacha20poly1305 decryption')
    }
    return plaintext
  }
}

const patchedCrypto = Object.assign(defaultCrypto, asCrypto)
export { defaultCrypto, asCrypto, patchedCrypto }
