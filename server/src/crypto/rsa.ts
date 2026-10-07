// RSA (RFC 8017): pembangkitan kunci, primitif kunci publik dan privat, serialisasi kunci.
import { bigIntToBytes, bitLength, bytesToBigInt, gcd, lcm, mod, modInverse, modPow } from './bigint.ts';
import { base64urlDecode, base64urlEncode, bytesToHex, concatBytes, uint32ToBytes } from './bytes.ts';
import { generatePrime } from './prime.ts';
import { sha256 } from './sha256.ts';

export const RSA_PUBLIC_EXPONENT = 65537n;

export interface RsaPublicKey {
  n: bigint;
  e: bigint;
}

export interface RsaPrivateKey {
  n: bigint;
  e: bigint;
  d: bigint;
  p: bigint;
  q: bigint;
  dp: bigint; // d mod (p - 1)
  dq: bigint; // d mod (q - 1)
  qInv: bigint; // q^-1 mod p
}

export interface RsaKeyPair {
  publicKey: RsaPublicKey;
  privateKey: RsaPrivateKey;
}

export function generateKeyPair(bits: number = 2048): RsaKeyPair {
  if (bits < 512 || bits % 2 !== 0) throw new RangeError('RSA modulus must be an even number of bits, at least 512');
  const e = RSA_PUBLIC_EXPONENT;
  const primeBits = bits / 2;
  // p dan q yang terlalu berdekatan membuat n mudah difaktorkan dengan metode Fermat.
  const minimumDistance = 1n << BigInt(primeBits - 100 > 0 ? primeBits - 100 : 1);

  while (true) {
    let p = generateRsaPrime(primeBits, e);
    let q = generateRsaPrime(primeBits, e);
    const distance = p > q ? p - q : q - p;
    if (distance < minimumDistance) continue;
    if (p < q) [p, q] = [q, p];

    const n = p * q;
    if (bitLength(n) !== bits) continue;

    // d adalah invers e modulo lambda(n) = lcm(p - 1, q - 1).
    const lambda = lcm(p - 1n, q - 1n);
    const d = modInverse(e, lambda);

    return {
      publicKey: { n, e },
      privateKey: {
        n,
        e,
        d,
        p,
        q,
        dp: d % (p - 1n),
        dq: d % (q - 1n),
        qInv: modInverse(q, p),
      },
    };
  }
}

// Prima p harus memenuhi gcd(p - 1, e) = 1 agar e punya invers.
function generateRsaPrime(bits: number, e: bigint): bigint {
  while (true) {
    const prime = generatePrime(bits);
    if (gcd(prime - 1n, e) === 1n) return prime;
  }
}

// RSAEP / RSAVP1: m^e mod n.
export function rsaPublicOperation(key: RsaPublicKey, value: bigint): bigint {
  if (value < 0n || value >= key.n) throw new RangeError('value out of range for this RSA modulus');
  return modPow(value, key.e, key.n);
}

// RSADP / RSASP1: c^d mod n, dihitung dengan Chinese Remainder Theorem.
// Dua eksponensiasi modulo p dan q jauh lebih murah daripada satu modulo n.
export function rsaPrivateOperation(key: RsaPrivateKey, value: bigint): bigint {
  if (value < 0n || value >= key.n) throw new RangeError('value out of range for this RSA modulus');
  const m1 = modPow(value, key.dp, key.p);
  const m2 = modPow(value, key.dq, key.q);
  const h = mod(key.qInv * (m1 - m2), key.p);
  return m2 + key.q * h;
}

export function modulusByteLength(key: RsaPublicKey): number {
  return Math.ceil(bitLength(key.n) / 8);
}

// Kunci diserialisasi dalam bentuk JWK (RFC 7517): tiap komponen adalah integer
// big-endian yang di-encode base64url.

export type RsaPublicJwk = {
  kty: 'RSA';
  n: string;
  e: string;
};

export type RsaPrivateJwk = RsaPublicJwk & {
  d: string;
  p: string;
  q: string;
  dp: string;
  dq: string;
  qi: string;
};

function encodeComponent(value: bigint): string {
  return base64urlEncode(bigIntToBytes(value));
}

function decodeComponent(text: string): bigint {
  return bytesToBigInt(base64urlDecode(text));
}

export function publicKeyToJwk(key: RsaPublicKey): RsaPublicJwk {
  return { kty: 'RSA', n: encodeComponent(key.n), e: encodeComponent(key.e) };
}

export function publicKeyFromJwk(jwk: RsaPublicJwk): RsaPublicKey {
  return { n: decodeComponent(jwk.n), e: decodeComponent(jwk.e) };
}

export function privateKeyToJwk(key: RsaPrivateKey): RsaPrivateJwk {
  return {
    kty: 'RSA',
    n: encodeComponent(key.n),
    e: encodeComponent(key.e),
    d: encodeComponent(key.d),
    p: encodeComponent(key.p),
    q: encodeComponent(key.q),
    dp: encodeComponent(key.dp),
    dq: encodeComponent(key.dq),
    qi: encodeComponent(key.qInv),
  };
}

export function privateKeyFromJwk(jwk: RsaPrivateJwk): RsaPrivateKey {
  return {
    n: decodeComponent(jwk.n),
    e: decodeComponent(jwk.e),
    d: decodeComponent(jwk.d),
    p: decodeComponent(jwk.p),
    q: decodeComponent(jwk.q),
    dp: decodeComponent(jwk.dp),
    dq: decodeComponent(jwk.dq),
    qInv: decodeComponent(jwk.qi),
  };
}

// Fingerprint: SHA-256 atas len(n) || n || len(e) || e, dengan panjang 32-bit big-endian.
export function publicKeyFingerprint(key: RsaPublicKey): string {
  const n = bigIntToBytes(key.n);
  const e = bigIntToBytes(key.e);
  return bytesToHex(sha256(concatBytes(uint32ToBytes(n.length), n, uint32ToBytes(e.length), e)));
}
