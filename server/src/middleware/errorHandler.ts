import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { config } from '../config.ts';
import { GcmAuthenticationError } from '../crypto/gcm.ts';
import { OaepDecryptionError } from '../crypto/oaep.ts';
import { HttpError } from '../errors.ts';

function send(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ error: { code, message } });
}

export function notFoundHandler(_req: Request, res: Response): void {
  send(res, 404, 'NOT_FOUND', 'Endpoint not found.');
}

// Express mengenali error handler dari jumlah parameternya, jadi keempatnya harus ada.
export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof HttpError) {
    return send(res, error.status, error.code, error.message);
  }
  if (error instanceof GcmAuthenticationError) {
    return send(
      res,
      422,
      'INTEGRITY_FAILED',
      'Integrity check failed: the ciphertext, auth tag, IV, or file metadata has been changed.',
    );
  }
  if (error instanceof OaepDecryptionError) {
    return send(res, 422, 'KEY_UNWRAP_FAILED', 'The file AES key could not be unwrapped: the wrapped key is corrupted or was not made for this user.');
  }
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      const limit = Math.floor(config.maxFileSize / 1024 / 1024);
      return send(res, 413, 'FILE_TOO_LARGE', `The file is larger than the ${limit} MB limit.`);
    }
    return send(res, 400, 'BAD_UPLOAD', 'That upload is not valid.');
  }
  if (typeof error === 'object' && error !== null && (error as { type?: string }).type === 'entity.parse.failed') {
    return send(res, 400, 'BAD_REQUEST', 'The request body is not valid JSON.');
  }

  console.error(error);
  send(res, 500, 'INTERNAL_ERROR', 'Something went wrong on the server.');
}
