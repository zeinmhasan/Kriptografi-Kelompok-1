import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.ts';
import { apiRouter } from './routes/index.ts';

const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'client', 'dist');

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.use('/api', apiRouter);
  app.use('/api', notFoundHandler);

  // Jika klien sudah di-build, server ini sekaligus menyajikannya, sehingga
  // aplikasi bisa dijalankan dengan satu proses saja.
  if (existsSync(path.join(clientDist, 'index.html'))) {
    app.use(express.static(clientDist));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
