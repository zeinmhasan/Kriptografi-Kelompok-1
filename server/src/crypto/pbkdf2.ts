// PBKDF2 dengan HMAC-SHA256 (RFC 8018 bagian 5.2).
import { concatBytes, uint32ToBytes } from './bytes.ts';
import { HmacSha256 } from './hmac.ts';
import { SHA256_DIGEST_LENGTH } from './sha256.ts';

export function pbkdf2Sha256(
  password: Uint8Array,
  salt: Uint8Array,
  iterations: number,
  keyLength: number,
): Uint8Array {
  if (!Number.isInteger(iterations) || iterations < 1) throw new RangeError('iterations must be a positive integer');
  if (!Number.isInteger(keyLength) || keyLength < 1) throw new RangeError('keyLength must be a positive integer');

  const prf = new HmacSha256(password);
  const blockCount = Math.ceil(keyLength / SHA256_DIGEST_LENGTH);
  const derived = new Uint8Array(blockCount * SHA256_DIGEST_LENGTH);

  for (let block = 1; block <= blockCount; block++) {
    // U1 = PRF(password, salt || INT(block)), Un = PRF(password, Un-1), T = U1 ^ U2 ^ ... ^ Uc
    let u = prf.sign(concatBytes(salt, uint32ToBytes(block)));
    const t = u.slice();
    for (let i = 1; i < iterations; i++) {
      u = prf.sign(u);
      for (let j = 0; j < SHA256_DIGEST_LENGTH; j++) t[j] ^= u[j];
    }
    derived.set(t, (block - 1) * SHA256_DIGEST_LENGTH);
  }

  return derived.slice(0, keyLength);
}
