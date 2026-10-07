import mongoose from 'mongoose';
import { createApp } from './app.ts';
import { config } from './config.ts';
import { ensureStorageDir } from './services/fileService.ts';

async function main(): Promise<void> {
  await ensureStorageDir();
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
  console.log(`MongoDB terhubung: ${config.mongoUri}`);

  createApp().listen(config.port, () => {
    console.log(`Crypta server berjalan di http://localhost:${config.port}`);
    console.log(
      `RSA-${config.rsaBits}, PBKDF2 ${config.pbkdf2Iterations} iterasi, batas file ${config.maxFileSize / 1024 / 1024} MB`,
    );
  });
}

main().catch((error) => {
  console.error('Server gagal dijalankan:', error);
  process.exit(1);
});
