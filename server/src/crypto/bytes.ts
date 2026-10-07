// Utilitas byte: konversi hex, base64url, UTF-8, dan perbandingan constant-time.

const HEX_CHARS = '0123456789abcdef';
const BASE64URL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const BASE64URL_LOOKUP = new Int8Array(128).fill(-1);
for (let i = 0; i < BASE64URL_CHARS.length; i++) {
  BASE64URL_LOOKUP[BASE64URL_CHARS.charCodeAt(i)] = i;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', { fatal: true });

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += HEX_CHARS[bytes[i] >>> 4] + HEX_CHARS[bytes[i] & 0x0f];
  }
  return out;
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new RangeError('hex string must have an even length');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const high = hexDigit(hex.charCodeAt(2 * i));
    const low = hexDigit(hex.charCodeAt(2 * i + 1));
    out[i] = (high << 4) | low;
  }
  return out;
}

function hexDigit(code: number): number {
  if (code >= 48 && code <= 57) return code - 48; // 0-9
  if (code >= 97 && code <= 102) return code - 87; // a-f
  if (code >= 65 && code <= 70) return code - 55; // A-F
  throw new RangeError('invalid hex character');
}

export function base64urlEncode(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out +=
      BASE64URL_CHARS[n >>> 18] +
      BASE64URL_CHARS[(n >>> 12) & 63] +
      BASE64URL_CHARS[(n >>> 6) & 63] +
      BASE64URL_CHARS[n & 63];
  }
  const remaining = bytes.length - i;
  if (remaining === 1) {
    const n = bytes[i] << 16;
    out += BASE64URL_CHARS[n >>> 18] + BASE64URL_CHARS[(n >>> 12) & 63];
  } else if (remaining === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += BASE64URL_CHARS[n >>> 18] + BASE64URL_CHARS[(n >>> 12) & 63] + BASE64URL_CHARS[(n >>> 6) & 63];
  }
  return out;
}

export function base64urlDecode(text: string): Uint8Array {
  if (text.length % 4 === 1) throw new RangeError('invalid base64url length');
  const out = new Uint8Array(Math.floor((text.length * 3) / 4));
  let outIndex = 0;
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const value = code < 128 ? BASE64URL_LOOKUP[code] : -1;
    if (value < 0) throw new RangeError('invalid base64url character');
    buffer = ((buffer << 6) | value) & 0xffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[outIndex++] = (buffer >>> bits) & 0xff;
    }
  }
  return out;
}

export function utf8ToBytes(text: string): Uint8Array {
  return textEncoder.encode(text);
}

export function bytesToUtf8(bytes: Uint8Array): string {
  return textDecoder.decode(bytes);
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function xorBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length !== b.length) throw new RangeError('xorBytes requires equal lengths');
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i];
  return out;
}

// Membandingkan seluruh byte tanpa berhenti di perbedaan pertama, agar lama
// eksekusi tidak membocorkan posisi byte yang salah.
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// Integer 32-bit big-endian, dipakai MGF1 dan PBKDF2.
export function uint32ToBytes(value: number): Uint8Array {
  return new Uint8Array([(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]);
}
