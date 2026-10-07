// HMAC-SHA256 (RFC 2104).
import { Sha256, SHA256_BLOCK_LENGTH, sha256 } from './sha256.ts';

export class HmacSha256 {
  // State SHA-256 setelah menyerap blok ipad dan opad. Dihitung sekali per kunci,
  // sehingga PBKDF2 tidak mengulang dua kompresi itu di setiap iterasi.
  private readonly inner: Sha256;
  private readonly outer: Sha256;

  constructor(key: Uint8Array) {
    const blockKey = new Uint8Array(SHA256_BLOCK_LENGTH);
    blockKey.set(key.length > SHA256_BLOCK_LENGTH ? sha256(key) : key);

    const ipad = new Uint8Array(SHA256_BLOCK_LENGTH);
    const opad = new Uint8Array(SHA256_BLOCK_LENGTH);
    for (let i = 0; i < SHA256_BLOCK_LENGTH; i++) {
      ipad[i] = blockKey[i] ^ 0x36;
      opad[i] = blockKey[i] ^ 0x5c;
    }

    this.inner = new Sha256().update(ipad);
    this.outer = new Sha256().update(opad);
  }

  sign(data: Uint8Array): Uint8Array {
    const innerDigest = this.inner.clone().update(data).digest();
    return this.outer.clone().update(innerDigest).digest();
  }
}

export function hmacSha256(key: Uint8Array, data: Uint8Array): Uint8Array {
  return new HmacSha256(key).sign(data);
}
