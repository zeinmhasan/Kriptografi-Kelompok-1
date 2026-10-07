import type { Request, Response } from 'express';
import { badRequest } from '../errors.ts';
import { currentUser } from '../middleware/auth.ts';
import { toBytes } from '../middleware/upload.ts';
import { findAccessibleFile, findOwnedFile } from '../services/fileService.ts';
import { serializeFile } from '../services/serializers.ts';
import { exportSignature, signFile, verifyExternalFile, verifyStoredFile } from '../services/signatureService.ts';
import { Tracer } from '../services/trace.ts';
import { attachment, bodyString, routeParam } from './request.ts';

export async function sign(req: Request, res: Response): Promise<void> {
  const user = currentUser(res);
  const password = bodyString(req, 'password', 'Password');
  const file = await findOwnedFile(routeParam(req, 'id'), user);

  const tracer = new Tracer('Digital signature');
  await signFile(file, user, password, tracer);
  res.json({ file: await serializeFile(file, user), trace: tracer.finish() });
}

export async function verifyStored(req: Request, res: Response): Promise<void> {
  const user = currentUser(res);
  const password = bodyString(req, 'password', 'Password');
  const file = await findAccessibleFile(routeParam(req, 'id'), user);

  const tracer = new Tracer('Verify stored file signature');
  const result = await verifyStoredFile(file, user, password, tracer);
  res.json({ result, trace: tracer.finish() });
}

export async function downloadSignature(req: Request, res: Response): Promise<void> {
  const user = currentUser(res);
  const file = await findAccessibleFile(routeParam(req, 'id'), user);
  const detached = await exportSignature(file);
  res.set({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': attachment(`${file.originalName}.sig`),
  });
  res.send(JSON.stringify(detached, null, 2));
}

export async function verifyExternal(req: Request, res: Response): Promise<void> {
  const uploads = req.files as Record<string, Express.Multer.File[]> | undefined;
  const file = uploads?.file?.[0];
  const signature = uploads?.signature?.[0];
  if (!file) throw badRequest('Choose the file to verify.');
  if (!signature) throw badRequest('Choose the .sig file.');
  if (signature.size > 16 * 1024) throw badRequest('The .sig file is too large.');

  const tracer = new Tracer('Verify external file signature');
  const result = await verifyExternalFile(toBytes(file.buffer), toBytes(signature.buffer), tracer);
  res.json({ result, trace: tracer.finish() });
}
