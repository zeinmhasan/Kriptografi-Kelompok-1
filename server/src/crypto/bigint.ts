// Aritmetika modular di atas BigInt bawaan JavaScript.
import { bytesToHex, hexToBytes } from './bytes.ts';
import { randomBytes } from './random.ts';

// OS2IP (RFC 8017 bagian 4.2): deretan byte big-endian menjadi integer.
export function bytesToBigInt(bytes: Uint8Array): bigint {
  if (bytes.length === 0) return 0n;
  return BigInt('0x' + bytesToHex(bytes));
}

// I2OSP (RFC 8017 bagian 4.1): integer menjadi deretan byte big-endian.
// Jika length diberikan, hasil diisi nol di depan sampai tepat sepanjang itu.
export function bigIntToBytes(value: bigint, length?: number): Uint8Array {
  if (value < 0n) throw new RangeError('cannot encode a negative integer');
  let hex = value.toString(16);
  if (hex.length % 2 !== 0) hex = '0' + hex;
  const raw = hexToBytes(hex);
  if (length === undefined) return raw;
  if (raw.length > length) throw new RangeError('integer too large for the requested length');
  const out = new Uint8Array(length);
  out.set(raw, length - raw.length);
  return out;
}

export function bitLength(value: bigint): number {
  if (value < 0n) throw new RangeError('bitLength expects a non-negative integer');
  return value === 0n ? 0 : value.toString(2).length;
}

export function byteLength(value: bigint): number {
  return Math.ceil(bitLength(value) / 8);
}

// Sisa bagi yang selalu non-negatif, tidak seperti operator % pada bilangan negatif.
export function mod(value: bigint, modulus: bigint): bigint {
  const remainder = value % modulus;
  return remainder < 0n ? remainder + modulus : remainder;
}

// base^exponent mod modulus dengan square-and-multiply, membaca bit eksponen dari kiri.
export function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  if (modulus <= 0n) throw new RangeError('modulus must be positive');
  if (exponent < 0n) throw new RangeError('exponent must be non-negative');
  if (modulus === 1n) return 0n;

  const reducedBase = mod(base, modulus);
  const bits = exponent.toString(2);
  let result = 1n;
  for (let i = 0; i < bits.length; i++) {
    result = (result * result) % modulus;
    if (bits[i] === '1') result = (result * reducedBase) % modulus;
  }
  return result;
}

export function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n) {
    [a, b] = [b, a % b];
  }
  return a;
}

export function lcm(a: bigint, b: bigint): bigint {
  return (a / gcd(a, b)) * b;
}

// Invers modular dengan extended Euclidean algorithm: mencari x sehingga value * x = 1 (mod modulus).
export function modInverse(value: bigint, modulus: bigint): bigint {
  let oldRemainder = mod(value, modulus);
  let remainder = modulus;
  let oldCoefficient = 1n;
  let coefficient = 0n;

  while (remainder !== 0n) {
    const quotient = oldRemainder / remainder;
    [oldRemainder, remainder] = [remainder, oldRemainder - quotient * remainder];
    [oldCoefficient, coefficient] = [coefficient, oldCoefficient - quotient * coefficient];
  }

  if (oldRemainder !== 1n) throw new RangeError('value has no inverse for this modulus');
  return mod(oldCoefficient, modulus);
}

// Integer acak seragam di [0, 2^bits).
export function randomBits(bits: number): bigint {
  if (bits <= 0) return 0n;
  const bytes = randomBytes(Math.ceil(bits / 8));
  const excessBits = bytes.length * 8 - bits;
  bytes[0] &= 0xff >>> excessBits;
  return bytesToBigInt(bytes);
}

// Integer acak seragam di [min, max], memakai rejection sampling agar tidak bias.
export function randomInRange(min: bigint, max: bigint): bigint {
  if (max < min) throw new RangeError('max must not be smaller than min');
  const span = max - min + 1n;
  const bits = bitLength(span - 1n);
  if (bits === 0) return min;
  while (true) {
    const candidate = randomBits(bits);
    if (candidate < span) return min + candidate;
  }
}
