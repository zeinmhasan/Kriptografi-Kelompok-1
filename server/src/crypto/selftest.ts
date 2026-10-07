// Known-answer test: setiap primitif dijalankan terhadap vektor uji dari standar resminya.
// Dipakai oleh Vitest dan oleh panel Self-Test di Crypto Lab.
import { Aes } from './aes.ts';
import { modInverse } from './bigint.ts';
import { base64urlEncode, bytesToHex, hexToBytes, utf8ToBytes } from './bytes.ts';
import { GcmAuthenticationError, gcmDecrypt, gcmEncrypt } from './gcm.ts';
import { hmacSha256 } from './hmac.ts';
import { mgf1Sha256 } from './mgf1.ts';
import { OaepDecryptionError, oaepDecrypt, oaepEncrypt } from './oaep.ts';
import { pbkdf2Sha256 } from './pbkdf2.ts';
import { pssSign, pssVerify } from './pss.ts';
import { randomBytes } from './random.ts';
import { generateKeyPair, rsaPrivateOperation, rsaPublicOperation, type RsaKeyPair } from './rsa.ts';
import { sha256 } from './sha256.ts';

export interface SelfTestResult {
  algorithm: string;
  name: string;
  source: string;
  passed: boolean;
  ms: number;
  error?: string;
}

interface SelfTestCase {
  algorithm: string;
  name: string;
  source: string;
  run: () => boolean;
}

const hex = hexToBytes;
const text = utf8ToBytes;

function repeat(byte: number, count: number): Uint8Array {
  return new Uint8Array(count).fill(byte);
}

const FIPS_180 = 'FIPS 180-4 / NIST CAVP';
const RFC_4231 = 'RFC 4231';
const RFC_7914 = 'RFC 7914 section 11';
const RFC_6070_STYLE = 'PBKDF2-HMAC-SHA256 vectors (password/salt)';
const FIPS_197 = 'FIPS 197 Appendix C';
const GCM_SPEC = 'GCM spec, McGrew & Viega';

const sha256Cases: SelfTestCase[] = [
  ['empty message', text(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
  ['"abc"', text('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
  [
    '448-bit message',
    text('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
    '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
  ],
  [
    'one million letters "a"',
    repeat(0x61, 1_000_000),
    'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0',
  ],
].map(([name, message, digest]) => ({
  algorithm: 'SHA-256',
  name: name as string,
  source: FIPS_180,
  run: () => bytesToHex(sha256(message as Uint8Array)) === digest,
}));

const hmacCases: SelfTestCase[] = [
  [
    'test case 1',
    repeat(0x0b, 20),
    text('Hi There'),
    'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7',
  ],
  [
    'test case 2',
    text('Jefe'),
    text('what do ya want for nothing?'),
    '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
  ],
  [
    'test case 3',
    repeat(0xaa, 20),
    repeat(0xdd, 50),
    '773ea91e36800e46854db8ebd09181a72959098b3ef8c122d9635514ced565fe',
  ],
  [
    'test case 6, key longer than the block',
    repeat(0xaa, 131),
    text('Test Using Larger Than Block-Size Key - Hash Key First'),
    '60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54',
  ],
].map(([name, key, message, mac]) => ({
  algorithm: 'HMAC-SHA256',
  name: name as string,
  source: RFC_4231,
  run: () => bytesToHex(hmacSha256(key as Uint8Array, message as Uint8Array)) === mac,
}));

const pbkdf2Cases: SelfTestCase[] = [
  {
    algorithm: 'PBKDF2-HMAC-SHA256',
    name: '"passwd" / "salt", 1 iteration, 64 bytes',
    source: RFC_7914,
    run: () =>
      bytesToHex(pbkdf2Sha256(text('passwd'), text('salt'), 1, 64)) ===
      '55ac046e56e3089fec1691c22544b605f94185216dde0465e68b9d57c20dacbc' +
        '49ca9cccf179b645991664b39d77ef317c71b845b1e30bd509112041d3a19783',
  },
  {
    algorithm: 'PBKDF2-HMAC-SHA256',
    name: '"password" / "salt", 1 iteration',
    source: RFC_6070_STYLE,
    run: () =>
      bytesToHex(pbkdf2Sha256(text('password'), text('salt'), 1, 32)) ===
      '120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b',
  },
  {
    algorithm: 'PBKDF2-HMAC-SHA256',
    name: '"password" / "salt", 2 iterations',
    source: RFC_6070_STYLE,
    run: () =>
      bytesToHex(pbkdf2Sha256(text('password'), text('salt'), 2, 32)) ===
      'ae4d0c95af6b46d32d0adff928f06dd02a303f8ef3c251dfd6e2d85a95474c43',
  },
  {
    algorithm: 'PBKDF2-HMAC-SHA256',
    name: '"password" / "salt", 4096 iterations',
    source: RFC_6070_STYLE,
    run: () =>
      bytesToHex(pbkdf2Sha256(text('password'), text('salt'), 4096, 32)) ===
      'c5e478d59288c841aa530db6845c4c8d962893a001ce4e11a4963873aa98134a',
  },
];

const AES_PLAINTEXT = '00112233445566778899aabbccddeeff';

const aesCases: SelfTestCase[] = [
  ['AES-128', '000102030405060708090a0b0c0d0e0f', '69c4e0d86a7b0430d8cdb78070b4c55a'],
  ['AES-192', '000102030405060708090a0b0c0d0e0f1011121314151617', 'dda97ca4864cdfe06eaf70a0ec0d7191'],
  [
    'AES-256',
    '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
    '8ea2b7ca516745bfeafc49904b496089',
  ],
].flatMap(([name, key, ciphertext]) => [
  {
    algorithm: 'AES',
    name: `${name} cipher`,
    source: FIPS_197,
    run: () => {
      const out = new Uint8Array(16);
      new Aes(hex(key)).encryptBlock(hex(AES_PLAINTEXT), 0, out, 0);
      return bytesToHex(out) === ciphertext;
    },
  },
  {
    algorithm: 'AES',
    name: `${name} inverse cipher`,
    source: FIPS_197,
    run: () => {
      const out = new Uint8Array(16);
      new Aes(hex(key)).decryptBlock(hex(ciphertext), 0, out, 0);
      return bytesToHex(out) === AES_PLAINTEXT;
    },
  },
]);

const GCM_KEY = 'feffe9928665731c6d6a8f9467308308feffe9928665731c6d6a8f9467308308';
const GCM_PLAINTEXT_64 =
  'd9313225f88406e5a55909c5aff5269a86a7a9531534f7da2e4c303d8a318a72' +
  '1c3c0c95956809532fcf0e2449a6b525b16aedf5aa0de657ba637b391aafd255';
const GCM_PLAINTEXT_60 = GCM_PLAINTEXT_64.slice(0, 120);
const GCM_AAD = 'feedfacedeadbeeffeedfacedeadbeefabaddad2';

export interface GcmVector {
  name: string;
  key: string;
  iv: string;
  plaintext: string;
  aad: string;
  ciphertext: string;
  tag: string;
}

export const GCM_VECTORS: GcmVector[] = [
  {
    name: 'test case 13: empty plaintext',
    key: '00'.repeat(32),
    iv: '00'.repeat(12),
    plaintext: '',
    aad: '',
    ciphertext: '',
    tag: '530f8afbc74536b9a963b4f1c4cb738b',
  },
  {
    name: 'test case 14: one zero block',
    key: '00'.repeat(32),
    iv: '00'.repeat(12),
    plaintext: '00'.repeat(16),
    aad: '',
    ciphertext: 'cea7403d4d606b6e074ec5d3baf39d18',
    tag: 'd0d1c8a799996bf0265b98b5d48ab919',
  },
  {
    name: 'test case 15: four blocks',
    key: GCM_KEY,
    iv: 'cafebabefacedbaddecaf888',
    plaintext: GCM_PLAINTEXT_64,
    aad: '',
    ciphertext:
      '522dc1f099567d07f47f37a32a84427d643a8cdcbfe5c0c97598a2bd2555d1aa' +
      '8cb08e48590dbb3da7b08b1056828838c5f61e6393ba7a0abcc9f662898015ad',
    tag: 'b094dac5d93471bdec1a502270e3cc6c',
  },
  {
    name: 'test case 16: with AAD, partial final block',
    key: GCM_KEY,
    iv: 'cafebabefacedbaddecaf888',
    plaintext: GCM_PLAINTEXT_60,
    aad: GCM_AAD,
    ciphertext:
      '522dc1f099567d07f47f37a32a84427d643a8cdcbfe5c0c97598a2bd2555d1aa' +
      '8cb08e48590dbb3da7b08b1056828838c5f61e6393ba7a0abcc9f662',
    tag: '76fc6ece0f4e1768cddf8853bb2d551b',
  },
  {
    name: 'test case 17: 64-bit IV',
    key: GCM_KEY,
    iv: 'cafebabefacedbad',
    plaintext: GCM_PLAINTEXT_60,
    aad: GCM_AAD,
    ciphertext:
      'c3762df1ca787d32ae47c13bf19844cbaf1ae14d0b976afac52ff7d79bba9de0' +
      'feb582d33934a4f0954cc2363bc73f7862ac430e64abe499f47c9b1f',
    tag: '3a337dbf46a792c45e454913fe2ea8f2',
  },
  {
    name: 'test case 18: 480-bit IV',
    key: GCM_KEY,
    iv:
      '9313225df88406e555909c5aff5269aa6a7a9538534f7da1e4c303d2a318a728' +
      'c3c0c95156809539fcf0e2429a6b525416aedbf5a0de6a57a637b39b',
    plaintext: GCM_PLAINTEXT_60,
    aad: GCM_AAD,
    ciphertext:
      '5a8def2f0c9e53f1f75d7853659e2a20eeb2b22aafde6419a058ab4f6f746bf4' +
      '0fc0c3b780f244452da3ebf1c5d82cdea2418997200ef82e44ae7e3f',
    tag: 'a44a8266ee1c8eb0c8b5d4cf5ae9f19a',
  },
];

const gcmCases: SelfTestCase[] = GCM_VECTORS.flatMap((vector) => [
  {
    algorithm: 'AES-256-GCM',
    name: `${vector.name} (encrypt)`,
    source: GCM_SPEC,
    run: () => {
      const result = gcmEncrypt(hex(vector.key), hex(vector.iv), hex(vector.plaintext), hex(vector.aad));
      return bytesToHex(result.ciphertext) === vector.ciphertext && bytesToHex(result.tag) === vector.tag;
    },
  },
  {
    algorithm: 'AES-256-GCM',
    name: `${vector.name} (decrypt)`,
    source: GCM_SPEC,
    run: () => {
      const plaintext = gcmDecrypt(
        hex(vector.key),
        hex(vector.iv),
        hex(vector.ciphertext),
        hex(vector.tag),
        hex(vector.aad),
      );
      return bytesToHex(plaintext) === vector.plaintext;
    },
  },
]);

gcmCases.push({
  algorithm: 'AES-256-GCM',
  name: 'a tag with one bit changed is rejected',
  source: 'Negative test',
  run: () => {
    const vector = GCM_VECTORS[3];
    const tag = hex(vector.tag);
    tag[0] ^= 0x01;
    try {
      gcmDecrypt(hex(vector.key), hex(vector.iv), hex(vector.ciphertext), tag, hex(vector.aad));
      return false;
    } catch (error) {
      return error instanceof GcmAuthenticationError;
    }
  },
});

const mgf1Cases: SelfTestCase[] = [
  {
    algorithm: 'MGF1-SHA256',
    name: 'seed "bar", 50 bytes',
    source: 'RFC 8017 appendix B.2.1',
    run: () =>
      bytesToHex(mgf1Sha256(text('bar'), 50)) ===
      '382576a7841021cc28fc4c0948753fb8312090cea942ea4c4e735d10dc724b15' +
        '5f9f6069f289d61daca0cb814502ef04eae1',
  },
];

const jwtCases: SelfTestCase[] = [
  {
    algorithm: 'JWT HS256',
    name: 'sample token signature',
    source: 'jwt.io sample token',
    run: () => {
      const signingInput =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
        'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ';
      const signature = hmacSha256(text('your-256-bit-secret'), text(signingInput));
      return base64urlEncode(signature) === 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    },
  },
];

// Contoh RSA buku teks: p = 61, q = 53, n = 3233, e = 17, d = 2753, m = 65, c = 2790.
function textbookRsaCases(): SelfTestCase[] {
  const p = 61n;
  const q = 53n;
  const d = 2753n;
  const key = { n: p * q, e: 17n, d, p, q, dp: d % (p - 1n), dq: d % (q - 1n), qInv: modInverse(q, p) };
  return [
    {
      algorithm: 'RSA',
      name: 'public-key operation, textbook example',
      source: 'Classic RSA example (n = 3233)',
      run: () => rsaPublicOperation(key, 65n) === 2790n,
    },
    {
      algorithm: 'RSA',
      name: 'private-key operation with CRT, textbook example',
      source: 'Classic RSA example (n = 3233)',
      run: () => rsaPrivateOperation(key, 2790n) === 65n,
    },
  ];
}

// OAEP dan PSS memakai nilai acak, sehingga diuji lewat konsistensi berpasangan
// pada kunci yang baru dibangkitkan, ditambah penolakan terhadap data yang diubah.
function pairwiseRsaCases(keyPair: RsaKeyPair, bits: number): SelfTestCase[] {
  const source = `Pairwise consistency, fresh ${bits}-bit key`;
  return [
    {
      algorithm: 'RSA-OAEP',
      name: 'encrypt then decrypt returns the message',
      source,
      run: () => {
        const message = randomBytes(32);
        const decrypted = oaepDecrypt(keyPair.privateKey, oaepEncrypt(keyPair.publicKey, message));
        return bytesToHex(decrypted) === bytesToHex(message);
      },
    },
    {
      algorithm: 'RSA-OAEP',
      name: 'a modified ciphertext is rejected',
      source,
      run: () => {
        const ciphertext = oaepEncrypt(keyPair.publicKey, randomBytes(32));
        ciphertext[ciphertext.length - 1] ^= 0x01;
        try {
          oaepDecrypt(keyPair.privateKey, ciphertext);
          return false;
        } catch (error) {
          return error instanceof OaepDecryptionError;
        }
      },
    },
    {
      algorithm: 'RSA-PSS',
      name: 'the signature verifies',
      source,
      run: () => {
        const message = randomBytes(100);
        return pssVerify(keyPair.publicKey, message, pssSign(keyPair.privateKey, message));
      },
    },
    {
      algorithm: 'RSA-PSS',
      name: 'a modified message is rejected',
      source,
      run: () => {
        const message = randomBytes(100);
        const signature = pssSign(keyPair.privateKey, message);
        message[0] ^= 0x01;
        return !pssVerify(keyPair.publicKey, message, signature);
      },
    },
    {
      algorithm: 'RSA-PSS',
      name: 'a modified signature is rejected',
      source,
      run: () => {
        const message = randomBytes(100);
        const signature = pssSign(keyPair.privateKey, message);
        signature[signature.length - 1] ^= 0x01;
        return !pssVerify(keyPair.publicKey, message, signature);
      },
    },
  ];
}

function runCase(testCase: SelfTestCase): SelfTestResult {
  const start = performance.now();
  let passed = false;
  let error: string | undefined;
  try {
    passed = testCase.run();
  } catch (thrown) {
    error = thrown instanceof Error ? thrown.message : String(thrown);
  }
  return {
    algorithm: testCase.algorithm,
    name: testCase.name,
    source: testCase.source,
    passed,
    ms: performance.now() - start,
    error,
  };
}

const SELF_TEST_RSA_BITS = 1024;

export function runSelfTests(): SelfTestResult[] {
  const results = [
    ...sha256Cases,
    ...hmacCases,
    ...pbkdf2Cases,
    ...aesCases,
    ...gcmCases,
    ...mgf1Cases,
    ...jwtCases,
    ...textbookRsaCases(),
  ].map(runCase);

  const keygenStart = performance.now();
  let keyPair: RsaKeyPair | undefined;
  let keygenError: string | undefined;
  try {
    keyPair = generateKeyPair(SELF_TEST_RSA_BITS);
  } catch (thrown) {
    keygenError = thrown instanceof Error ? thrown.message : String(thrown);
  }
  results.push({
    algorithm: 'RSA',
    name: `${SELF_TEST_RSA_BITS}-bit key generation: n = p * q and e * d = 1 (mod lambda)`,
    source: 'Key structure check',
    passed: keyPair !== undefined && isConsistentKey(keyPair),
    ms: performance.now() - keygenStart,
    error: keygenError,
  });

  if (keyPair) results.push(...pairwiseRsaCases(keyPair, SELF_TEST_RSA_BITS).map(runCase));
  return results;
}

function isConsistentKey({ publicKey, privateKey }: RsaKeyPair): boolean {
  const { n, e, d, p, q } = privateKey;
  if (publicKey.n !== n || publicKey.e !== e || p * q !== n) return false;
  // e * d = 1 modulo (p - 1) dan modulo (q - 1) setara dengan e * d = 1 modulo lambda(n).
  return (e * d) % (p - 1n) === 1n && (e * d) % (q - 1n) === 1n;
}
