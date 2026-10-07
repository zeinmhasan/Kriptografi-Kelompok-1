// Uji negatif dan kasus tepi: masukan yang salah atau diubah harus ditolak.
import { beforeAll, describe, expect, it } from 'vitest';
import { bigIntToBytes, bytesToBigInt, gcd, modInverse, modPow } from '../../src/crypto/bigint.ts';
import {
  base64urlDecode,
  base64urlEncode,
  bytesToHex,
  constantTimeEqual,
  hexToBytes,
  utf8ToBytes,
} from '../../src/crypto/bytes.ts';
import { GcmAuthenticationError, gcmDecrypt, gcmEncrypt } from '../../src/crypto/gcm.ts';
import { JwtError, signJwt, verifyJwt } from '../../src/crypto/jwt.ts';
import { OaepDecryptionError, oaepDecrypt, oaepEncrypt, oaepMaxMessageLength } from '../../src/crypto/oaep.ts';
import { isProbablePrime } from '../../src/crypto/prime.ts';
import { pssSign, pssVerify } from '../../src/crypto/pss.ts';
import { randomBytes } from '../../src/crypto/random.ts';
import {
  generateKeyPair,
  privateKeyFromJwk,
  privateKeyToJwk,
  publicKeyFingerprint,
  type RsaKeyPair,
} from '../../src/crypto/rsa.ts';

describe('bytes', () => {
  it('round-trips hex and base64url for every length', () => {
    for (let length = 0; length < 70; length++) {
      const data = randomBytes(length);
      expect(bytesToHex(hexToBytes(bytesToHex(data)))).toBe(bytesToHex(data));
      const encoded = base64urlEncode(data);
      expect(encoded).toBe(Buffer.from(data).toString('base64url'));
      expect(bytesToHex(base64urlDecode(encoded))).toBe(bytesToHex(data));
    }
  });

  it('rejects malformed input', () => {
    expect(() => hexToBytes('abc')).toThrow(RangeError);
    expect(() => hexToBytes('zz')).toThrow(RangeError);
    expect(() => base64urlDecode('a')).toThrow(RangeError);
    expect(() => base64urlDecode('ab+/')).toThrow(RangeError);
  });

  it('compares in constant time semantics', () => {
    expect(constantTimeEqual(hexToBytes('0102'), hexToBytes('0102'))).toBe(true);
    expect(constantTimeEqual(hexToBytes('0102'), hexToBytes('0103'))).toBe(false);
    expect(constantTimeEqual(hexToBytes('0102'), hexToBytes('01'))).toBe(false);
  });
});

describe('bigint arithmetic', () => {
  it('computes modular exponentiation, inverse, and gcd', () => {
    expect(modPow(4n, 13n, 497n)).toBe(445n);
    expect(modPow(2n, 0n, 7n)).toBe(1n);
    expect(modPow(5n, 3n, 1n)).toBe(0n);
    expect(modInverse(3n, 11n)).toBe(4n);
    expect(modInverse(17n, 3120n)).toBe(2753n);
    expect(() => modInverse(6n, 9n)).toThrow(RangeError);
    expect(gcd(1071n, 462n)).toBe(21n);
  });

  it('converts between integers and fixed-length byte strings', () => {
    expect(bytesToHex(bigIntToBytes(0n))).toBe('00');
    expect(bytesToHex(bigIntToBytes(256n))).toBe('0100');
    expect(bytesToHex(bigIntToBytes(1n, 4))).toBe('00000001');
    expect(bytesToBigInt(hexToBytes('00000100'))).toBe(256n);
    expect(() => bigIntToBytes(65536n, 2)).toThrow(RangeError);
  });
});

describe('Miller-Rabin', () => {
  it('accepts known primes', () => {
    for (const prime of [2n, 3n, 1999n, 2003n, 7919n, 2n ** 61n - 1n, 2n ** 127n - 1n, 2n ** 521n - 1n]) {
      expect(isProbablePrime(prime)).toBe(true);
    }
  });

  it('rejects composites, including Carmichael numbers and products of large primes', () => {
    const composites = [0n, 1n, 4n, 561n, 41041n, 825265n, 2n ** 61n + 1n, (2n ** 61n - 1n) * (2n ** 89n - 1n)];
    for (const composite of composites) {
      expect(isProbablePrime(composite)).toBe(false);
    }
  });
});

describe('AES-256-GCM tampering', () => {
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const aad = utf8ToBytes('crypta:file:1:2');
  const plaintext = randomBytes(1000);
  const { ciphertext, tag } = gcmEncrypt(key, iv, plaintext, aad);

  it('decrypts untouched data', () => {
    expect(bytesToHex(gcmDecrypt(key, iv, ciphertext, tag, aad))).toBe(bytesToHex(plaintext));
  });

  it('rejects a flipped ciphertext bit at any position', () => {
    for (const position of [0, 1, 499, 998, 999]) {
      const tampered = ciphertext.slice();
      tampered[position] ^= 0x80;
      expect(() => gcmDecrypt(key, iv, tampered, tag, aad)).toThrow(GcmAuthenticationError);
    }
  });

  it('rejects a modified tag, AAD, IV, or key', () => {
    const badTag = tag.slice();
    badTag[15] ^= 0x01;
    expect(() => gcmDecrypt(key, iv, ciphertext, badTag, aad)).toThrow(GcmAuthenticationError);
    expect(() => gcmDecrypt(key, iv, ciphertext, tag, utf8ToBytes('crypta:file:1:3'))).toThrow(
      GcmAuthenticationError,
    );
    expect(() => gcmDecrypt(key, randomBytes(12), ciphertext, tag, aad)).toThrow(GcmAuthenticationError);
    expect(() => gcmDecrypt(randomBytes(32), iv, ciphertext, tag, aad)).toThrow(GcmAuthenticationError);
  });

  it('rejects truncated ciphertext and truncated tags', () => {
    expect(() => gcmDecrypt(key, iv, ciphertext.subarray(0, 999), tag, aad)).toThrow(GcmAuthenticationError);
    expect(() => gcmDecrypt(key, iv, ciphertext, tag.subarray(0, 12), aad)).toThrow(GcmAuthenticationError);
  });
});

describe('RSA-OAEP and RSA-PSS misuse', () => {
  let alice: RsaKeyPair;
  let bob: RsaKeyPair;

  beforeAll(() => {
    alice = generateKeyPair(1024);
    bob = generateKeyPair(1024);
  });

  it('refuses messages longer than the OAEP limit', () => {
    const limit = oaepMaxMessageLength(alice.publicKey);
    expect(limit).toBe(128 - 2 * 32 - 2);
    expect(() => oaepEncrypt(alice.publicKey, randomBytes(limit + 1))).toThrow(RangeError);
    expect(oaepDecrypt(alice.privateKey, oaepEncrypt(alice.publicKey, randomBytes(limit))).length).toBe(limit);
  });

  it('randomizes OAEP ciphertexts', () => {
    const message = randomBytes(32);
    expect(bytesToHex(oaepEncrypt(alice.publicKey, message))).not.toBe(
      bytesToHex(oaepEncrypt(alice.publicKey, message)),
    );
  });

  it('cannot decrypt with another private key or another label', () => {
    const ciphertext = oaepEncrypt(alice.publicKey, randomBytes(32), utf8ToBytes('label'));
    expect(() => oaepDecrypt(bob.privateKey, ciphertext, utf8ToBytes('label'))).toThrow(OaepDecryptionError);
    expect(() => oaepDecrypt(alice.privateKey, ciphertext, utf8ToBytes('other'))).toThrow(OaepDecryptionError);
    expect(() => oaepDecrypt(alice.privateKey, ciphertext.subarray(1))).toThrow(OaepDecryptionError);
  });

  it('does not verify a signature under another public key', () => {
    const message = randomBytes(64);
    const signature = pssSign(alice.privateKey, message);
    expect(pssVerify(alice.publicKey, message, signature)).toBe(true);
    expect(pssVerify(bob.publicKey, message, signature)).toBe(false);
    expect(pssVerify(alice.publicKey, message, signature.subarray(1))).toBe(false);
    expect(pssVerify(alice.publicKey, message, new Uint8Array(signature.length))).toBe(false);
  });

  it('round-trips private keys through JWK and gives distinct fingerprints', () => {
    const restored = privateKeyFromJwk(privateKeyToJwk(alice.privateKey));
    expect(restored).toEqual(alice.privateKey);
    expect(publicKeyFingerprint(alice.publicKey)).toMatch(/^[0-9a-f]{64}$/);
    expect(publicKeyFingerprint(alice.publicKey)).not.toBe(publicKeyFingerprint(bob.publicKey));
  });
});

describe('JWT HS256', () => {
  const secret = randomBytes(32);

  it('verifies its own tokens', () => {
    const token = signJwt({ sub: 'user-1', username: 'alice' }, secret, 60);
    const payload = verifyJwt(token, secret);
    expect(payload.sub).toBe('user-1');
    expect(payload.username).toBe('alice');
  });

  it('rejects a wrong secret, a modified payload, and an expired token', () => {
    const token = signJwt({ sub: 'user-1' }, secret, 60, 1_000);
    expect(() => verifyJwt(token, randomBytes(32), 1_010)).toThrow(JwtError);
    expect(() => verifyJwt(token, secret, 1_060)).toThrow('token expired');

    const [header, , signature] = token.split('.');
    const forgedPayload = base64urlEncode(utf8ToBytes(JSON.stringify({ sub: 'admin', iat: 1_000, exp: 9_999 })));
    expect(() => verifyJwt(`${header}.${forgedPayload}.${signature}`, secret, 1_010)).toThrow('invalid signature');
  });

  it('rejects alg "none" and malformed tokens', () => {
    const header = base64urlEncode(utf8ToBytes(JSON.stringify({ alg: 'none', typ: 'JWT' })));
    const payload = base64urlEncode(utf8ToBytes(JSON.stringify({ sub: 'admin', iat: 0, exp: 9_999_999_999 })));
    expect(() => verifyJwt(`${header}.${payload}.`, secret)).toThrow('unsupported algorithm');
    expect(() => verifyJwt('not-a-token', secret)).toThrow('malformed token');
    expect(() => verifyJwt('a.b.c', secret)).toThrow(JwtError);
  });
});
