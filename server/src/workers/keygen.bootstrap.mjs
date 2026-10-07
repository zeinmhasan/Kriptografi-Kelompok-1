// Worker thread tidak mewarisi loader TypeScript dari proses utama, jadi loader
// didaftarkan di sini sebelum worker yang sebenarnya dimuat.
import { register } from 'tsx/esm/api';

register();
await import('./keygen.worker.ts');
