import { type HydratedDocument, Schema, model } from 'mongoose';
import type { RsaPublicJwk } from '../crypto/rsa.ts';

// Private key yang sudah dienkripsi AES-256-GCM dengan KEK turunan password.
export interface WrappedPrivateKey {
  ciphertext: string; // base64url
  iv: string; // hex
  tag: string; // hex
}

export interface UserAttributes {
  username: string;
  email: string;
  passwordHash: string;
  authSalt: string;
  kekSalt: string;
  kdfIterations: number;
  encPublicKey: RsaPublicJwk;
  sigPublicKey: RsaPublicJwk;
  encPrivateKey: WrappedPrivateKey;
  sigPrivateKey: WrappedPrivateKey;
  encKeyFingerprint: string;
  sigKeyFingerprint: string;
  createdAt: Date;
}

export type UserDocument = HydratedDocument<UserAttributes>;

const publicKeySchema = new Schema<RsaPublicJwk>(
  {
    kty: { type: String, required: true },
    n: { type: String, required: true },
    e: { type: String, required: true },
  },
  { _id: false },
);

const wrappedPrivateKeySchema = new Schema<WrappedPrivateKey>(
  {
    ciphertext: { type: String, required: true },
    iv: { type: String, required: true },
    tag: { type: String, required: true },
  },
  { _id: false },
);

const userSchema = new Schema<UserAttributes>(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    authSalt: { type: String, required: true },
    kekSalt: { type: String, required: true },
    kdfIterations: { type: Number, required: true },
    encPublicKey: { type: publicKeySchema, required: true },
    sigPublicKey: { type: publicKeySchema, required: true },
    encPrivateKey: { type: wrappedPrivateKeySchema, required: true },
    sigPrivateKey: { type: wrappedPrivateKeySchema, required: true },
    encKeyFingerprint: { type: String, required: true },
    sigKeyFingerprint: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const User = model<UserAttributes>('User', userSchema);
