// Pembangkitan kunci RSA memakan waktu, jadi dijalankan di worker thread
// supaya server tetap bisa melayani permintaan lain.
import { parentPort, workerData } from 'node:worker_threads';
import { generateKeyPair } from '../crypto/rsa.ts';

const start = performance.now();
const keyPair = generateKeyPair(workerData.bits);
parentPort?.postMessage({ keyPair, ms: performance.now() - start });
