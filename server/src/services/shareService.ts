// Berbagi file: kunci AES dibuka dengan private key pemilik lalu dibungkus ulang dengan
// public key penerima. Isi file tidak dienkripsi ulang.
import { isValidObjectId } from 'mongoose';
import { base64urlEncode } from '../crypto/bytes.ts';
import { oaepEncrypt } from '../crypto/oaep.ts';
import { publicKeyFromJwk } from '../crypto/rsa.ts';
import { badRequest, conflict, notFound } from '../errors.ts';
import type { FileDocument } from '../models/StoredFile.ts';
import { User, type UserDocument } from '../models/User.ts';
import { unwrapFileKey } from './fileService.ts';
import { deriveUserKek, openPrivateKey } from './keyService.ts';
import { type Tracer, preview } from './trace.ts';

export async function shareFile(
  file: FileDocument,
  owner: UserDocument,
  recipientUsername: string,
  password: string,
  tracer: Tracer,
): Promise<void> {
  const recipient = await User.findOne({ username: recipientUsername.trim().toLowerCase() });
  if (!recipient) throw notFound(`User "${recipientUsername}" tidak ditemukan.`);
  if (recipient._id.equals(owner._id)) throw badRequest('File tidak bisa dibagikan ke diri sendiri.');
  if (file.wrappedKeys.some((key) => key.userId.equals(recipient._id))) {
    throw conflict(`File sudah dibagikan ke "${recipient.username}".`);
  }

  const kek = deriveUserKek(owner, password, tracer);
  const privateKey = openPrivateKey(owner, kek, 'enc', tracer);
  const fileKey = unwrapFileKey(file, owner, privateKey, tracer);

  const wrappedForRecipient = tracer.step(
    'Bungkus ulang kunci AES dengan public key penerima',
    'RSA-OAEP',
    () => oaepEncrypt(publicKeyFromJwk(recipient.encPublicKey), fileKey),
    (wrapped) => ({
      penerima: recipient.username,
      fingerprintPublicKey: recipient.encKeyFingerprint,
      wrappedKey: preview(wrapped, 16),
    }),
  );

  file.wrappedKeys.push({
    userId: recipient._id,
    wrappedKey: base64urlEncode(wrappedForRecipient),
    sharedAt: new Date(),
  });
  await file.save();
}

// Mencabut akses berarti menghapus wrapped key milik penerima. Tanpa itu penerima
// tidak punya cara mendapatkan kunci AES file.
export async function revokeShare(file: FileDocument, owner: UserDocument, recipientId: string): Promise<void> {
  if (!isValidObjectId(recipientId)) throw notFound('Penerima tidak ditemukan.');
  if (owner._id.equals(recipientId)) throw badRequest('Akses pemilik tidak bisa dicabut.');

  const remaining = file.wrappedKeys.filter((key) => !key.userId.equals(recipientId));
  if (remaining.length === file.wrappedKeys.length) throw notFound('File tidak dibagikan ke user tersebut.');
  file.wrappedKeys = remaining;
  await file.save();
}
