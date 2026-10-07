import type { Request, Response } from 'express';
import { base64urlEncode, bytesToHex, utf8ToBytes } from '../crypto/bytes.ts';
import { HttpError, badRequest } from '../errors.ts';
import { currentUser } from '../middleware/auth.ts';
import { cleanFileName, toBytes } from '../middleware/upload.ts';
import { StoredFile } from '../models/StoredFile.ts';
import {
  decryptStoredFile,
  deleteStoredFile,
  findAccessibleFile,
  hashPlaintext,
  isOwner,
  readCiphertext,
  storeEncryptedFile,
} from '../services/fileService.ts';
import { deriveUserKek, openPrivateKey } from '../services/keyService.ts';
import { serializeFile, serializeFiles } from '../services/serializers.ts';
import { Tracer } from '../services/trace.ts';
import { attachment, bodyString, routeParam } from './request.ts';

export async function listFiles(_req: Request, res: Response): Promise<void> {
  const user = currentUser(res);
  const files = await StoredFile.find({ 'wrappedKeys.userId': user._id }).sort({ createdAt: -1 });
  const serialized = await serializeFiles(files, user);
  res.json({
    owned: serialized.filter((file) => file.isOwner),
    shared: serialized.filter((file) => !file.isOwner),
  });
}

// Upload tidak butuh password: enkripsi hanya memakai public key pemilik.
export async function uploadFile(req: Request, res: Response): Promise<void> {
  const user = currentUser(res);
  if (!req.file) throw badRequest('No file was uploaded.');

  const tracer = new Tracer('Upload and encrypt');
  const file = await storeEncryptedFile(
    user,
    {
      originalName: cleanFileName(req.file.originalname),
      mimeType: req.file.mimetype || 'application/octet-stream',
      data: toBytes(req.file.buffer),
    },
    tracer,
  );
  res.status(201).json({ file: await serializeFile(file, user), trace: tracer.finish() });
}

export async function getFile(req: Request, res: Response): Promise<void> {
  const user = currentUser(res);
  const file = await findAccessibleFile(routeParam(req, 'id'), user);
  res.json({ file: await serializeFile(file, user) });
}

// Mengunduh ciphertext apa adanya. Tanpa kunci AES isinya tidak bisa dibaca.
export async function downloadEncrypted(req: Request, res: Response): Promise<void> {
  const user = currentUser(res);
  const file = await findAccessibleFile(routeParam(req, 'id'), user);
  const ciphertext = await readCiphertext(file);
  res.set({
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': attachment(`${file.originalName}.enc`),
    'X-Content-Type-Options': 'nosniff',
  });
  res.send(Buffer.from(ciphertext.buffer, ciphertext.byteOffset, ciphertext.length));
}

export async function decryptFile(req: Request, res: Response): Promise<void> {
  const user = currentUser(res);
  const password = bodyString(req, 'password', 'Password');
  const file = await findAccessibleFile(routeParam(req, 'id'), user);

  const tracer = new Tracer('Decrypt and download');
  const kek = deriveUserKek(user, password, tracer);
  const privateKey = openPrivateKey(user, kek, 'enc', tracer);
  const plaintext = await decryptStoredFile(file, user, privateKey, tracer);

  // Tag GCM sudah menjamin integritas. Hash dibandingkan lagi dengan catatan saat upload
  // sebagai pemeriksaan kedua yang terlihat di Crypto Inspector.
  const hash = bytesToHex(hashPlaintext(plaintext, tracer));
  if (hash !== file.plaintextHash) {
    throw new HttpError(422, 'INTEGRITY_FAILED', 'The hash of the decrypted file does not match the hash recorded at upload.');
  }

  // Isi file dikirim sebagai biner, jadi jejak langkah dititipkan di header.
  res.set({
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': attachment(file.originalName),
    'X-Content-Type-Options': 'nosniff',
    'X-Crypta-Trace': base64urlEncode(utf8ToBytes(JSON.stringify(tracer.finish()))),
  });
  res.send(Buffer.from(plaintext.buffer, plaintext.byteOffset, plaintext.length));
}

export async function deleteFile(req: Request, res: Response): Promise<void> {
  const user = currentUser(res);
  const file = await findAccessibleFile(routeParam(req, 'id'), user);
  if (isOwner(file, user)) {
    await deleteStoredFile(file);
    res.json({ ok: true, removed: 'file' });
    return;
  }

  // Penerima share tidak bisa menghapus file. Yang dihapus hanya wrapped key miliknya,
  // sehingga file hilang dari daftarnya dan ia tidak bisa lagi membukanya.
  file.wrappedKeys = file.wrappedKeys.filter((key) => !key.userId.equals(user._id));
  await file.save();
  res.json({ ok: true, removed: 'access' });
}
