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
import { type Tracer, byteCount, preview } from './trace.ts';

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

const REASON_VALID = 'The file has not changed since it was signed.';
const REASON_INVALID = 'The file has changed, or this signature belongs to a different file.';

export async function signFile(file: FileDocument, owner: UserDocument, password: string, tracer: Tracer): Promise<void> {
  const kek = deriveUserKek(owner, password, tracer);
  const encryptionKey = openPrivateKey(owner, kek, 'enc', tracer);
  const signingKey = openPrivateKey(owner, kek, 'sig', tracer);

  const plaintext = await decryptStoredFile(file, owner, encryptionKey, tracer);
  const hash = hashPlaintext(plaintext, tracer);

  const signature = tracer.step(
    'Sign the hash with the private signing key',
    'RSA-PSS',
    () => pssSignDigest(signingKey, hash),
    (value) => ({ keyFingerprint: owner.sigKeyFingerprint, saltLength: '32 bytes', signature: preview(value, 16) }),
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
  if (!stored) throw badRequest('This file has not been signed yet.');

  const kek = deriveUserKek(user, password, tracer);
  const encryptionKey = openPrivateKey(user, kek, 'enc', tracer);
  const plaintext = await decryptStoredFile(file, user, encryptionKey, tracer);
  const hash = hashPlaintext(plaintext, tracer);

  const signer = await User.findById(stored.signerId);
  if (!signer) throw notFound('Signer not found.');

  const valid = tracer.step(
    "Verify the signature with the signer's public key",
    'RSA-PSS',
    () => pssVerifyDigest(publicKeyFromJwk(signer.sigPublicKey), hash, base64urlDecode(stored.value)),
    (result) => ({ signer: signer.username, keyFingerprint: signer.sigKeyFingerprint, result: result ? 'valid' : 'invalid' }),
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
  if (!stored) throw badRequest('This file has not been signed yet.');
  const signer = await User.findById(stored.signerId);
  if (!signer) throw notFound('Signer not found.');

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
    throw badRequest('The .sig file could not be read.');
  }
  if (parsed === null || typeof parsed !== 'object') throw badRequest('The .sig file could not be read.');

  const candidate = parsed as Record<string, unknown>;
  const fields = ['format', 'algorithm', 'signer', 'keyFingerprint', 'fileName', 'fileHash', 'signature', 'signedAt'];
  for (const field of fields) {
    if (typeof candidate[field] !== 'string') throw badRequest(`The .sig file is incomplete: "${field}" is missing.`);
  }
  const signature = candidate as unknown as DetachedSignature;
  if (signature.format !== SIGNATURE_FORMAT || signature.algorithm !== SIGNATURE_ALGORITHM) {
    throw badRequest('The .sig file uses an unsupported format or algorithm.');
  }
  return signature;
}

// Verifikasi file dari luar Crypta. Hanya memakai public key, jadi tidak butuh password,
// dan file yang diperiksa tidak disimpan.
export async function verifyExternalFile(data: Uint8Array, rawSignature: Uint8Array, tracer: Tracer): Promise<VerificationResult> {
  const detached = parseDetachedSignature(rawSignature);

  const hash = tracer.step(
    'Hash the uploaded file',
    'SHA-256',
    () => sha256(data),
    (value) => ({ size: byteCount(data.length), hash: bytesToHex(value), hashInSigFile: detached.fileHash }),
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
    return { ...result, reason: `The signer "${detached.signer}" is not registered in Crypta.` };
  }
  if (signer.sigKeyFingerprint !== detached.keyFingerprint) {
    return { ...result, reason: `The key fingerprint in the .sig file does not match the key that belongs to "${signer.username}".` };
  }

  let signatureBytes: Uint8Array;
  try {
    signatureBytes = base64urlDecode(detached.signature);
  } catch {
    return { ...result, reason: 'The signature value in the .sig file is corrupted.' };
  }

  const valid = tracer.step(
    "Verify the signature with the signer's public key",
    'RSA-PSS',
    () => pssVerifyDigest(publicKeyFromJwk(signer.sigPublicKey), hash, signatureBytes),
    (ok) => ({ signer: signer.username, keyFingerprint: signer.sigKeyFingerprint, result: ok ? 'valid' : 'invalid' }),
  );

  return { ...result, valid, reason: valid ? REASON_VALID : REASON_INVALID };
}
