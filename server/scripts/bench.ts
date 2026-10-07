// Kalibrasi: npm run bench
import { runBenchmark } from '../src/crypto/benchmark.ts';
import { generateKeyPair } from '../src/crypto/rsa.ts';

function time<T>(label: string, run: () => T): T {
  const start = performance.now();
  const result = run();
  console.log(`${label}: ${(performance.now() - start).toFixed(0)} ms`);
  return result;
}

const keygenTimes: number[] = [];
let keyPair = generateKeyPair(2048);
for (let i = 0; i < 5; i++) {
  const start = performance.now();
  keyPair = generateKeyPair(2048);
  keygenTimes.push(performance.now() - start);
}
console.log(`RSA-2048 keygen (5x): ${keygenTimes.map((ms) => ms.toFixed(0)).join(', ')} ms`);
time('RSA-3072 keygen (1x)', () => generateKeyPair(3072));

for (const iterations of [100_000, 600_000]) {
  const report = runBenchmark(keyPair, iterations, 4);
  console.log(`\nPBKDF2 ${iterations} iterasi: ${report.pbkdf2.ms.toFixed(0)} ms`);
  if (iterations !== 100_000) continue;
  console.log(`SHA-256: ${report.sha256.megabytesPerSecond.toFixed(1)} MB/s`);
  console.log(`AES-256-GCM enkripsi: ${report.gcmEncrypt.megabytesPerSecond.toFixed(2)} MB/s`);
  console.log(`AES-256-GCM dekripsi: ${report.gcmDecrypt.megabytesPerSecond.toFixed(2)} MB/s`);
  console.log(`RSA-${report.rsa.bits} OAEP enkripsi: ${report.rsa.oaepEncryptMs.toFixed(2)} ms`);
  console.log(`RSA-${report.rsa.bits} OAEP dekripsi: ${report.rsa.oaepDecryptMs.toFixed(2)} ms`);
  console.log(`RSA-${report.rsa.bits} PSS tanda tangan: ${report.rsa.pssSignMs.toFixed(2)} ms`);
  console.log(`RSA-${report.rsa.bits} PSS verifikasi: ${report.rsa.pssVerifyMs.toFixed(2)} ms`);
}
