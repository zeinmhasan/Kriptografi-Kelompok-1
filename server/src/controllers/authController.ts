import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { config } from '../config.ts';
import { constantTimeEqual, hexToBytes } from '../crypto/bytes.ts';
import { publicKeyFingerprint, publicKeyToJwk } from '../crypto/rsa.ts';
import { badRequest, conflict, unauthorized } from '../errors.ts';
import { currentUser, endSession, startSession } from '../middleware/auth.ts';
import { User } from '../models/User.ts';
import {
  deriveKek,
  derivePasswordHash,
  newSalt,
  unwrapPrivateKey,
  wrapPrivateKey,
} from '../services/keyService.ts';
import { serializeUser } from '../services/serializers.ts';
import { Tracer, hidden } from '../services/trace.ts';
import { generateKeyPairInWorker } from '../workers/keygen.ts';
import { bodyString } from './request.ts';

const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

function validatePassword(password: string, label: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) throw badRequest(`${label} must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  if (password.length > MAX_PASSWORD_LENGTH) throw badRequest(`${label} must be at most ${MAX_PASSWORD_LENGTH} characters.`);
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000;
}

export async function register(req: Request, res: Response): Promise<void> {
  const username = bodyString(req, 'username', 'Username').trim().toLowerCase();
  const email = bodyString(req, 'email', 'Email').trim().toLowerCase();
  const password = bodyString(req, 'password', 'Password');

  if (!USERNAME_PATTERN.test(username)) {
    throw badRequest('Username must be 3-32 characters: lowercase letters, digits, or underscores.');
  }
  if (!EMAIL_PATTERN.test(email)) throw badRequest('That email address is not valid.');
  validatePassword(password, 'Password');

  if (await User.exists({ $or: [{ username }, { email }] })) {
    throw conflict('That username or email is already registered.');
  }

  const tracer = new Tracer('Registration');
  const userId = new Types.ObjectId().toString();

  // Dua key pair terpisah: satu untuk enkripsi (RSA-OAEP), satu untuk tanda tangan (RSA-PSS).
  const [encryption, signing] = await Promise.all([
    generateKeyPairInWorker(config.rsaBits),
    generateKeyPairInWorker(config.rsaBits),
  ]);
  const encKeyFingerprint = publicKeyFingerprint(encryption.keyPair.publicKey);
  const sigKeyFingerprint = publicKeyFingerprint(signing.keyPair.publicKey);
  tracer.record('Generate the encryption key pair', `RSA-${config.rsaBits}`, encryption.ms, {
    fingerprint: encKeyFingerprint,
  });
  tracer.record('Generate the signing key pair', `RSA-${config.rsaBits}`, signing.ms, {
    fingerprint: sigKeyFingerprint,
  });

  const authSalt = newSalt();
  const kekSalt = newSalt();
  const iterations = config.pbkdf2Iterations;

  const passwordHash = tracer.step(
    'Hash the password for login',
    'PBKDF2-HMAC-SHA256',
    () => derivePasswordHash(password, authSalt, iterations),
    () => ({ iterations: iterations, salt: authSalt }),
  );
  const kek = tracer.step(
    'Derive the KEK from the password',
    'PBKDF2-HMAC-SHA256',
    () => deriveKek(password, kekSalt, iterations),
    (value) => ({ iterations: iterations, salt: kekSalt, kek: hidden(value) }),
  );

  const wrapped = tracer.step(
    'Wrap both private keys with the KEK',
    'AES-256-GCM',
    () => ({
      enc: wrapPrivateKey(kek, encryption.keyPair.privateKey, userId, 'enc'),
      sig: wrapPrivateKey(kek, signing.keyPair.privateKey, userId, 'sig'),
    }),
    (value) => ({ encryptionKeyIv: value.enc.iv, signingKeyIv: value.sig.iv }),
  );

  let user;
  try {
    user = await User.create({
      _id: userId,
      username,
      email,
      passwordHash,
      authSalt,
      kekSalt,
      kdfIterations: iterations,
      encPublicKey: publicKeyToJwk(encryption.keyPair.publicKey),
      sigPublicKey: publicKeyToJwk(signing.keyPair.publicKey),
      encPrivateKey: wrapped.enc,
      sigPrivateKey: wrapped.sig,
      encKeyFingerprint,
      sigKeyFingerprint,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) throw conflict('That username or email is already registered.');
    throw error;
  }

  startSession(res, user);
  res.status(201).json({ user: serializeUser(user), trace: tracer.finish() });
}

export async function login(req: Request, res: Response): Promise<void> {
  const identifier = bodyString(req, 'identifier', 'Username or email').trim().toLowerCase();
  const password = bodyString(req, 'password', 'Password');
  if (password.length > MAX_PASSWORD_LENGTH) throw unauthorized('Incorrect username or password.');

  const user = await User.findOne({ $or: [{ username: identifier }, { email: identifier }] });
  if (!user) {
    // Tetap menjalankan PBKDF2 supaya lama respons tidak membocorkan apakah user terdaftar.
    derivePasswordHash(password, newSalt(), config.pbkdf2Iterations);
    throw unauthorized('Incorrect username or password.');
  }

  const candidate = derivePasswordHash(password, user.authSalt, user.kdfIterations);
  if (!constantTimeEqual(hexToBytes(candidate), hexToBytes(user.passwordHash))) {
    throw unauthorized('Incorrect username or password.');
  }

  startSession(res, user);
  res.json({ user: serializeUser(user) });
}

export async function logout(_req: Request, res: Response): Promise<void> {
  endSession(res);
  res.json({ ok: true });
}

export async function me(_req: Request, res: Response): Promise<void> {
  res.json({ user: serializeUser(currentUser(res)) });
}

// Ganti password: private key dibuka dengan KEK lama lalu dibungkus ulang dengan KEK baru.
// File tidak perlu dienkripsi ulang karena key pair-nya tidak berubah.
export async function changePassword(req: Request, res: Response): Promise<void> {
  const user = currentUser(res);
  const currentPassword = bodyString(req, 'currentPassword', 'Current password');
  const newPassword = bodyString(req, 'newPassword', 'New password');
  validatePassword(newPassword, 'New password');
  if (newPassword === currentPassword) throw badRequest('The new password must be different from the current one.');

  const tracer = new Tracer('Change password');

  const oldKek = tracer.step(
    'Derive the old KEK',
    'PBKDF2-HMAC-SHA256',
    () => deriveKek(currentPassword, user.kekSalt, user.kdfIterations),
    (value) => ({ iterations: user.kdfIterations, salt: user.kekSalt, kek: hidden(value) }),
  );
  const privateKeys = tracer.step('Unlock both private keys with the old KEK', 'AES-256-GCM', () => ({
    enc: unwrapPrivateKey(oldKek, user.encPrivateKey, user.id, 'enc'),
    sig: unwrapPrivateKey(oldKek, user.sigPrivateKey, user.id, 'sig'),
  }));

  const authSalt = newSalt();
  const kekSalt = newSalt();
  const iterations = config.pbkdf2Iterations;

  const passwordHash = tracer.step(
    'Hash the new password for login',
    'PBKDF2-HMAC-SHA256',
    () => derivePasswordHash(newPassword, authSalt, iterations),
    () => ({ iterations: iterations, salt: authSalt }),
  );
  const newKek = tracer.step(
    'Derive the new KEK',
    'PBKDF2-HMAC-SHA256',
    () => deriveKek(newPassword, kekSalt, iterations),
    (value) => ({ iterations: iterations, salt: kekSalt, kek: hidden(value) }),
  );
  const wrapped = tracer.step(
    'Re-wrap both private keys with the new KEK',
    'AES-256-GCM',
    () => ({
      enc: wrapPrivateKey(newKek, privateKeys.enc, user.id, 'enc'),
      sig: wrapPrivateKey(newKek, privateKeys.sig, user.id, 'sig'),
    }),
    (value) => ({ encryptionKeyIv: value.enc.iv, signingKeyIv: value.sig.iv }),
  );

  user.passwordHash = passwordHash;
  user.authSalt = authSalt;
  user.kekSalt = kekSalt;
  user.kdfIterations = iterations;
  user.encPrivateKey = wrapped.enc;
  user.sigPrivateKey = wrapped.sig;
  await user.save();

  res.json({ ok: true, trace: tracer.finish() });
}
