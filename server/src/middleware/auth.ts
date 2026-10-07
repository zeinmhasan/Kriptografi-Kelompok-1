import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.ts';
import { JwtError, signJwt, verifyJwt } from '../crypto/jwt.ts';
import { unauthorized } from '../errors.ts';
import { User, type UserDocument } from '../models/User.ts';

const COOKIE_NAME = 'crypta_token';

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=');
    if (separator === -1) continue;
    if (pair.slice(0, separator).trim() === name) return pair.slice(separator + 1).trim();
  }
  return undefined;
}

// Token disimpan di cookie httpOnly, sehingga JavaScript di halaman tidak bisa membacanya.
export function startSession(res: Response, user: UserDocument): void {
  const token = signJwt({ sub: user.id, username: user.username }, config.jwtSecret, config.sessionSeconds);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: config.sessionSeconds * 1000,
  });
}

export function endSession(res: Response): void {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'strict', path: '/' });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = readCookie(req.headers.cookie, COOKIE_NAME);
  if (!token) throw unauthorized();

  let userId: string;
  try {
    userId = verifyJwt(token, config.jwtSecret).sub;
  } catch (error) {
    if (error instanceof JwtError) throw unauthorized('Sesi berakhir. Silakan login kembali.');
    throw error;
  }

  const user = await User.findById(userId);
  if (!user) throw unauthorized();
  res.locals.user = user;
  next();
}

export function currentUser(res: Response): UserDocument {
  return res.locals.user as UserDocument;
}
