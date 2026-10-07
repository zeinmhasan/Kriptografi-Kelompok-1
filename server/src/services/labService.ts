// Crypto Lab: simulasi tamper dan benchmark.
import { Types } from 'mongoose';
import { config } from '../config.ts';
import { type BenchmarkReport, runBenchmark } from '../crypto/benchmark.ts';
import { base64urlDecode, hexToBytes, utf8ToBytes } from '../crypto/bytes.ts';
import { GcmAuthenticationError, gcmDecrypt } from '../crypto/gcm.ts';
import { OaepDecryptionError, oaepDecrypt } from '../crypto/oaep.ts';
import { pssVerifyDigest } from '../crypto/pss.ts';
import { randomBytes } from '../crypto/random.ts';
import { publicKeyFromJwk } from '../crypto/rsa.ts';
import { sha256 } from '../crypto/sha256.ts';
import type { FileDocument } from '../models/StoredFile.ts';
import { User, type UserDocument } from '../models/User.ts';
import { type GeneratedKeyPair, generateKeyPairInWorker } from '../workers/keygen.ts';
import { fileAad, fileAadText, readCiphertext, unwrapFileKey, wrappedKeyFor } from './fileService.ts';
import { deriveUserKek, openPrivateKey } from './keyService.ts';
import type { Tracer } from './trace.ts';

export interface TamperExperiment {
  title: string;
  change: string;
  expected: 'diterima' | 'ditolak';
  outcome: 'diterima' | 'ditolak';
  detectedBy: string;
  passed: boolean;
  ms: number;
}

interface BitFlip {
  description: string;
  restore: () => void;
}

// Membalik satu bit acak di tempat. restore() mengembalikannya, sehingga data di memori
// bisa dipakai lagi untuk percobaan berikutnya tanpa menyalin seluruh buffer.
function flipRandomBit(bytes: Uint8Array, name: string): BitFlip {
  const [a, b, c, d, bitSource] = randomBytes(5);
  const position = (((a << 24) | (b << 16) | (c << 8) | d) >>> 0) % bytes.length;
  const mask = 1 << (bitSource & 7);
  const before = bytes[position];
  bytes[position] ^= mask;
  const hex = (value: number) => `0x${value.toString(16).padStart(2, '0')}`;
  return {
    description: `${name} byte ke-${position}: ${hex(before)} menjadi ${hex(bytes[position])}`,
    restore: () => {
      bytes[position] = before;
    },
  };
}

// Menjalankan satu percobaan. Error bertipe `rejection` berarti data ditolak;
// error lain adalah bug dan diteruskan.
function attempt(run: () => boolean, rejection?: new () => Error): { accepted: boolean; ms: number } {
  const start = performance.now();
  let accepted: boolean;
  try {
    accepted = run();
  } catch (error) {
    if (!rejection || !(error instanceof rejection)) throw error;
    accepted = false;
  }
  return { accepted, ms: performance.now() - start };
}

function experiment(
  title: string,
  change: string,
  expected: TamperExperiment['expected'],
  detectedBy: string,
  result: { accepted: boolean; ms: number },
): TamperExperiment {
  const outcome = result.accepted ? 'diterima' : 'ditolak';
  return { title, change, expected, outcome, detectedBy, passed: outcome === expected, ms: result.ms };
}

// Semua perubahan dilakukan pada salinan di memori. File di storage dan record di
// database tidak disentuh.
export async function runTamperExperiments(
  file: FileDocument,
  user: UserDocument,
  password: string,
  tracer: Tracer,
): Promise<TamperExperiment[]> {
  const kek = deriveUserKek(user, password, tracer);
  const privateKey = openPrivateKey(user, kek, 'enc', tracer);
  const fileKey = unwrapFileKey(file, user, privateKey, tracer);

  const ciphertext = (await readCiphertext(file)).slice();
  const iv = hexToBytes(file.iv);
  const tag = hexToBytes(file.authTag);
  const aad = fileAad(file);
  const experiments: TamperExperiment[] = [];

  let plaintext: Uint8Array = new Uint8Array(0);
  const decryptOk = () => {
    plaintext = gcmDecrypt(fileKey, iv, ciphertext, tag, aad);
    return true;
  };
  const tryDecrypt = () => attempt(() => (gcmDecrypt(fileKey, iv, ciphertext, tag, aad), true), GcmAuthenticationError);

  experiments.push(
    experiment('Kontrol: data tidak diubah', 'Tidak ada', 'diterima', 'Tag GCM cocok', attempt(decryptOk, GcmAuthenticationError)),
  );

  if (ciphertext.length > 0) {
    const flip = flipRandomBit(ciphertext, 'Ciphertext');
    experiments.push(experiment('Satu bit ciphertext dibalik', flip.description, 'ditolak', 'Tag GCM', tryDecrypt()));
    flip.restore();
  }

  {
    const flip = flipRandomBit(tag, 'Auth tag');
    experiments.push(experiment('Satu bit auth tag dibalik', flip.description, 'ditolak', 'Tag GCM', tryDecrypt()));
    flip.restore();
  }

  {
    const flip = flipRandomBit(iv, 'IV');
    experiments.push(experiment('Satu bit IV dibalik', flip.description, 'ditolak', 'Tag GCM', tryDecrypt()));
    flip.restore();
  }

  {
    const otherOwner = new Types.ObjectId().toString();
    const forgedAad = fileAadText(file.id, otherOwner);
    experiments.push(
      experiment(
        'Ciphertext diklaim milik user lain',
        `AAD diganti menjadi ${forgedAad}`,
        'ditolak',
        'AAD pada tag GCM',
        attempt(() => (gcmDecrypt(fileKey, iv, ciphertext, tag, utf8ToBytes(forgedAad)), true), GcmAuthenticationError),
      ),
    );
  }

  {
    const wrapped = wrappedKeyFor(file, user);
    const flip = flipRandomBit(wrapped, 'Wrapped key');
    experiments.push(
      experiment(
        'Satu bit kunci AES terbungkus dibalik',
        flip.description,
        'ditolak',
        'Padding RSA-OAEP',
        attempt(() => (oaepDecrypt(privateKey, wrapped), true), OaepDecryptionError),
      ),
    );
  }

  const stored = file.signature;
  const signer = stored ? await User.findById(stored.signerId) : null;
  if (stored && signer) {
    const publicKey = publicKeyFromJwk(signer.sigPublicKey);
    const signature = base64urlDecode(stored.value);
    const verify = () => attempt(() => pssVerifyDigest(publicKey, sha256(plaintext), signature));

    experiments.push(experiment('Kontrol: signature atas file asli', 'Tidak ada', 'diterima', 'Signature RSA-PSS cocok', verify()));

    if (plaintext.length > 0) {
      const flip = flipRandomBit(plaintext, 'Isi file');
      experiments.push(experiment('Satu bit isi file dibalik', flip.description, 'ditolak', 'Signature RSA-PSS', verify()));
      flip.restore();
    }

    const flip = flipRandomBit(signature, 'Signature');
    experiments.push(experiment('Satu bit signature dibalik', flip.description, 'ditolak', 'Signature RSA-PSS', verify()));
    flip.restore();
  }

  return experiments;
}

export interface BenchmarkResponse extends BenchmarkReport {
  keygen: { bits: number; ms: number };
}

// Kunci RSA untuk benchmark dibangkitkan sekali lalu dipakai ulang.
let benchmarkKey: Promise<GeneratedKeyPair> | undefined;

export async function runLabBenchmark(): Promise<BenchmarkResponse> {
  benchmarkKey ??= generateKeyPairInWorker(config.rsaBits);
  let generated: GeneratedKeyPair;
  try {
    generated = await benchmarkKey;
  } catch (error) {
    benchmarkKey = undefined;
    throw error;
  }
  const report = runBenchmark(generated.keyPair, config.pbkdf2Iterations);
  return { ...report, keygen: { bits: config.rsaBits, ms: generated.ms } };
}

