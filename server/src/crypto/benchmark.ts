// Pengukuran kecepatan primitif. Dipakai untuk mengkalibrasi batas ukuran file dan
// jumlah iterasi PBKDF2, dan ditampilkan di panel Benchmark pada Crypto Lab.
import { gcmDecrypt, gcmEncrypt } from './gcm.ts';
import { oaepDecrypt, oaepEncrypt, oaepMaxMessageLength } from './oaep.ts';
import { pbkdf2Sha256 } from './pbkdf2.ts';
import { pssSignDigest, pssVerifyDigest } from './pss.ts';
import { randomBytes } from './random.ts';
import { type RsaKeyPair } from './rsa.ts';
import { sha256 } from './sha256.ts';
import { bitLength } from './bigint.ts';

export interface ThroughputResult {
  megabytes: number;
  ms: number;
  megabytesPerSecond: number;
}

export interface BenchmarkReport {
  sha256: ThroughputResult;
  gcmEncrypt: ThroughputResult;
  gcmDecrypt: ThroughputResult;
  pbkdf2: { iterations: number; ms: number };
  rsa: {
    bits: number;
    oaepEncryptMs: number;
    oaepDecryptMs: number;
    pssSignMs: number;
    pssVerifyMs: number;
    oaepMaxMessageBytes: number;
    // Laju jika RSA-OAEP dipakai langsung untuk data, sebagai pembanding hybrid encryption.
    oaepEncryptKilobytesPerSecond: number;
    oaepDecryptKilobytesPerSecond: number;
  };
}

function timeIt(run: () => void): number {
  const start = performance.now();
  run();
  return performance.now() - start;
}

function averageMs(repetitions: number, run: () => void): number {
  return timeIt(() => {
    for (let i = 0; i < repetitions; i++) run();
  }) / repetitions;
}

function throughput(megabytes: number, ms: number): ThroughputResult {
  return { megabytes, ms, megabytesPerSecond: megabytes / (ms / 1000) };
}

export function runBenchmark(keyPair: RsaKeyPair, pbkdf2Iterations: number, megabytes: number = 2): BenchmarkReport {
  const data = randomBytes(megabytes * 1024 * 1024);
  const key = randomBytes(32);
  const iv = randomBytes(12);

  // Satu putaran pemanasan agar JIT sudah mengoptimalkan kode sebelum diukur.
  sha256(data.subarray(0, 65536));
  gcmEncrypt(key, iv, data.subarray(0, 65536));

  const sha256Ms = timeIt(() => sha256(data));
  let encrypted = gcmEncrypt(key, iv, data.subarray(0, 16));
  const gcmEncryptMs = timeIt(() => {
    encrypted = gcmEncrypt(key, iv, data);
  });
  const gcmDecryptMs = timeIt(() => gcmDecrypt(key, iv, encrypted.ciphertext, encrypted.tag));

  const password = randomBytes(16);
  const salt = randomBytes(16);
  const pbkdf2Ms = timeIt(() => pbkdf2Sha256(password, salt, pbkdf2Iterations, 32));

  const aesKey = randomBytes(32);
  const digest = sha256(aesKey);
  const wrapped = oaepEncrypt(keyPair.publicKey, aesKey);
  const signature = pssSignDigest(keyPair.privateKey, digest);

  const oaepEncryptMs = averageMs(20, () => oaepEncrypt(keyPair.publicKey, aesKey));
  const oaepDecryptMs = averageMs(10, () => oaepDecrypt(keyPair.privateKey, wrapped));
  const pssSignMs = averageMs(10, () => pssSignDigest(keyPair.privateKey, digest));
  const pssVerifyMs = averageMs(20, () => pssVerifyDigest(keyPair.publicKey, digest, signature));

  const maxMessage = oaepMaxMessageLength(keyPair.publicKey);
  return {
    sha256: throughput(megabytes, sha256Ms),
    gcmEncrypt: throughput(megabytes, gcmEncryptMs),
    gcmDecrypt: throughput(megabytes, gcmDecryptMs),
    pbkdf2: { iterations: pbkdf2Iterations, ms: pbkdf2Ms },
    rsa: {
      bits: bitLength(keyPair.publicKey.n),
      oaepEncryptMs,
      oaepDecryptMs,
      pssSignMs,
      pssVerifyMs,
      oaepMaxMessageBytes: maxMessage,
      oaepEncryptKilobytesPerSecond: maxMessage / 1024 / (oaepEncryptMs / 1000),
      oaepDecryptKilobytesPerSecond: maxMessage / 1024 / (oaepDecryptMs / 1000),
    },
  };
}
