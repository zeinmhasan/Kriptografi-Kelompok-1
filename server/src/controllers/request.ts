// Pembacaan dan validasi masukan permintaan.
import type { Request } from 'express';
import { badRequest } from '../errors.ts';

export function bodyString(req: Request, field: string, label: string = field): string {
  const value = (req.body as Record<string, unknown> | undefined)?.[field];
  if (typeof value !== 'string' || value.length === 0) throw badRequest(`${label} is required.`);
  return value;
}

export function routeParam(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}

// Header Content-Disposition untuk nama file apa pun, termasuk yang non-ASCII (RFC 6266).
export function attachment(fileName: string): string {
  const fallback = fileName.replace(/[^\x20-\x7e]|["\\]/g, '_');
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
