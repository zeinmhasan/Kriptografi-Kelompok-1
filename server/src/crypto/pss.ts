// RSASSA-PSS dengan SHA-256 dan MGF1-SHA-256 (RFC 8017 bagian 8.1 dan 9.1).
import { bigIntToBytes, bitLength, bytesToBigInt } from './bigint.ts';
import { concatBytes, constantTimeEqual, xorBytes } from './bytes.ts';
import { mgf1Sha256 } from './mgf1.ts';
import { randomBytes } from './random.ts';
import {
  modulusByteLength,
  rsaPrivateOperation,
  rsaPublicOperation,
  type RsaPrivateKey,
  type RsaPublicKey,
} from './rsa.ts';
import { SHA256_DIGEST_LENGTH, sha256 } from './sha256.ts';

const HASH_LENGTH = SHA256_DIGEST_LENGTH;
export const PSS_SALT_LENGTH = 32;

// EMSA-PSS-ENCODE: mengubah hash pesan menjadi encoded message sepanjang emBits bit.
export function emsaPssEncode(messageHash: Uint8Array, emBits: number, salt: Uint8Array): Uint8Array {
  if (messageHash.length !== HASH_LENGTH) throw new RangeError('message hash must be a SHA-256 digest');
  const emLength = Math.ceil(emBits / 8);
  if (emLength < HASH_LENGTH + salt.length + 2) throw new RangeError('RSA modulus too small for PSS encoding');

  // H = Hash(0x00 x 8 || mHash || salt)
  const h = sha256(concatBytes(new Uint8Array(8), messageHash, salt));

  // DB = PS (nol) || 0x01 || salt
  const db = new Uint8Array(emLength - HASH_LENGTH - 1);
  db[db.length - salt.length - 1] = 0x01;
  db.set(salt, db.length - salt.length);

  const maskedDb = xorBytes(db, mgf1Sha256(h, db.length));
  // Bit paling kiri yang melebihi emBits dinolkan supaya EM selalu lebih kecil dari modulus.
  maskedDb[0] &= 0xff >>> (8 * emLength - emBits);

  // EM = maskedDB || H || 0xbc
  return concatBytes(maskedDb, h, new Uint8Array([0xbc]));
}

// EMSA-PSS-VERIFY: memeriksa apakah encoded message konsisten dengan hash pesan.
export function emsaPssVerify(
  messageHash: Uint8Array,
  encoded: Uint8Array,
  emBits: number,
  saltLength: number,
): boolean {
  if (messageHash.length !== HASH_LENGTH) return false;
  const emLength = Math.ceil(emBits / 8);
  if (encoded.length !== emLength) return false;
  if (emLength < HASH_LENGTH + saltLength + 2) return false;
  if (encoded[emLength - 1] !== 0xbc) return false;

  const dbLength = emLength - HASH_LENGTH - 1;
  const maskedDb = encoded.subarray(0, dbLength);
  const h = encoded.subarray(dbLength, dbLength + HASH_LENGTH);

  const topMask = 0xff >>> (8 * emLength - emBits);
  if ((maskedDb[0] & ~topMask & 0xff) !== 0) return false;

  const db = xorBytes(maskedDb, mgf1Sha256(h, dbLength));
  db[0] &= topMask;

  const paddingLength = dbLength - saltLength - 1;
  for (let i = 0; i < paddingLength; i++) {
    if (db[i] !== 0) return false;
  }
  if (db[paddingLength] !== 0x01) return false;

  const salt = db.subarray(dbLength - saltLength);
  const expected = sha256(concatBytes(new Uint8Array(8), messageHash, salt));
  return constantTimeEqual(h, expected);
}

// salt hanya diisi oleh pengujian. Pemakaian normal selalu memakai salt acak.
export function pssSignDigest(
  key: RsaPrivateKey,
  messageHash: Uint8Array,
  salt: Uint8Array = randomBytes(PSS_SALT_LENGTH),
): Uint8Array {
  const emBits = bitLength(key.n) - 1;
  const encoded = emsaPssEncode(messageHash, emBits, salt);
  const signature = rsaPrivateOperation(key, bytesToBigInt(encoded));
  return bigIntToBytes(signature, modulusByteLength(key));
}

export function pssVerifyDigest(
  key: RsaPublicKey,
  messageHash: Uint8Array,
  signature: Uint8Array,
  saltLength: number = PSS_SALT_LENGTH,
): boolean {
  if (signature.length !== modulusByteLength(key)) return false;
  const s = bytesToBigInt(signature);
  if (s >= key.n) return false;

  const emBits = bitLength(key.n) - 1;
  const emLength = Math.ceil(emBits / 8);
  let encoded: Uint8Array;
  try {
    encoded = bigIntToBytes(rsaPublicOperation(key, s), emLength);
  } catch {
    return false;
  }
  return emsaPssVerify(messageHash, encoded, emBits, saltLength);
}

export function pssSign(key: RsaPrivateKey, message: Uint8Array): Uint8Array {
  return pssSignDigest(key, sha256(message));
}

export function pssVerify(key: RsaPublicKey, message: Uint8Array, signature: Uint8Array): boolean {
  return pssVerifyDigest(key, sha256(message), signature);
}
