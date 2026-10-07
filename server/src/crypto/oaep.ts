// RSAES-OAEP dengan SHA-256 dan MGF1-SHA-256 (RFC 8017 bagian 7.1).
import { bigIntToBytes, bytesToBigInt } from './bigint.ts';
import { concatBytes, xorBytes } from './bytes.ts';
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
const EMPTY = new Uint8Array(0);

export class OaepDecryptionError extends Error {
  constructor() {
    // Pesan sengaja sama untuk semua penyebab, agar tidak memberi petunjuk
    // kepada penyerang tentang bagian padding mana yang salah.
    super('OAEP decryption error');
    this.name = 'OaepDecryptionError';
  }
}

export function oaepMaxMessageLength(key: RsaPublicKey): number {
  return modulusByteLength(key) - 2 * HASH_LENGTH - 2;
}

// seed hanya diisi oleh pengujian. Pemakaian normal selalu memakai seed acak.
export function oaepEncrypt(
  key: RsaPublicKey,
  message: Uint8Array,
  label: Uint8Array = EMPTY,
  seed: Uint8Array = randomBytes(HASH_LENGTH),
): Uint8Array {
  const k = modulusByteLength(key);
  if (message.length > k - 2 * HASH_LENGTH - 2) throw new RangeError('message too long for RSA-OAEP');
  if (seed.length !== HASH_LENGTH) throw new RangeError('OAEP seed must be one hash length');

  // DB = lHash || PS (nol) || 0x01 || M
  const db = new Uint8Array(k - HASH_LENGTH - 1);
  db.set(sha256(label), 0);
  db[db.length - message.length - 1] = 0x01;
  db.set(message, db.length - message.length);

  const maskedDb = xorBytes(db, mgf1Sha256(seed, db.length));
  const maskedSeed = xorBytes(seed, mgf1Sha256(maskedDb, HASH_LENGTH));

  // EM = 0x00 || maskedSeed || maskedDB
  const encoded = concatBytes(new Uint8Array(1), maskedSeed, maskedDb);
  return bigIntToBytes(rsaPublicOperation(key, bytesToBigInt(encoded)), k);
}

export function oaepDecrypt(key: RsaPrivateKey, ciphertext: Uint8Array, label: Uint8Array = EMPTY): Uint8Array {
  const k = modulusByteLength(key);
  if (ciphertext.length !== k || k < 2 * HASH_LENGTH + 2) throw new OaepDecryptionError();

  const c = bytesToBigInt(ciphertext);
  if (c >= key.n) throw new OaepDecryptionError();
  const encoded = bigIntToBytes(rsaPrivateOperation(key, c), k);

  const maskedSeed = encoded.subarray(1, 1 + HASH_LENGTH);
  const maskedDb = encoded.subarray(1 + HASH_LENGTH);
  const seed = xorBytes(maskedSeed, mgf1Sha256(maskedDb, HASH_LENGTH));
  const db = xorBytes(maskedDb, mgf1Sha256(seed, maskedDb.length));

  // Semua pemeriksaan dijalankan sebelum memutuskan gagal atau tidak.
  let invalid = encoded[0];
  const labelHash = sha256(label);
  for (let i = 0; i < HASH_LENGTH; i++) invalid |= db[i] ^ labelHash[i];

  let separator = -1;
  for (let i = HASH_LENGTH; i < db.length; i++) {
    if (separator === -1 && db[i] !== 0) separator = i;
  }
  if (separator === -1 || db[separator] !== 0x01) invalid |= 1;

  if (invalid !== 0) throw new OaepDecryptionError();
  return db.slice(separator + 1);
}
