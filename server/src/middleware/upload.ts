import multer from 'multer';
import { config } from '../config.ts';

// File diterima ke memori, tidak pernah ke disk: plaintext hanya ada di RAM
// sampai selesai dienkripsi.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxFileSize, files: 2 },
});

export const singleFile = upload.single('file');

export const fileAndSignature = upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'signature', maxCount: 1 },
]);

export function toBytes(buffer: Buffer): Uint8Array {
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.length);
}

// Multer membaca nama file sebagai latin1; nama dengan karakter non-ASCII perlu
// dibaca ulang sebagai UTF-8. Pemisah path dibuang supaya nama tidak bisa berisi direktori.
export function cleanFileName(rawName: string): string {
  const decoded = Buffer.from(rawName, 'latin1').toString('utf8');
  const name = decoded.includes('�') ? rawName : decoded;
  const base = name.replace(/[\\/]/g, '_').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (base || 'file').slice(0, 255);
}
