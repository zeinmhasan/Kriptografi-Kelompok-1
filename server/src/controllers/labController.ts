import type { Request, Response } from 'express';
import { config } from '../config.ts';
import { runSelfTests } from '../crypto/selftest.ts';
import { currentUser } from '../middleware/auth.ts';
import { findAccessibleFile } from '../services/fileService.ts';
import { runLabBenchmark, runTamperExperiments } from '../services/labService.ts';
import { Tracer } from '../services/trace.ts';
import { bodyString, routeParam } from './request.ts';

export async function tamperTest(req: Request, res: Response): Promise<void> {
  const user = currentUser(res);
  const password = bodyString(req, 'password', 'Password');
  const file = await findAccessibleFile(routeParam(req, 'id'), user);

  const tracer = new Tracer('Tamper simulation');
  const experiments = await runTamperExperiments(file, user, password, tracer);
  res.json({ fileName: file.originalName, experiments, trace: tracer.finish() });
}

export async function selfTest(_req: Request, res: Response): Promise<void> {
  const results = runSelfTests();
  res.json({
    results,
    passed: results.filter((result) => result.passed).length,
    total: results.length,
  });
}

export async function benchmark(_req: Request, res: Response): Promise<void> {
  res.json(await runLabBenchmark());
}

// Parameter kriptografi yang sedang dipakai server, ditampilkan di Crypto Lab dan Settings.
export async function parameters(_req: Request, res: Response): Promise<void> {
  res.json({
    rsaBits: config.rsaBits,
    pbkdf2Iterations: config.pbkdf2Iterations,
    maxFileSize: config.maxFileSize,
    algorithms: {
      fileEncryption: 'AES-256-GCM',
      keyWrapping: 'RSA-OAEP (SHA-256, MGF1-SHA-256)',
      signature: 'RSA-PSS (SHA-256, MGF1-SHA-256, 32-byte salt)',
      hash: 'SHA-256',
      passwordKdf: 'PBKDF2-HMAC-SHA256',
      session: 'JWT HS256',
    },
  });
}
