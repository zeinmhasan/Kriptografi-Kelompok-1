import type { Request, Response } from 'express';
import { notFound } from '../errors.ts';
import { currentUser } from '../middleware/auth.ts';
import { User } from '../models/User.ts';
import { serializePublicKeys } from '../services/serializers.ts';
import { routeParam } from './request.ts';

// Pencarian username untuk memilih penerima share.
export async function searchUsers(req: Request, res: Response): Promise<void> {
  const user = currentUser(res);
  const query = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  if (query.length === 0) {
    res.json({ users: [] });
    return;
  }

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const users = await User.find({ username: { $regex: `^${escaped}` }, _id: { $ne: user._id } })
    .sort({ username: 1 })
    .limit(8);
  res.json({
    users: users.map((found) => ({
      id: found.id as string,
      username: found.username,
      encKeyFingerprint: found.encKeyFingerprint,
    })),
  });
}

// Public key boleh dilihat siapa pun yang login: dipakai untuk enkripsi ke user itu
// dan untuk memverifikasi tanda tangannya.
export async function getPublicKeys(req: Request, res: Response): Promise<void> {
  const user = await User.findOne({ username: routeParam(req, 'username').toLowerCase() });
  if (!user) throw notFound('User tidak ditemukan.');
  res.json(serializePublicKeys(user));
}
