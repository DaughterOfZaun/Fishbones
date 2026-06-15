//src: @chainsafe/libp2p-noise/src/crypto/index.ts

import { defaultCrypto, asCrypto } from '../node_modules/@chainsafe/libp2p-noise/src/crypto/index.ts'

const { chaCha20Poly1305Encrypt, chaCha20Poly1305Decrypt } = asCrypto
const patchedCrypto = Object.assign({}, defaultCrypto, { chaCha20Poly1305Encrypt, chaCha20Poly1305Decrypt })
export { defaultCrypto, asCrypto, patchedCrypto }
