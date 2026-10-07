// Hybrid encryption untuk file: isi dienkripsi AES-256-GCM, kunci AES dibungkus RSA-OAEP.
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Types, isValidObjectId } from 'mongoose';
import { config } from '../config.ts';
import { base64urlDecode, base64urlEncode, bytesToHex, hexToBytes, utf8ToBytes } from '../crypto/bytes.ts';
import { gcmDecrypt, gcmEncrypt } from '../crypto/gcm.ts';
import { oaepDecrypt, oaepEncrypt } from '../crypto/oaep.ts';
import { randomBytes } from '../crypto/random.ts';
import { publicKeyFromJwk, type RsaPrivateKey } from '../crypto/rsa.ts';
import { sha256 } from '../crypto/sha256.ts';
import { HttpError, forbidden, notFound } from '../errors.ts';
import { type FileDocument, StoredFile } from '../models/StoredFile.ts';
import type { UserDocument } from '../models/User.ts';
import { type Tracer, byteCount, hidden, preview } from './trace.ts';

export interface UploadInput {
  originalName: string;
  mimeType: string;
  data: Uint8Array;
}

// AAD mengikat ciphertext ke record dan pemiliknya. File .enc yang ditukar ke record
// lain, atau record yang ownerId-nya diubah, gagal diverifikasi.
export function fileAadText(fileId: string, ownerId: string): string {
  return `crypta:file:${fileId}:${ownerId}`;
}

export function fileAad(file: FileDocument): Uint8Array {
  return utf8ToBytes(fileAadText(file.id, file.ownerId.toString()));
}

function storagePath(storedName: string): string {
  return path.join(config.storageDir, storedName);
}

export async function ensureStorageDir(): Promise<void> {
  await mkdir(config.storageDir, { recursive: true });
}

export async function storeEncryptedFile(owner: UserDocument, input: UploadInput, tracer: Tracer): Promise<FileDocument> {
  const { data } = input;
  const fileId = new Types.ObjectId();
  const aadText = fileAadText(fileId.toString(), owner.id);

  const plaintextHash = tracer.step(
    'Hash the original file contents',
    'SHA-256',
    () => sha256(data),
    (hash) => ({ size: byteCount(data.length), hash: bytesToHex(hash) }),
  );

  const { fileKey, iv } = tracer.step(
    'Generate a random AES key and IV',
    'CSPRNG',
    () => ({ fileKey: randomBytes(32), iv: randomBytes(12) }),
    (generated) => ({ aesKey: hidden(generated.fileKey), iv: bytesToHex(generated.iv) }),
  );

  const encrypted = tracer.step(
    'Encrypt the file contents',
    'AES-256-GCM',
    () => gcmEncrypt(fileKey, iv, data, utf8ToBytes(aadText)),
    (result) => ({
      aad: aadText,
      ciphertext: preview(result.ciphertext, 16),
      authTag: bytesToHex(result.tag),
    }),
  );

  const wrappedKey = tracer.step(
    "Wrap the AES key with the owner's public key",
    'RSA-OAEP',
    () => oaepEncrypt(publicKeyFromJwk(owner.encPublicKey), fileKey),
    (wrapped) => ({ publicKeyFingerprint: owner.encKeyFingerprint, wrappedKey: preview(wrapped, 16) }),
  );

  const storedName = `${bytesToHex(randomBytes(16))}.enc`;
  await writeFile(storagePath(storedName), encrypted.ciphertext);

  try {
    return await StoredFile.create({
      _id: fileId,
      ownerId: owner._id,
      originalName: input.originalName,
      storedName,
      size: data.length,
      mimeType: input.mimeType,
      iv: bytesToHex(iv),
      authTag: bytesToHex(encrypted.tag),
      plaintextHash: bytesToHex(plaintextHash),
      wrappedKeys: [{ userId: owner._id, wrappedKey: base64urlEncode(wrappedKey), sharedAt: new Date() }],
    });
  } catch (error) {
    await unlink(storagePath(storedName)).catch(() => {});
    throw error;
  }
}

export async function readCiphertext(file: FileDocument): Promise<Uint8Array> {
  try {
    const buffer = await readFile(storagePath(file.storedName));
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.length);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new HttpError(410, 'CIPHERTEXT_MISSING', 'The encrypted file is missing from storage.');
    }
    throw error;
  }
}

export function wrappedKeyFor(file: FileDocument, user: UserDocument): Uint8Array {
  const entry = file.wrappedKeys.find((key) => key.userId.equals(user._id));
  if (!entry) throw notFound('File not found.');
  return base64urlDecode(entry.wrappedKey);
}

export function unwrapFileKey(file: FileDocument, user: UserDocument, privateKey: RsaPrivateKey, tracer: Tracer): Uint8Array {
  const wrapped = wrappedKeyFor(file, user);
  return tracer.step(
    'Unwrap the file AES key with the private key',
    'RSA-OAEP',
    () => oaepDecrypt(privateKey, wrapped),
    (fileKey) => ({ wrappedKey: preview(wrapped, 16), aesKey: hidden(fileKey) }),
  );
}

export function decryptCiphertext(file: FileDocument, fileKey: Uint8Array, ciphertext: Uint8Array, tracer: Tracer): Uint8Array {
  return tracer.step(
    'Verify the tag, then decrypt the file contents',
    'AES-256-GCM',
    () => gcmDecrypt(fileKey, hexToBytes(file.iv), ciphertext, hexToBytes(file.authTag), fileAad(file)),
    (plaintext) => ({
      aad: fileAadText(file.id, file.ownerId.toString()),
      iv: file.iv,
      authTag: file.authTag,
      size: byteCount(plaintext.length),
    }),
  );
}

export async function decryptStoredFile(
  file: FileDocument,
  user: UserDocument,
  privateKey: RsaPrivateKey,
  tracer: Tracer,
): Promise<Uint8Array> {
  const fileKey = unwrapFileKey(file, user, privateKey, tracer);
  const ciphertext = await readCiphertext(file);
  return decryptCiphertext(file, fileKey, ciphertext, tracer);
}

export function hashPlaintext(plaintext: Uint8Array, tracer: Tracer): Uint8Array {
  return tracer.step(
    'Hash the file contents',
    'SHA-256',
    () => sha256(plaintext),
    (hash) => ({ hash: bytesToHex(hash) }),
  );
}

export function isOwner(file: FileDocument, user: UserDocument): boolean {
  return file.ownerId.equals(user._id);
}

// File yang bisa diakses user: miliknya sendiri atau yang dibagikan kepadanya.
// File milik orang lain dijawab 404, sama seperti file yang tidak ada.
export async function findAccessibleFile(id: string, user: UserDocument): Promise<FileDocument> {
  const file = isValidObjectId(id) ? await StoredFile.findById(id) : null;
  if (!file || !file.wrappedKeys.some((key) => key.userId.equals(user._id))) {
    throw notFound('File not found.');
  }
  return file;
}

export async function findOwnedFile(id: string, user: UserDocument): Promise<FileDocument> {
  const file = await findAccessibleFile(id, user);
  if (!isOwner(file, user)) throw forbidden('Only the file owner can do this.');
  return file;
}

export async function deleteStoredFile(file: FileDocument): Promise<void> {
  await file.deleteOne();
  await unlink(storagePath(file.storedName)).catch(() => {});
}
