// AES-GCM (NIST SP 800-38D): enkripsi mode counter + autentikasi GHASH.
import { Aes, AES_BLOCK_LENGTH } from './aes.ts';
import { constantTimeEqual } from './bytes.ts';

export const GCM_IV_LENGTH = 12;
export const GCM_TAG_LENGTH = 16;

const EMPTY = new Uint8Array(0);

export class GcmAuthenticationError extends Error {
  constructor() {
    super('GCM authentication failed: ciphertext, tag, IV, or AAD does not match');
    this.name = 'GcmAuthenticationError';
  }
}

export interface GcmCiphertext {
  ciphertext: Uint8Array;
  tag: Uint8Array;
}

// Elemen GF(2^128) disimpan sebagai 4 word 32-bit big-endian. Di GCM bit paling
// kiri adalah koefisien x^0, sehingga mengalikan dengan x berarti menggeser ke kanan.
//
// Tabel berisi H * x^i untuk i = 0..127. Karena perkalian bersifat linear,
// X * H adalah XOR dari entri tabel untuk setiap bit X yang bernilai 1.
function buildHashTable(hashKey: Uint8Array): Uint32Array {
  const table = new Uint32Array(128 * 4);
  let v0 = readUint32(hashKey, 0);
  let v1 = readUint32(hashKey, 4);
  let v2 = readUint32(hashKey, 8);
  let v3 = readUint32(hashKey, 12);

  for (let i = 0; i < 128; i++) {
    table[4 * i] = v0;
    table[4 * i + 1] = v1;
    table[4 * i + 2] = v2;
    table[4 * i + 3] = v3;

    // Kalikan dengan x. Jika koefisien x^127 keluar, reduksi dengan
    // x^128 = x^7 + x^2 + x + 1, yang dalam urutan bit GCM adalah 0xe1 di byte pertama.
    const carry = v3 & 1;
    v3 = (v3 >>> 1) | (v2 << 31);
    v2 = (v2 >>> 1) | (v1 << 31);
    v1 = (v1 >>> 1) | (v0 << 31);
    v0 = v0 >>> 1;
    if (carry) v0 ^= 0xe1000000;
  }
  return table;
}

// y = y * H, di tempat.
function multiplyByHashKey(table: Uint32Array, y: Uint32Array): void {
  let z0 = 0;
  let z1 = 0;
  let z2 = 0;
  let z3 = 0;
  let entry = 0;

  for (let word = 0; word < 4; word++) {
    const value = y[word];
    for (let bit = 31; bit >= 0; bit--) {
      // mask bernilai 0xffffffff jika bit menyala dan 0 jika tidak, tanpa percabangan.
      const mask = -((value >>> bit) & 1);
      z0 ^= table[entry] & mask;
      z1 ^= table[entry + 1] & mask;
      z2 ^= table[entry + 2] & mask;
      z3 ^= table[entry + 3] & mask;
      entry += 4;
    }
  }

  y[0] = z0;
  y[1] = z1;
  y[2] = z2;
  y[3] = z3;
}

// Menyerap data ke GHASH per blok 16 byte. Blok terakhir yang tidak penuh diisi nol.
function ghashUpdate(table: Uint32Array, y: Uint32Array, data: Uint8Array): void {
  const fullLength = data.length - (data.length % AES_BLOCK_LENGTH);
  for (let offset = 0; offset < fullLength; offset += AES_BLOCK_LENGTH) {
    y[0] ^= readUint32(data, offset);
    y[1] ^= readUint32(data, offset + 4);
    y[2] ^= readUint32(data, offset + 8);
    y[3] ^= readUint32(data, offset + 12);
    multiplyByHashKey(table, y);
  }

  if (fullLength < data.length) {
    const last = new Uint8Array(AES_BLOCK_LENGTH);
    last.set(data.subarray(fullLength));
    y[0] ^= readUint32(last, 0);
    y[1] ^= readUint32(last, 4);
    y[2] ^= readUint32(last, 8);
    y[3] ^= readUint32(last, 12);
    multiplyByHashKey(table, y);
  }
}

// Blok penutup GHASH: dua panjang dalam bit, masing-masing integer 64-bit big-endian.
function ghashLengths(table: Uint32Array, y: Uint32Array, firstLength: number, secondLength: number): void {
  y[0] ^= Math.floor(firstLength / 0x20000000);
  y[1] ^= (firstLength << 3) >>> 0;
  y[2] ^= Math.floor(secondLength / 0x20000000);
  y[3] ^= (secondLength << 3) >>> 0;
  multiplyByHashKey(table, y);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function wordsToBytes(words: Uint32Array): Uint8Array {
  const out = new Uint8Array(AES_BLOCK_LENGTH);
  for (let i = 0; i < 4; i++) {
    out[4 * i] = words[i] >>> 24;
    out[4 * i + 1] = words[i] >>> 16;
    out[4 * i + 2] = words[i] >>> 8;
    out[4 * i + 3] = words[i];
  }
  return out;
}

// Menaikkan 32 bit terakhir blok counter, modulo 2^32.
function incrementCounter(counter: Uint8Array): void {
  for (let i = 15; i >= 12; i--) {
    counter[i] = (counter[i] + 1) & 0xff;
    if (counter[i] !== 0) break;
  }
}

// Blok counter awal J0. IV 96-bit dipakai langsung; panjang lain di-hash dengan GHASH.
function deriveInitialCounter(table: Uint32Array, iv: Uint8Array): Uint8Array {
  if (iv.length === GCM_IV_LENGTH) {
    const j0 = new Uint8Array(AES_BLOCK_LENGTH);
    j0.set(iv);
    j0[15] = 1;
    return j0;
  }
  const y = new Uint32Array(4);
  ghashUpdate(table, y, iv);
  ghashLengths(table, y, 0, iv.length);
  return wordsToBytes(y);
}

// Mode counter: XOR masukan dengan keystream AES(counter), AES(counter + 1), ...
function counterModeXor(aes: Aes, counter: Uint8Array, input: Uint8Array): Uint8Array {
  const output = new Uint8Array(input.length);
  const keystream = new Uint8Array(AES_BLOCK_LENGTH);
  for (let offset = 0; offset < input.length; offset += AES_BLOCK_LENGTH) {
    aes.encryptBlock(counter, 0, keystream, 0);
    incrementCounter(counter);
    const end = Math.min(offset + AES_BLOCK_LENGTH, input.length);
    for (let i = offset; i < end; i++) output[i] = input[i] ^ keystream[i - offset];
  }
  return output;
}

function computeTag(
  aes: Aes,
  table: Uint32Array,
  j0: Uint8Array,
  aad: Uint8Array,
  ciphertext: Uint8Array,
): Uint8Array {
  const y = new Uint32Array(4);
  ghashUpdate(table, y, aad);
  ghashUpdate(table, y, ciphertext);
  ghashLengths(table, y, aad.length, ciphertext.length);

  const tag = wordsToBytes(y);
  const mask = new Uint8Array(AES_BLOCK_LENGTH);
  aes.encryptBlock(j0, 0, mask, 0);
  for (let i = 0; i < AES_BLOCK_LENGTH; i++) tag[i] ^= mask[i];
  return tag;
}

function setup(key: Uint8Array, iv: Uint8Array) {
  if (iv.length === 0) throw new RangeError('GCM IV must not be empty');
  const aes = new Aes(key);
  const hashKey = new Uint8Array(AES_BLOCK_LENGTH);
  aes.encryptBlock(hashKey, 0, hashKey, 0); // H = AES_K(0^128)
  const table = buildHashTable(hashKey);
  const j0 = deriveInitialCounter(table, iv);
  return { aes, table, j0 };
}

export function gcmEncrypt(
  key: Uint8Array,
  iv: Uint8Array,
  plaintext: Uint8Array,
  aad: Uint8Array = EMPTY,
): GcmCiphertext {
  const { aes, table, j0 } = setup(key, iv);
  const counter = j0.slice();
  incrementCounter(counter);
  const ciphertext = counterModeXor(aes, counter, plaintext);
  const tag = computeTag(aes, table, j0, aad, ciphertext);
  return { ciphertext, tag };
}

// Tag diperiksa sebelum dekripsi, sehingga plaintext dari ciphertext yang
// tidak sah tidak pernah dihasilkan.
export function gcmDecrypt(
  key: Uint8Array,
  iv: Uint8Array,
  ciphertext: Uint8Array,
  tag: Uint8Array,
  aad: Uint8Array = EMPTY,
): Uint8Array {
  if (tag.length !== GCM_TAG_LENGTH) throw new GcmAuthenticationError();
  const { aes, table, j0 } = setup(key, iv);
  const expectedTag = computeTag(aes, table, j0, aad, ciphertext);
  if (!constantTimeEqual(expectedTag, tag)) throw new GcmAuthenticationError();

  const counter = j0.slice();
  incrementCounter(counter);
  return counterModeXor(aes, counter, ciphertext);
}
