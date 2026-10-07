// Uji silang dengan modul crypto Node.js. Modul itu hanya dipakai di sini sebagai
// pembanding; kode aplikasi tidak pernah memanggilnya selain untuk bilangan acak.
import nodeCrypto from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { Aes } from '../../src/crypto/aes.ts';
import { bytesToHex } from '../../src/crypto/bytes.ts';
import { gcmDecrypt, gcmEncrypt } from '../../src/crypto/gcm.ts';
import { hmacSha256 } from '../../src/crypto/hmac.ts';
import { oaepDecrypt, oaepEncrypt } from '../../src/crypto/oaep.ts';
import { pbkdf2Sha256 } from '../../src/crypto/pbkdf2.ts';
import { PSS_SALT_LENGTH, pssSign, pssVerify } from '../../src/crypto/pss.ts';
import { randomBytes } from '../../src/crypto/random.ts';
import { generateKeyPair, privateKeyToJwk, publicKeyToJwk, type RsaKeyPair } from '../../src/crypto/rsa.ts';
import { Sha256, sha256 } from '../../src/crypto/sha256.ts';

const hexOf = (buffer: Uint8Array) => bytesToHex(new Uint8Array(buffer));

describe('SHA-256 vs Node.js', () => {
  it('matches for every length around the block and padding boundaries', () => {
    for (let length = 0; length <= 200; length++) {
      const data = randomBytes(length);
      expect(bytesToHex(sha256(data))).toBe(nodeCrypto.createHash('sha256').update(data).digest('hex'));
    }
  });

  it('matches when the message is fed in uneven chunks', () => {
    const data = randomBytes(10_000);
    const hash = new Sha256();
    let offset = 0;
    for (const size of [1, 63, 64, 65, 127, 128, 1000, 7, 55, 56, 8434]) {
      hash.update(data.subarray(offset, offset + size));
      offset += size;
    }
    expect(offset).toBe(data.length);
    expect(bytesToHex(hash.digest())).toBe(nodeCrypto.createHash('sha256').update(data).digest('hex'));
  });
});

describe('HMAC-SHA256 vs Node.js', () => {
  it('matches for short, block-sized, and oversized keys', () => {
    for (const keyLength of [0, 1, 32, 63, 64, 65, 200]) {
      const key = randomBytes(keyLength);
      const data = randomBytes(300);
      expect(bytesToHex(hmacSha256(key, data))).toBe(
        nodeCrypto.createHmac('sha256', key).update(data).digest('hex'),
      );
    }
  });
});

describe('PBKDF2-HMAC-SHA256 vs Node.js', () => {
  it('matches across iteration counts and output lengths', () => {
    for (const [iterations, keyLength] of [
      [1, 32],
      [3, 20],
      [1000, 32],
      [250, 100],
    ]) {
      const password = randomBytes(12);
      const salt = randomBytes(16);
      expect(bytesToHex(pbkdf2Sha256(password, salt, iterations, keyLength))).toBe(
        nodeCrypto.pbkdf2Sync(password, salt, iterations, keyLength, 'sha256').toString('hex'),
      );
    }
  });
});

describe('AES block cipher vs Node.js', () => {
  it('matches AES-ECB for all three key sizes and inverts correctly', () => {
    for (const keyLength of [16, 24, 32]) {
      for (let trial = 0; trial < 20; trial++) {
        const key = randomBytes(keyLength);
        const block = randomBytes(16);
        const cipher = nodeCrypto.createCipheriv(`aes-${keyLength * 8}-ecb`, key, null).setAutoPadding(false);
        const expected = Buffer.concat([cipher.update(block), cipher.final()]);

        const aes = new Aes(key);
        const encrypted = new Uint8Array(16);
        aes.encryptBlock(block, 0, encrypted, 0);
        expect(bytesToHex(encrypted)).toBe(hexOf(expected));

        const decrypted = new Uint8Array(16);
        aes.decryptBlock(encrypted, 0, decrypted, 0);
        expect(bytesToHex(decrypted)).toBe(bytesToHex(block));
      }
    }
  });
});

describe('AES-256-GCM vs Node.js', () => {
  const lengths = [0, 1, 15, 16, 17, 31, 32, 33, 255, 256, 1000, 65_537];

  it('produces the same ciphertext and tag', () => {
    for (const length of lengths) {
      const key = randomBytes(32);
      const iv = randomBytes(12);
      const aad = randomBytes(length % 40);
      const plaintext = randomBytes(length);

      const cipher = nodeCrypto.createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(aad);
      const expected = Buffer.concat([cipher.update(plaintext), cipher.final()]);

      const ours = gcmEncrypt(key, iv, plaintext, aad);
      expect(bytesToHex(ours.ciphertext)).toBe(hexOf(expected));
      expect(bytesToHex(ours.tag)).toBe(hexOf(cipher.getAuthTag()));
    }
  });

  it('decrypts what Node.js encrypted', () => {
    for (const length of lengths) {
      const key = randomBytes(32);
      const iv = randomBytes(12);
      const aad = randomBytes(20);
      const plaintext = randomBytes(length);

      const cipher = nodeCrypto.createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(aad);
      const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

      const decrypted = gcmDecrypt(key, iv, ciphertext, cipher.getAuthTag(), aad);
      expect(bytesToHex(decrypted)).toBe(bytesToHex(plaintext));
    }
  });
});

describe('RSA vs Node.js', () => {
  let keyPair: RsaKeyPair;
  let nodePublicKey: nodeCrypto.KeyObject;
  let nodePrivateKey: nodeCrypto.KeyObject;

  beforeAll(() => {
    keyPair = generateKeyPair(2048);
    nodePublicKey = nodeCrypto.createPublicKey({ key: publicKeyToJwk(keyPair.publicKey), format: 'jwk' });
    nodePrivateKey = nodeCrypto.createPrivateKey({ key: privateKeyToJwk(keyPair.privateKey), format: 'jwk' });
  });

  const oaepOptions = (key: nodeCrypto.KeyObject) => ({
    key,
    padding: nodeCrypto.constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256',
  });

  const pssOptions = (key: nodeCrypto.KeyObject) => ({
    key,
    padding: nodeCrypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: PSS_SALT_LENGTH,
  });

  it('generates a 2048-bit key that Node.js accepts as valid', () => {
    expect(nodePrivateKey.asymmetricKeyDetails?.modulusLength).toBe(2048);
    expect(nodePrivateKey.asymmetricKeyDetails?.publicExponent).toBe(65537n);
  });

  it('OAEP: Node.js decrypts what Crypta encrypted', () => {
    for (const length of [0, 1, 32, 190]) {
      const message = randomBytes(length);
      const ciphertext = oaepEncrypt(keyPair.publicKey, message);
      const decrypted = nodeCrypto.privateDecrypt(oaepOptions(nodePrivateKey), ciphertext);
      expect(hexOf(decrypted)).toBe(bytesToHex(message));
    }
  });

  it('OAEP: Crypta decrypts what Node.js encrypted', () => {
    for (const length of [0, 1, 32, 190]) {
      const message = randomBytes(length);
      const ciphertext = nodeCrypto.publicEncrypt(oaepOptions(nodePublicKey), message);
      const decrypted = oaepDecrypt(keyPair.privateKey, new Uint8Array(ciphertext));
      expect(bytesToHex(decrypted)).toBe(bytesToHex(message));
    }
  });

  it('PSS: Node.js verifies what Crypta signed', () => {
    for (const length of [0, 1, 1000]) {
      const message = randomBytes(length);
      const signature = pssSign(keyPair.privateKey, message);
      expect(nodeCrypto.verify('sha256', message, pssOptions(nodePublicKey), signature)).toBe(true);
    }
  });

  it('PSS: Crypta verifies what Node.js signed', () => {
    for (const length of [0, 1, 1000]) {
      const message = randomBytes(length);
      const signature = nodeCrypto.sign('sha256', message, pssOptions(nodePrivateKey));
      expect(pssVerify(keyPair.publicKey, message, new Uint8Array(signature))).toBe(true);
    }
  });

  it('PSS: Crypta rejects a Node.js signature over a different message', () => {
    const signature = nodeCrypto.sign('sha256', randomBytes(64), pssOptions(nodePrivateKey));
    expect(pssVerify(keyPair.publicKey, randomBytes(64), new Uint8Array(signature))).toBe(false);
  });
});
