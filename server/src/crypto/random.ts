// Satu-satunya pemakaian modul crypto Node.js di kode aplikasi: sumber bilangan acak.
// CSPRNG bergantung pada entropi sistem operasi dan tidak bisa dibuat sendiri dengan aman.
import { randomBytes as osRandomBytes } from 'node:crypto';

export function randomBytes(length: number): Uint8Array {
  return new Uint8Array(osRandomBytes(length));
}
