// Bentuk data yang dikirim ke klien. Tidak ada kunci privat atau hash password di sini.
import type { Types } from 'mongoose';
import type { FileDocument } from '../models/StoredFile.ts';
import { User, type UserDocument } from '../models/User.ts';
import { isOwner } from './fileService.ts';

export function serializeUser(user: UserDocument) {
  return {
    id: user.id as string,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
    encKeyFingerprint: user.encKeyFingerprint,
    sigKeyFingerprint: user.sigKeyFingerprint,
  };
}

export function serializePublicKeys(user: UserDocument) {
  return {
    username: user.username,
    // Panjang modulus dihitung dari panjang teks base64url-nya (6 bit per karakter).
    rsaBits: Math.floor((user.encPublicKey.n.length * 6) / 8) * 8,
    encPublicKey: { kty: user.encPublicKey.kty, n: user.encPublicKey.n, e: user.encPublicKey.e },
    sigPublicKey: { kty: user.sigPublicKey.kty, n: user.sigPublicKey.n, e: user.sigPublicKey.e },
    encKeyFingerprint: user.encKeyFingerprint,
    sigKeyFingerprint: user.sigKeyFingerprint,
  };
}

async function usernamesById(ids: Types.ObjectId[]): Promise<Map<string, string>> {
  const users = await User.find({ _id: { $in: ids } }).select('username');
  return new Map(users.map((user) => [user.id as string, user.username]));
}

export async function serializeFiles(files: FileDocument[], viewer: UserDocument) {
  const ids = files.flatMap((file) => [
    file.ownerId,
    ...file.wrappedKeys.map((key) => key.userId),
    ...(file.signature ? [file.signature.signerId] : []),
  ]);
  const usernames = await usernamesById(ids);
  const nameOf = (id: Types.ObjectId) => usernames.get(id.toString()) ?? '(deleted user)';

  return files.map((file) => {
    const owned = isOwner(file, viewer);
    return {
      id: file.id as string,
      originalName: file.originalName,
      size: file.size,
      mimeType: file.mimeType,
      createdAt: file.createdAt.toISOString(),
      owner: { id: file.ownerId.toString(), username: nameOf(file.ownerId) },
      isOwner: owned,
      encryption: {
        algorithm: 'AES-256-GCM',
        keyAlgorithm: 'RSA-OAEP',
        storedName: file.storedName,
        iv: file.iv,
        authTag: file.authTag,
      },
      plaintextHash: file.plaintextHash,
      signature: file.signature
        ? {
            algorithm: 'RSA-PSS',
            signer: nameOf(file.signature.signerId),
            keyFingerprint: file.signature.keyFingerprint,
            signedAt: file.signature.signedAt.toISOString(),
          }
        : null,
      // Daftar penerima hanya terlihat oleh pemilik.
      sharedWith: owned
        ? file.wrappedKeys
            .filter((key) => !key.userId.equals(file.ownerId))
            .map((key) => ({
              id: key.userId.toString(),
              username: nameOf(key.userId),
              sharedAt: key.sharedAt.toISOString(),
            }))
        : [],
    };
  });
}

export async function serializeFile(file: FileDocument, viewer: UserDocument) {
  return (await serializeFiles([file], viewer))[0];
}
