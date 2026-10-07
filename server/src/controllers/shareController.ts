import type { Request, Response } from 'express';
import { currentUser } from '../middleware/auth.ts';
import { findOwnedFile } from '../services/fileService.ts';
import { serializeFile } from '../services/serializers.ts';
import { revokeShare, shareFile } from '../services/shareService.ts';
import { Tracer } from '../services/trace.ts';
import { bodyString, routeParam } from './request.ts';

export async function share(req: Request, res: Response): Promise<void> {
  const user = currentUser(res);
  const username = bodyString(req, 'username', 'Username penerima');
  const password = bodyString(req, 'password', 'Password');
  const file = await findOwnedFile(routeParam(req, 'id'), user);

  const tracer = new Tracer('Berbagi file');
  await shareFile(file, user, username, password, tracer);
  res.json({ file: await serializeFile(file, user), trace: tracer.finish() });
}

export async function revoke(req: Request, res: Response): Promise<void> {
  const user = currentUser(res);
  const file = await findOwnedFile(routeParam(req, 'id'), user);
  await revokeShare(file, user, routeParam(req, 'userId'));
  res.json({ file: await serializeFile(file, user) });
}
