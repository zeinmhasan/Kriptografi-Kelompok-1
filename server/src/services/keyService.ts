// Manajemen kunci: hash password, penurunan KEK, dan pembungkusan private key.
import { base64urlDecode, base64urlEncode, bytesToHex, bytesToUtf8, hexToBytes, utf8ToBytes } from '../crypto/bytes.ts';
import { GcmAuthenticationError, gcmDecrypt, gcmEncrypt } from '../crypto/gcm.ts';
import { pbkdf2Sha256 } from '../crypto/pbkdf2.ts';
import { randomBytes } from '../crypto/random.ts';
import { privateKeyFromJwk, privateKeyToJwk, type RsaPrivateKey } from '../crypto/rsa.ts';
import { WrongPasswordError } from '../errors.ts';
import type { UserDocument, WrappedPrivateKey } from '../models/User.ts';
import { type Tracer, hidden } from './trace.ts';

export type KeyPurpose = 'enc' | 'sig';

const KEY_LENGTH = 32;
export const SALT_LENGTH = 16;

const PURPOSE_LABEL: Record<KeyPurpose, string> = {
  enc: 'private encryption key',
  sig: 'private signing key',
};

function passwordBytes(password: string): Uint8Array {
  return utf8ToBytes(password.normalize('NFKC'));
}

export function newSalt(): string {
  return bytesToHex(randomBytes(SALT_LENGTH));
}

// Hash untuk login. Memakai salt yang berbeda dari KEK, sehingga hash yang tersimpan
// di database tidak bisa dipakai untuk membuka private key.
export function derivePasswordHash(password: string, saltHex: string, iterations: number): string {
  return bytesToHex(pbkdf2Sha256(passwordBytes(password), hexToBytes(saltHex), iterations, KEY_LENGTH));
}

// Key-encryption key: kunci AES-256 yang hanya ada di memori selama satu permintaan.
export function deriveKek(password: string, saltHex: string, iterations: number): Uint8Array {
  return pbkdf2Sha256(passwordBytes(password), hexToBytes(saltHex), iterations, KEY_LENGTH);
}

export function deriveUserKek(user: UserDocument, password: string, tracer: Tracer): Uint8Array {
  return tracer.step(
    'Derive the KEK from the password',
    'PBKDF2-HMAC-SHA256',
    () => deriveKek(password, user.kekSalt, user.kdfIterations),
    (kek) => ({ iterations: user.kdfIterations, salt: user.kekSalt, kek: hidden(kek) }),
  );
}

// AAD mengikat private key ke pemilik dan kegunaannya. Ciphertext yang dipindahkan ke
// user lain atau ditukar antara kunci enkripsi dan kunci tanda tangan gagal dibuka.
function privateKeyAad(userId: string, purpose: KeyPurpose): Uint8Array {
  return utf8ToBytes(`crypta:private-key:${userId}:${purpose}`);
}

export function wrapPrivateKey(
  kek: Uint8Array,
  privateKey: RsaPrivateKey,
  userId: string,
  purpose: KeyPurpose,
): WrappedPrivateKey {
  const iv = randomBytes(12);
  const plaintext = utf8ToBytes(JSON.stringify(privateKeyToJwk(privateKey)));
  const { ciphertext, tag } = gcmEncrypt(kek, iv, plaintext, privateKeyAad(userId, purpose));
  return { ciphertext: base64urlEncode(ciphertext), iv: bytesToHex(iv), tag: bytesToHex(tag) };
}

// KEK yang salah menghasilkan tag GCM yang tidak cocok. Itulah cara password salah terdeteksi.
export function unwrapPrivateKey(
  kek: Uint8Array,
  wrapped: WrappedPrivateKey,
  userId: string,
  purpose: KeyPurpose,
): RsaPrivateKey {
  let plaintext: Uint8Array;
  try {
    plaintext = gcmDecrypt(
      kek,
      hexToBytes(wrapped.iv),
      base64urlDecode(wrapped.ciphertext),
      hexToBytes(wrapped.tag),
      privateKeyAad(userId, purpose),
    );
  } catch (error) {
    if (error instanceof GcmAuthenticationError) throw new WrongPasswordError();
    throw error;
  }
  return privateKeyFromJwk(JSON.parse(bytesToUtf8(plaintext)));
}

export function openPrivateKey(user: UserDocument, kek: Uint8Array, purpose: KeyPurpose, tracer: Tracer): RsaPrivateKey {
  const wrapped = purpose === 'enc' ? user.encPrivateKey : user.sigPrivateKey;
  return tracer.step(
    `Unlock the ${PURPOSE_LABEL[purpose]}`,
    'AES-256-GCM',
    () => unwrapPrivateKey(kek, wrapped, user.id, purpose),
    () => ({ iv: wrapped.iv, authTag: wrapped.tag, privateKey: 'hidden' }),
  );
}
