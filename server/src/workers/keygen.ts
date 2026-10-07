import { Worker } from 'node:worker_threads';
import type { RsaKeyPair } from '../crypto/rsa.ts';

export interface GeneratedKeyPair {
  keyPair: RsaKeyPair;
  ms: number;
}

export function generateKeyPairInWorker(bits: number): Promise<GeneratedKeyPair> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./keygen.bootstrap.mjs', import.meta.url), { workerData: { bits } });
    worker.once('message', (result: GeneratedKeyPair) => resolve(result));
    worker.once('error', reject);
    worker.once('exit', (code) => {
      if (code !== 0) reject(new Error(`RSA key generation worker exited with code ${code}`));
    });
  });
}
