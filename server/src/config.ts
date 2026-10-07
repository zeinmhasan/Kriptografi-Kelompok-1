import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { utf8ToBytes } from './crypto/bytes.ts';
import { randomBytes } from './crypto/random.ts';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

try {
  process.loadEnvFile(path.join(serverRoot, '.env'));
} catch {
  // Tanpa .env, semua nilai memakai default di bawah.
}

function integerFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

function loadJwtSecret(): Uint8Array {
  const raw = process.env.JWT_SECRET;
  if (raw) return utf8ToBytes(raw);
  console.warn('JWT_SECRET kosong: memakai rahasia acak, sesi login hangus setiap server di-restart.');
  return randomBytes(32);
}

export const config = {
  port: integerFromEnv('PORT', 4000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/crypta',
  jwtSecret: loadJwtSecret(),
  sessionSeconds: 8 * 60 * 60,
  rsaBits: integerFromEnv('RSA_BITS', 2048),
  pbkdf2Iterations: integerFromEnv('PBKDF2_ITERATIONS', 600_000),
  maxFileSize: integerFromEnv('MAX_FILE_SIZE_MB', 25) * 1024 * 1024,
  storageDir: process.env.STORAGE_DIR || path.join(serverRoot, 'storage', 'encrypted'),
};
