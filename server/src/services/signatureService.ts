// Digital signature RSA-PSS atas hash SHA-256 isi file asli (plaintext).
import { base64urlDecode, base64urlEncode, bytesToHex } from '../crypto/bytes.ts';
import { pssSignDigest, pssVerifyDigest } from '../crypto/pss.ts';
import { publicKeyFromJwk } from '../crypto/rsa.ts';
import { sha256 } from '../crypto/sha256.ts';
import { badRequest, notFound } from '../errors.ts';
import type { FileDocument } from '../models/StoredFile.ts';
import { User, type UserDocument } from '../models/User.ts';
import { decryptStoredFile, hashPlaintext } from './fileService.ts';
import { deriveUserKek, openPrivateKey } from './keyService.ts';
import { type Tracer, preview } from './trace.ts';

export const SIGNATURE_FORMAT = 'crypta-signature-v1';
export const SIGNATURE_ALGORITHM = 'RSA-PSS-SHA256';

// Isi file .sig: detached signature yang bisa dibagikan terpisah dari filenya.
export interface DetachedSignature {
  format: string;
  algorithm: string;
  signer: string;
  keyFingerprint: string;
  fileName: string;
  fileHash: string;
  signature: string;
  signedAt: string;
}

export interface VerificationResult {
  valid: boolean;
  reason: string;
  signer: string | null;
  keyFingerprint: string | null;
  signedAt: string | null;
  fileName: string | null;
  fileHash: string;
}

const REASON_VALID = 'Signature valid. File tidak berubah sejak ditandatangani.';
const REASON_INVALID = 'Signature tidak valid. File telah berubah, atau signature ini bukan untuk file tersebut.';

export async function signFile(file: FileDocument, owner: UserDocument, password: string, tracer: Tracer): Promise<void> {
  const kek = deriveUserKek(owner, password, tracer);
  const encryptionKey = openPrivateKey(owner, kek, 'enc', tracer);
  const signingKey = openPrivateKey(owner, kek, 'sig', tracer);

  const plaintext = await decryptStoredFile(file, owner, encryptionKey, tracer);
  const hash = hashPlaintext(plaintext, tracer);

  const signature = tracer.step(
    'Tanda tangani hash dengan private signing key',
    'RSA-PSS',
    () => pssSignDigest(signingKey, hash),
    (value) => ({ fingerprintKunci: owner.sigKeyFingerprint, panjangSalt: '32 byte', signature: preview(value, 16) }),
  );

  file.signature = {
    value: base64urlEncode(signature),
    signerId: owner._id,
    keyFingerprint: owner.sigKeyFingerprint,
    signedAt: new Date(),
  };
  await file.save();
}

export async function verifyStoredFile(
  file: FileDocument,
  user: UserDocument,
  password: string,
  tracer: Tracer,
): Promise<VerificationResult> {
  const stored = file.signature;
  if (!stored) throw badRequest('File ini belum ditandatangani.');

  const kek = deriveUserKek(user, password, tracer);
  const encryptionKey = openPrivateKey(user, kek, 'enc', tracer);
  const plaintext = await decryptStoredFile(file, user, encryptionKey, tracer);
  const hash = hashPlaintext(plaintext, tracer);

  const signer = await User.findById(stored.signerId);
  if (!signer) throw notFound('Penanda tangan tidak ditemukan.');

  const valid = tracer.step(
    'Verifikasi signature dengan public key penanda tangan',
    'RSA-PSS',
    () => pssVerifyDigest(publicKeyFromJwk(signer.sigPublicKey), hash, base64urlDecode(stored.value)),
    (result) => ({ penandaTangan: signer.username, fingerprintKunci: signer.sigKeyFingerprint, hasil: result ? 'valid' : 'tidak valid' }),
  );

  return {
    valid,
    reason: valid ? REASON_VALID : REASON_INVALID,
    signer: signer.username,
    keyFingerprint: signer.sigKeyFingerprint,
    signedAt: stored.signedAt.toISOString(),
    fileName: file.originalName,
    fileHash: bytesToHex(hash),
  };
}

export async function exportSignature(file: FileDocument): Promise<DetachedSignature> {
  const stored = file.signature;
  if (!stored) throw badRequest('File ini belum ditandatangani.');
  const signer = await User.findById(stored.signerId);
  if (!signer) throw notFound('Penanda tangan tidak ditemukan.');

  return {
    format: SIGNATURE_FORMAT,
    algorithm: SIGNATURE_ALGORITHM,
    signer: signer.username,
    keyFingerprint: stored.keyFingerprint,
    fileName: file.originalName,
    fileHash: file.plaintextHash,
    signature: stored.value,
    signedAt: stored.signedAt.toISOString(),
  };
}

function parseDetachedSignature(raw: Uint8Array): DetachedSignature {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw));
  } catch {
    throw badRequest('File .sig tidak bisa dibaca.');
  }
  if (parsed === null || typeof parsed !== 'object') throw badRequest('File .sig tidak bisa dibaca.');

  const candidate = parsed as Record<string, unknown>;
  const fields = ['format', 'algorithm', 'signer', 'keyFingerprint', 'fileName', 'fileHash', 'signature', 'signedAt'];
  for (const field of fields) {
    if (typeof candidate[field] !== 'string') throw badRequest(`File .sig tidak lengkap: "${field}" tidak ada.`);
  }
  const signature = candidate as unknown as DetachedSignature;
  if (signature.format !== SIGNATURE_FORMAT || signature.algorithm !== SIGNATURE_ALGORITHM) {
    throw badRequest('Format atau algoritma file .sig tidak didukung.');
  }
  return signature;
}

// Verifikasi file dari luar Crypta. Hanya memakai public key, jadi tidak butuh password,
// dan file yang diperiksa tidak disimpan.
export async function verifyExternalFile(data: Uint8Array, rawSignature: Uint8Array, tracer: Tracer): Promise<VerificationResult> {
  const detached = parseDetachedSignature(rawSignature);

  const hash = tracer.step(
    'Hash file yang diunggah',
    'SHA-256',
    () => sha256(data),
    (value) => ({ ukuran: `${data.length} byte`, hash: bytesToHex(value), hashDiSig: detached.fileHash }),
  );

  const result: VerificationResult = {
    valid: false,
    reason: REASON_INVALID,
    signer: detached.signer,
    keyFingerprint: detached.keyFingerprint,
    signedAt: detached.signedAt,
    fileName: detached.fileName,
    fileHash: bytesToHex(hash),
  };

  const signer = await User.findOne({ username: detached.signer.toLowerCase() });
  if (!signer) {
    return { ...result, reason: `Penanda tangan "${detached.signer}" tidak terdaftar di Crypta.` };
  }
  if (signer.sigKeyFingerprint !== detached.keyFingerprint) {
    return { ...result, reason: `Fingerprint kunci di file .sig tidak cocok dengan kunci milik "${signer.username}".` };
  }

  let signatureBytes: Uint8Array;
  try {
    signatureBytes = base64urlDecode(detached.signature);
  } catch {
    return { ...result, reason: 'Nilai signature di file .sig rusak.' };
  }

  const valid = tracer.step(
    'Verifikasi signature dengan public key penanda tangan',
    'RSA-PSS',
    () => pssVerifyDigest(publicKeyFromJwk(signer.sigPublicKey), hash, signatureBytes),
    (ok) => ({ penandaTangan: signer.username, fingerprintKunci: signer.sigKeyFingerprint, hasil: ok ? 'valid' : 'tidak valid' }),
  );

  return { ...result, valid, reason: valid ? REASON_VALID : REASON_INVALID };
}
